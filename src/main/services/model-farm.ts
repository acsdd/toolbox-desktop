import { app, BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { readFile, rm, statfs, writeFile } from 'node:fs/promises'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import {
  DEFAULT_CATALOG_TTL_MS,
  MODEL_TASKS,
  detectMachine,
  fetchCatalog,
  fetchModelById,
  gradeMachine,
  listGgufQuants,
  matchInstalledModel,
  normalizeRepoId,
  planOllamaInstall,
  probeOllamaCli,
  pullIntoOllama,
  readCatalogCache,
  runOllamaCommand,
  scoreModels,
  searchCatalog,
  sortForDisplay,
  writeCatalogCache,
  buildModelfile,
  diskShortfall,
  diskShortfallLabel
} from '@toolbox/widgets'
import type {
  CatalogModel,
  ExecFileLike,
  FitScenario,
  GgufQuant,
  MachineGrade,
  MachineProfile,
  ModelTask,
  PullResult,
  ScoredModel,
  SpawnLike
} from '@toolbox/widgets'
import type {
  ModelFarmCatalogResult,
  ModelFarmDownload,
  ModelFarmInstallInput,
  ModelFarmInstallResult,
  ModelFarmMachine,
  ModelFarmMachineGrade,
  ModelFarmModel,
  ModelFarmPrefs,
  ModelFarmPrefsInput,
  ModelFarmQuantsResult,
  ModelFarmRemoveInput,
  ModelFarmRemoveResult,
  ModelFarmScoreInput,
  ModelFarmScoreResult,
  ModelFarmScoredModel,
  ModelFarmSetupGrade,
  ModelFarmStatus
} from '../../shared/types'

/** The catalog is only GGUF: Ollama cannot import safetensors directly. */
const CATALOG_PER_TASK = 24
const CATALOG_TTL_MS = DEFAULT_CATALOG_TTL_MS
const DOWNLOAD_HISTORY_LIMIT = 20
const MAX_OUTPUT_CHARS = 20_000

const MIN_PARAM_OPTIONS = [1, 3, 7, 13, 33, 70]
const MAX_PARAM_OPTIONS = [3, 7, 13, 33, 70]
const TASK_FILTER_MAX_LENGTH = 120

const DEFAULT_PREFS: ModelFarmPrefs = {
  scenario: 'now',
  taskFilter: '',
  minParams: null,
  maxParams: null,
  showReds: false
}

interface ModelFarmState {
  machine: MachineProfile | null
  catalog: { models: CatalogModel[]; fetchedAt: number | null } | null
  catalogError: string | null
  prefs: ModelFarmPrefs
  downloads: ModelFarmDownload[]
}

const state: ModelFarmState = {
  machine: null,
  catalog: null,
  catalogError: null,
  prefs: { ...DEFAULT_PREFS },
  downloads: []
}

function userDataPath(...segments: string[]): string {
  return join(app.getPath('userData'), ...segments)
}

function prefsPath(): string {
  return userDataPath('modelfarm.json')
}

function catalogCachePath(): string {
  return userDataPath('modelfarm-catalog.json')
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function sanitizePrefs(raw: unknown): ModelFarmPrefs {
  const doc = (raw ?? {}) as Record<string, unknown>
  const taskFilter = typeof doc.taskFilter === 'string' ? doc.taskFilter.trim() : ''
  const minParams = typeof doc.minParams === 'number' ? doc.minParams : null
  const maxParams = typeof doc.maxParams === 'number' ? doc.maxParams : null
  return {
    scenario: doc.scenario === 'total' ? 'total' : 'now',
    taskFilter: taskFilter.length <= TASK_FILTER_MAX_LENGTH ? taskFilter : '',
    minParams: minParams !== null && MIN_PARAM_OPTIONS.includes(minParams) ? minParams : null,
    maxParams: maxParams !== null && MAX_PARAM_OPTIONS.includes(maxParams) ? maxParams : null,
    showReds: doc.showReds === true
  }
}

export async function loadModelFarmPrefs(): Promise<ModelFarmPrefs> {
  try {
    const raw = JSON.parse(await readFile(prefsPath(), 'utf8')) as unknown
    state.prefs = sanitizePrefs(raw)
  } catch {
    // A missing or corrupt prefs file falls back to the defaults.
  }
  return state.prefs
}

export async function setModelFarmPrefs(input: ModelFarmPrefsInput): Promise<ModelFarmPrefs> {
  state.prefs = sanitizePrefs({ ...state.prefs, ...input })
  await persistPrefs()
  return state.prefs
}

async function persistPrefs(): Promise<void> {
  try {
    await writeFile(prefsPath(), JSON.stringify(state.prefs, null, 2), {
      encoding: 'utf8',
      mode: 0o600
    })
  } catch {
    // Preferences are convenience state; a failed write is not fatal.
  }
}

function toMachine(profile: MachineProfile): ModelFarmMachine {
  return {
    totalRamBytes: profile.totalRamBytes,
    availableRamBytes: profile.availableRamBytes,
    cores: profile.cores,
    gpus: profile.gpus.map((gpu) => ({ ...gpu })),
    freeDiskBytes: profile.freeDiskBytes ?? null,
    gpuProbe: profile.gpuProbe ?? (profile.gpus.length > 0 ? 'ok' : 'unknown'),
    ollama: {
      installed: profile.ollama.installed,
      url: profile.ollama.url,
      error: profile.ollama.error,
      models: profile.ollama.models.map((entry) => ({ ...entry }))
    },
    detectedAt: profile.detectedAt
  }
}

function toModelGrade(grade: MachineGrade): ModelFarmMachineGrade {
  return {
    ...grade,
    axes: grade.axes.map((axis) => ({ ...axis })),
    weakest: grade.weakest ? { ...grade.weakest } : null
  }
}

function toModel(model: CatalogModel): ModelFarmModel {
  return { ...model, tags: [...model.tags], formats: [...model.formats] }
}

function broadcastDownloads(): void {
  const payload = state.downloads.map((entry) => ({ ...entry }))
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) continue
    try {
      window.webContents.send('modelfarm:progress', payload)
    } catch {
      // A closing window is not a problem for the remaining ones.
    }
  }
}

export function getModelFarmDownloads(): ModelFarmDownload[] {
  return state.downloads.map((entry) => ({ ...entry }))
}

async function detect(force: boolean): Promise<MachineProfile> {
  if (!state.machine || force) state.machine = await detectMachine()
  return state.machine
}

export async function getModelFarmStatus(forceDetect = false): Promise<ModelFarmStatus> {
  const machine = await detect(forceDetect)
  return { machine: toMachine(machine), machineGrade: toModelGrade(gradeMachine(machine, state.prefs.scenario)) }
}

/**
 * The cached GGUF catalog. A cache written with safetensors entries is treated
 * as stale so the list stays installable, and a failed refresh keeps the last
 * good catalog rather than leaving the tool empty.
 */
export async function getModelFarmCatalog(forceRefresh = false): Promise<ModelFarmCatalogResult> {
  const installable = (models: CatalogModel[]): ModelFarmModel[] =>
    models.filter((model) => model.formats.includes('gguf')).map(toModel)

  const cached = readCatalogCache(catalogCachePath())
  const staleFormats = (cached?.models ?? []).some((model) => !model.formats.includes('gguf'))
  const fresh =
    cached !== null &&
    cached.fetchedAt !== null &&
    Date.now() - cached.fetchedAt < CATALOG_TTL_MS &&
    !staleFormats

  if (!forceRefresh && (fresh || (cached !== null && state.catalogError !== null))) {
    const models = cached?.models ?? state.catalog?.models ?? []
    return { models: installable(models), fetchedAt: cached?.fetchedAt ?? null, error: state.catalogError }
  }

  try {
    const models = await fetchCatalog({ formats: ['gguf'], perTask: CATALOG_PER_TASK })
    const fetchedAt = Date.now()
    state.catalog = { models, fetchedAt }
    state.catalogError = null
    writeCatalogCache(catalogCachePath(), models, fetchedAt)
  } catch (cause) {
    state.catalogError = errorMessage(cause)
    const models = state.catalog?.models ?? cached?.models ?? []
    state.catalog = { models, fetchedAt: state.catalog?.fetchedAt ?? cached?.fetchedAt ?? null }
  }

  return {
    models: installable(state.catalog?.models ?? []),
    fetchedAt: state.catalog?.fetchedAt ?? null,
    error: state.catalogError
  }
}

function installedNames(machine: MachineProfile): string[] {
  return machine.ollama.models.map((entry) => entry.name)
}

function markInstalled(models: ScoredModel[], names: string[]): ModelFarmScoredModel[] {
  return models.map((model) => {
    const installed = matchInstalledModel(model, names)
    return {
      ...toModel(model),
      verdict: model.verdict,
      fitsNow: model.fitsNow,
      fitsTotal: model.fitsTotal,
      reason: model.reason,
      hints: [...model.hints],
      grade: model.grade as ModelFarmSetupGrade,
      installed
    }
  })
}

function groupByTask(models: ModelFarmScoredModel[]): ModelFarmScoreResult['groups'] {
  const byTask = new Map<ModelTask, ModelFarmScoredModel[]>()
  for (const entry of models) {
    const list = byTask.get(entry.task) ?? []
    list.push(entry)
    byTask.set(entry.task, list)
  }
  return MODEL_TASKS.filter((info) => byTask.has(info.task)).map((info) => ({
    task: info.task,
    label: info.label,
    icon: info.icon,
    models: sortForDisplay(byTask.get(info.task) ?? []) as ModelFarmScoredModel[]
  }))
}

export async function scoreModelFarm(input: ModelFarmScoreInput): Promise<ModelFarmScoreResult> {
  const scenario: FitScenario = input.scenario === 'total' ? 'total' : 'now'
  const [machine, catalog] = await Promise.all([detect(false), getModelFarmCatalog(false)])
  const search = (input.search ?? '').trim().toLowerCase()
  const filtered = catalog.models.filter((model) => {
    if (search && !model.id.toLowerCase().includes(search) && !model.label.toLowerCase().includes(search)) {
      return false
    }
    if (input.minParams != null && (model.paramsBillions ?? 0) < input.minParams) return false
    if (input.maxParams != null && (model.paramsBillions ?? Infinity) > input.maxParams) return false
    return true
  })
  const scored = scoreModels({ models: filtered, machine, scenario, runtime: { id: 'ollama', api: 'ollama' } })
  const visible = input.onlyReachable ? scored.filter((m) => m.verdict !== 'red' || m.hints.length > 0) : scored
  const groups = groupByTask(markInstalled(visible, installedNames(machine)))
  return {
    machine: toMachine(machine),
    machineGrade: toModelGrade(gradeMachine(machine, scenario)),
    scenario,
    groups,
    total: visible.length,
    fetchedAt: catalog.fetchedAt,
    error: catalog.error
  }
}

export async function searchModelFarm(query: string, scenario?: FitScenario): Promise<ModelFarmScoreResult> {
  const wanted: FitScenario = scenario === 'total' ? 'total' : 'now'
  const machine = await detect(false)
  const base = {
    machine: toMachine(machine),
    machineGrade: toModelGrade(gradeMachine(machine, wanted)),
    scenario: wanted,
    groups: [] as ModelFarmScoreResult['groups'],
    total: 0,
    fetchedAt: null,
    error: null as string | null
  }
  const trimmed = query.trim()
  if (!trimmed) return base
  try {
    const models = await searchCatalog(trimmed, { formats: ['gguf'] })
    const scored = scoreModels({ models, machine, scenario: wanted, runtime: { id: 'ollama', api: 'ollama' } })
    return { ...base, groups: groupByTask(markInstalled(scored, installedNames(machine))), total: scored.length }
  } catch (cause) {
    return { ...base, error: errorMessage(cause) }
  }
}

export async function getModelFarmQuants(repo: string): Promise<ModelFarmQuantsResult> {
  const id = normalizeRepoId(repo ?? '')
  try {
    const quants: GgufQuant[] = await listGgufQuants(id)
    return { repo: id, quants, error: null }
  } catch (cause) {
    return { repo: id, quants: [], error: errorMessage(cause) }
  }
}

function settleDownload(entry: ModelFarmDownload, status: ModelFarmDownload['status']): void {
  entry.status = status
  let terminal = 0
  for (let index = state.downloads.length - 1; index >= 0; index--) {
    const candidate = state.downloads[index]
    if (candidate.status !== 'downloading' && ++terminal > DOWNLOAD_HISTORY_LIMIT) {
      state.downloads.splice(index, 1)
    }
  }
}

async function freeDiskBytes(path: string): Promise<number | null> {
  try {
    const stats = await statfs(path)
    const free = Number(stats.bsize) * Number(stats.bavail)
    return Number.isFinite(free) && free >= 0 ? free : null
  } catch {
    return null
  }
}

function appendOutput(text: string): void {
  const entry = state.downloads[state.downloads.length - 1]
  if (!entry) return
  entry.output = (entry.output + text).slice(-MAX_OUTPUT_CHARS)
}

/**
 * Pull a catalog model into the local Ollama runtime. Without a GPU split this
 * is a single `ollama pull`; with one it writes a Modelfile and runs
 * `ollama create`, so the offload survives later `ollama run` calls.
 */
export async function installModelFarm(input: ModelFarmInstallInput): Promise<ModelFarmInstallResult> {
  const repo = normalizeRepoId(input.repo ?? '')
  const failure = (message: string, extra: Partial<ModelFarmInstallResult> = {}): ModelFarmInstallResult => ({
    ok: false,
    repo,
    model: '',
    reference: '',
    status: 'error',
    output: '',
    error: message,
    ...extra
  })

  if (!repo) {
    return failure('A HuggingFace repo id is required, e.g. "bartowski/Llama-3.2-3B-Instruct-GGUF".')
  }

  const cached = state.catalog?.models.find((entry) => entry.id.toLowerCase() === repo.toLowerCase())
  let model: CatalogModel | null = cached ?? null
  if (!model) {
    try {
      model = await fetchModelById(repo)
    } catch (cause) {
      return failure(errorMessage(cause))
    }
  }
  if (!model) {
    return failure(`No GGUF weights found for ${repo}.`)
  }

  let plan: ReturnType<typeof planOllamaInstall>
  try {
    plan = planOllamaInstall(model, input.quant ?? model.quantLabel)
  } catch (cause) {
    return failure(errorMessage(cause), { model: model.label, reference: model.id })
  }

  // Guard the requested quant's real size, not the catalog default.
  let neededBytes = model.fileBytes
  const requested = (input.quant ?? '').trim()
  if (requested && requested.toUpperCase() !== (model.quantLabel ?? '').toUpperCase()) {
    try {
      const quants = await listGgufQuants(model.id)
      const match = quants.find((q) => (q.quant ?? '').toUpperCase() === requested.toUpperCase())
      if (match && match.sizeBytes > 0) neededBytes = match.sizeBytes
    } catch {
      // Keep the catalog default size when the quant listing is unavailable.
    }
  }

  const cli = await probeOllamaCli(execFileImpl)
  if (!cli.installed) {
    return failure('Ollama is not installed on this machine. Install it from ollama.com, then try again.', {
      model: model.label,
      reference: plan.reference
    })
  }

  const modelDirectory = resolve(process.env.OLLAMA_MODELS || join(homedir(), '.ollama', 'models'))
  let existingDirectory = modelDirectory
  let available = await freeDiskBytes(existingDirectory)
  while (available === null && dirname(existingDirectory) !== existingDirectory) {
    existingDirectory = dirname(existingDirectory)
    available = await freeDiskBytes(existingDirectory)
  }
  const diskWarning = available === null ? `Warning: Could not check free space for Ollama storage at ${modelDirectory}.\n` : ''
  if (diskWarning) console.warn(diskWarning.trim())
  const short = diskShortfall(available, neededBytes)
  if (short !== null && short > 0) {
    return failure(`Not enough disk for ${model.id}: ${diskShortfallLabel(short)}.`, {
      model: model.label,
      reference: plan.reference
    })
  }

  const entry: ModelFarmDownload = {
    id: randomUUID(),
    repo: model.id,
    model: model.label,
    reference: plan.reference,
    quant: input.quant ?? model.quantLabel,
    status: 'downloading',
    output: diskWarning,
    error: null
  }
  state.downloads.push(entry)
  broadcastDownloads()

  const numGpu = typeof input.numGpu === 'number' && Number.isFinite(input.numGpu) ? Math.max(0, Math.floor(input.numGpu)) : 0
  let result: PullResult
  try {
    if (numGpu > 0) {
      const directory = mkdtempSync(join(tmpdir(), 'toolbox-modelfarm-'))
      const modelfilePath = join(directory, 'Modelfile')
      try {
        writeFileSync(modelfilePath, buildModelfile(plan.reference, { numGpu }), 'utf8')
        result = await runOllamaCommand(['create', plan.modelName, '--file', modelfilePath], {
          spawnImpl,
          onOutput: appendOutput
        })
      } finally {
        await rm(directory, { recursive: true, force: true }).catch((error) => console.warn('Could not clean temporary Modelfile:', error))
      }
    } else {
      result = await pullIntoOllama(plan.reference, { spawnImpl, onOutput: appendOutput })
    }
  } catch (cause) {
    settleDownload(entry, 'error')
    entry.error = errorMessage(cause)
    broadcastDownloads()
    return failure(errorMessage(cause), { model: model.label, reference: plan.reference, output: entry.output })
  }

  if (!result.ok) {
    settleDownload(entry, 'error')
    entry.error = result.error ?? 'The Ollama runtime refused the install.'
    broadcastDownloads()
    return failure(entry.error, { model: model.label, reference: plan.reference, output: result.output || entry.output })
  }

  settleDownload(entry, 'done')
  entry.output = result.output
  broadcastDownloads()
  // Ollama's model list changed; the next status poll picks it up.
  state.machine = null

  return {
    ok: true,
    repo: model.id,
    model: numGpu > 0 ? plan.modelName : plan.reference,
    reference: plan.reference,
    status: 'done',
    output: result.output,
    error: null
  }
}

export async function removeModelFarmModel(input: ModelFarmRemoveInput): Promise<ModelFarmRemoveResult> {
  const machine = await detect(false)
  const names = installedNames(machine)
  let target: string | null = null
  if (input.model?.trim()) {
    const wanted = input.model.trim().toLowerCase()
    target = names.find((name) => name.toLowerCase() === wanted || name.toLowerCase().split(':')[0] === wanted) ?? null
  } else if (input.repo?.trim()) {
    const repo = normalizeRepoId(input.repo)
    const repoName = repo.split('/')[1] ?? repo
    target = matchInstalledModel({ id: repo, label: repoName.replace(/-GGUF$/i, '') } as CatalogModel, names)
  }
  if (!target) {
    return { ok: false, removed: null, message: 'That model is not installed locally.', output: '' }
  }
  const result = await runOllamaCommand(['rm', target], { spawnImpl })
  if (!result.ok) {
    return {
      ok: false,
      removed: null,
      message: result.error ?? 'Ollama refused the removal.',
      output: result.output
    }
  }
  state.machine = null
  return { ok: true, removed: target, message: `${target} was removed.`, output: result.output }
}

export async function refreshModelFarm(): Promise<ModelFarmStatus> {
  await detect(true)
  await getModelFarmCatalog(true)
  return getModelFarmStatus(false)
}

/** Exec/spawn paths used by the Ollama flows; kept local so tests can swap them. */
const execFileImpl: ExecFileLike = (file, args, options, callback) =>
  execFile(file, args, options, callback)

const spawnImpl: SpawnLike = (file, args) =>
  spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }) as unknown as ReturnType<SpawnLike>
