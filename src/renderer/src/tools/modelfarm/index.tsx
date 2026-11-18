import { Fragment, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type {
  ModelFarmDownload,
  ModelFarmMachineGrade,
  ModelFarmPrefs,
  ModelFarmQuant,
  ModelFarmScoreResult,
  ModelFarmScoredModel,
  ModelFarmStatus
} from '@shared/types'
import { Icon } from '../../components/Icon'
import { formatBytes, relativeTime } from '../../lib/format'
import type { ToolDefinition } from '../types'

const MIN_OPTIONS = [1, 3, 7, 13, 33, 70]
const MAX_OPTIONS = [3, 7, 13, 33, 70]

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function gb(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return 'unknown'
  const value = bytes / 2 ** 30
  return `${value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)} GB`
}

function paramsLabel(model: ModelFarmScoredModel): string {
  return model.paramsBillions !== null ? `${model.paramsBillions}B` : 'params ?'
}

function verdictLabel(model: ModelFarmScoredModel): string {
  if (model.installed) return 'installed'
  return model.verdict
}

function scoreColor(score: number | null): string {
  if (score === null) return '#93a9c8'
  if (score >= 85) return '#22c39a'
  if (score >= 70) return '#8fd14f'
  if (score >= 55) return '#f0c36a'
  if (score >= 40) return '#f5a524'
  return '#ff6b81'
}

function MachineCard({ grade, status }: { grade: ModelFarmMachineGrade; status: ModelFarmStatus }) {
  const { machine } = status
  const ollama = machine.ollama
  return (
    <section className="mf-machine" aria-label="This machine">
      <div className="mf-machine-head">
        <div className="mf-score-ring" style={{ '--ring': scoreColor(grade.score) } as CSSProperties}>
          <strong>{grade.score}</strong>
          <span>{grade.label}</span>
        </div>
        <div className="mf-machine-copy">
          <p className="linked-eyebrow">
            <Icon name="gauge" size={13} />
            This machine · {grade.scenario === 'now' ? 'memory free now' : 'total memory'}
          </p>
          <strong>
            {machine.cores} cores · {gb(machine.totalRamBytes)} RAM
          </strong>
          <span>
            {machine.gpus.length > 0
              ? `${machine.gpus.map((gpu) => `${gpu.name} ${gb(gpu.vramBytes)}`).join(' + ')}`
              : 'No GPU detected'}
            {' · '}
            {gb(machine.freeDiskBytes)} disk free
          </span>
          <span className={ollama.installed ? 'mf-ollama ready' : 'mf-ollama'}>
            <span className="mf-dot" aria-hidden="true" />
            {ollama.installed
              ? `Ollama ready · ${ollama.models.length} model${ollama.models.length === 1 ? '' : 's'}`
              : 'Ollama not detected'}
          </span>
        </div>
      </div>

      <div className="mf-axes">
        {grade.axes.map((axis) => (
          <div className="mf-axis" key={axis.axis}>
            <div className="mf-axis-top">
              <span>{axis.label}</span>
              <strong style={{ color: scoreColor(axis.score) }}>{axis.score ?? '—'}</strong>
            </div>
            <div className="mf-axis-bar">
              <span
                style={{
                  width: `${axis.score ?? 0}%`,
                  background: scoreColor(axis.score)
                }}
              />
            </div>
            <span className="mf-axis-detail">{axis.detail}</span>
          </div>
        ))}
      </div>

      {grade.weakest && (
        <p className="mf-weakest">
          <Icon name="warning" size={13} />
          Weakest link: {grade.weakest.label.toLowerCase()} ({grade.weakest.score ?? 'unreadable'}/100 ·{' '}
          {grade.weakest.detail})
        </p>
      )}
      <p className="mf-detected">Detected {relativeTime(machine.detectedAt)}</p>
    </section>
  )
}

interface InstallPanelProps {
  model: ModelFarmScoredModel
  downloads: ModelFarmDownload[]
  busy: boolean
  onCancel: () => void
  onConfirm: (quant: string | null, numGpu: number | null) => void
}

function InstallPanel({ model, downloads, busy, onCancel, onConfirm }: InstallPanelProps) {
  const [quants, setQuants] = useState<ModelFarmQuant[]>([])
  const [quant, setQuant] = useState<string | null>(model.quantLabel)
  const [numGpu, setNumGpu] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.modelFarm
      .quants(model.id)
      .then((result) => {
        if (cancelled) return
        setQuants(result.quants)
        setError(result.error)
        const preferred = result.quants.find((entry) => entry.quant === model.quantLabel) ?? result.quants[0]
        setQuant((current) => current ?? preferred?.quant ?? null)
      })
      .catch((cause) => {
        if (!cancelled) setError(errorMessage(cause))
      })
    return () => {
      cancelled = true
    }
  }, [model.id, model.quantLabel])

  const chosen = quants.find((entry) => entry.quant === quant) ?? null
  const active = downloads.find((entry) => entry.repo === model.id && entry.status === 'downloading')

  return (
    <div className="mf-install-panel">
      <div className="mf-install-head">
        <strong>Pull {model.label}</strong>
        <button type="button" className="ghost-button small" onClick={onCancel} disabled={busy}>
          <Icon name="close" size={12} />
          Close
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {quants.length > 0 ? (
        <div className="mf-quants">
          {quants.map((entry) => (
            <button
              key={entry.filename}
              type="button"
              className={`chip-button ${quant === entry.quant ? 'active' : ''}`}
              onClick={() => setQuant(entry.quant)}
              aria-pressed={quant === entry.quant}
              title={entry.filename}
            >
              {entry.quant ?? 'default'} · {formatBytes(entry.sizeBytes)}
            </button>
          ))}
        </div>
      ) : (
        <p className="hint">
          <Icon name="refresh" size={13} /> Reading the available quantizations…
        </p>
      )}

      <label className="mf-field">
        <span>GPU layers to keep on the card (optional)</span>
        <input
          type="number"
          min={0}
          value={numGpu}
          placeholder="0 = let Ollama decide"
          onChange={(event) => setNumGpu(event.target.value)}
          disabled={busy}
        />
      </label>

      <div className="mf-install-actions">
        <button
          type="button"
          className="primary-button"
          disabled={busy || !model.formats.includes('gguf')}
          onClick={() => onConfirm(quant, numGpu.trim() ? Number(numGpu) : null)}
        >
          {active ? 'Pulling…' : busy ? 'Starting…' : chosen ? `Pull ${formatBytes(chosen.sizeBytes)}` : 'Pull model'}
        </button>
        {!model.formats.includes('gguf') && <span className="error-text">Not published as GGUF.</span>}
      </div>

      {active && (
        <div className="mf-output">
          <span>Pulling {active.reference}</span>
          <pre>{active.output || 'Starting the Ollama pull…'}</pre>
        </div>
      )}
    </div>
  )
}

function ModelRow({
  model,
  download,
  onInstall,
  onRemove
}: {
  model: ModelFarmScoredModel
  download: ModelFarmDownload | undefined
  onInstall: (model: ModelFarmScoredModel) => void
  onRemove: (model: ModelFarmScoredModel) => void
}) {
  return (
    <div className="mf-model">
      <div className={`mf-verdict ${model.verdict}`} title={model.reason}>
        <span className="mf-dot" aria-hidden="true" />
        {verdictLabel(model)}
      </div>

      <div className="mf-model-copy">
        <strong>{model.label}</strong>
        <span>
          {model.author} · {paramsLabel(model)} · {model.quantLabel ?? 'default quant'} ·{' '}
          {gb(model.runtimeRamBytes)} RAM
        </span>
        <span className="mf-model-reason">{model.reason}</span>
        {model.hints.length > 0 && <span className="mf-model-hints">{model.hints.join(' · ')}</span>}
      </div>

      <div className="mf-grade" title={model.grade.bottleneck.message}>
        <strong style={{ color: scoreColor(model.grade.score) }}>{model.grade.letter}</strong>
        <span>{model.grade.score}/100</span>
      </div>

      <div className="mf-model-actions">
        {model.installed ? (
          <button
            type="button"
            className="ghost-button small danger"
            onClick={() => onRemove(model)}
            disabled={download?.status === 'downloading'}
          >
            <Icon name="trash" size={13} />
            Remove
          </button>
        ) : (
          <button
            type="button"
            className="ghost-button small"
            onClick={() => onInstall(model)}
            disabled={download?.status === 'downloading' || !model.formats.includes('gguf')}
          >
            <Icon name="download" size={13} />
            Install
          </button>
        )}
      </div>
    </div>
  )
}

function ModelFarmTool() {
  const [status, setStatus] = useState<ModelFarmStatus | null>(null)
  const [result, setResult] = useState<ModelFarmScoreResult | null>(null)
  const [prefs, setPrefs] = useState<ModelFarmPrefs | null>(null)
  const [downloads, setDownloads] = useState<ModelFarmDownload[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [mode, setMode] = useState<'catalog' | 'search'>('catalog')
  const [installFor, setInstallFor] = useState<ModelFarmScoredModel | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => window.api.modelFarm.onProgress(setDownloads), [])

  const runScore = async (next: ModelFarmPrefs, which: 'catalog' | 'search' = 'catalog') => {
    setBusy(true)
    setError(null)
    try {
      const score = await (which === 'search'
        ? window.api.modelFarm.search(next.taskFilter, next.scenario)
        : window.api.modelFarm.score({
            scenario: next.scenario,
            search: next.taskFilter,
            minParams: next.minParams,
            maxParams: next.maxParams
          }))
      setResult(score)
      setStatus({ machine: score.machine, machineGrade: score.machineGrade })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      try {
        const [nextPrefs, nextStatus] = await Promise.all([
          window.api.modelFarm.prefs(),
          window.api.modelFarm.status()
        ])
        if (cancelled) return
        setPrefs(nextPrefs)
        setStatus(nextStatus)
        await runScore(nextPrefs)
      } catch (cause) {
        if (!cancelled) setError(errorMessage(cause))
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updatePrefs = async (patch: Partial<ModelFarmPrefs>) => {
    const next = { ...(prefs ?? { scenario: 'now', taskFilter: '', minParams: null, maxParams: null, showReds: false }), ...patch }
    setPrefs(next)
    try {
      await window.api.modelFarm.setPrefs(patch)
    } catch (cause) {
      setError(errorMessage(cause))
    }
    await runScore(next, mode)
  }

  const groups = useMemo(() => {
    if (!result) return []
    if (prefs?.showReds) return result.groups
    return result.groups
      .map((group) => ({ ...group, models: group.models.filter((model) => model.verdict !== 'red') }))
      .filter((group) => group.models.length > 0)
  }, [result, prefs?.showReds])

  const downloadByRepo = useMemo(() => {
    const map = new Map<string, ModelFarmDownload>()
    for (const entry of downloads) {
      if (entry.status === 'downloading') map.set(entry.repo, entry)
    }
    return map
  }, [downloads])

  const openInstall = (model: ModelFarmScoredModel) => {
    setNotice(null)
    setInstallFor(model)
  }

  const confirmInstall = async (quant: string | null, numGpu: number | null) => {
    if (!installFor) return
    setInstalling(true)
    setNotice(null)
    try {
      const outcome = await window.api.modelFarm.install({ repo: installFor.id, quant, numGpu })
      if (outcome.ok) {
        setNotice(`${outcome.model} is ready to run.`)
        setInstallFor(null)
        await runScore(prefs ?? { scenario: 'now', taskFilter: '', minParams: null, maxParams: null, showReds: false }, mode)
      } else {
        setNotice(outcome.error ?? 'The install failed.')
      }
    } catch (cause) {
      setNotice(errorMessage(cause))
    } finally {
      setInstalling(false)
    }
  }

  const removeModel = async (model: ModelFarmScoredModel) => {
    setNotice(null)
    try {
      const outcome = await window.api.modelFarm.remove({ repo: model.id })
      setNotice(outcome.message)
      if (outcome.ok) await runScore(prefs ?? { scenario: 'now', taskFilter: '', minParams: null, maxParams: null, showReds: false }, mode)
    } catch (cause) {
      setNotice(errorMessage(cause))
    }
  }

  const refresh = async () => {
    setBusy(true)
    setError(null)
    try {
      const next = await window.api.modelFarm.refresh()
      setStatus(next)
      await runScore(prefs ?? { scenario: 'now', taskFilter: '', minParams: null, maxParams: null, showReds: false }, mode)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  if (!status || !prefs) {
    return (
      <div className="linked-tool model-farm">
        {error ? (
          <p className="error-text">{error}</p>
        ) : (
          <p className="hint">
            <Icon name="gauge" size={13} /> Reading this machine…
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="linked-tool model-farm">
      <div className="linked-summary">
        <div className="linked-count">
          <strong>{result?.total ?? 0}</strong>
          <span>models</span>
        </div>
        <div className="linked-summary-copy">
          <p className="linked-eyebrow">
            <Icon name="gauge" size={13} />
            Model Farm · HuggingFace · Ollama
          </p>
          <strong>What runs on this PC</strong>
          <span>
            {busy
              ? 'Scoring…'
              : result
                ? `${result.groups.length} skill groups · updated ${relativeTime(result.fetchedAt ?? 0)}`
                : 'No catalog yet'}
          </span>
        </div>
        <div className="linked-actions">
          <button type="button" className="ghost-button small" onClick={() => void refresh()} disabled={busy}>
            <Icon name="refresh" size={13} />
            {busy ? 'Working…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className="mf-notice">{notice}</p>}

      <MachineCard grade={status.machineGrade} status={status} />

      <div className="mf-controls">
        <div className="mf-seg" role="group" aria-label="Scenario">
          <button
            type="button"
            className={prefs.scenario === 'now' ? 'active' : ''}
            onClick={() => void updatePrefs({ scenario: 'now' })}
            aria-pressed={prefs.scenario === 'now'}
          >
            Runs now
          </button>
          <button
            type="button"
            className={prefs.scenario === 'total' ? 'active' : ''}
            onClick={() => void updatePrefs({ scenario: 'total' })}
            aria-pressed={prefs.scenario === 'total'}
          >
            Whole machine
          </button>
        </div>

        <input
          className="mf-search"
          type="search"
          value={prefs.taskFilter}
          placeholder="Filter models by name or repo…"
          onChange={(event) => void updatePrefs({ taskFilter: event.target.value })}
          aria-label="Filter models"
        />

        <label className="mf-field inline">
          <span>min</span>
          <select
            value={prefs.minParams ?? ''}
            onChange={(event) =>
              void updatePrefs({ minParams: event.target.value ? Number(event.target.value) : null })
            }
          >
            <option value="">any</option>
            {MIN_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}B+
              </option>
            ))}
          </select>
        </label>

        <label className="mf-field inline">
          <span>max</span>
          <select
            value={prefs.maxParams ?? ''}
            onChange={(event) =>
              void updatePrefs({ maxParams: event.target.value ? Number(event.target.value) : null })
            }
          >
            <option value="">any</option>
            {MAX_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}B
              </option>
            ))}
          </select>
        </label>

        <label className="mf-toggle">
          <button
            type="button"
            className={`switch ${prefs.showReds ? 'on' : ''}`}
            onClick={() => void updatePrefs({ showReds: !prefs.showReds })}
            aria-pressed={prefs.showReds}
            aria-label="Show models that do not fit"
          >
            <span className="switch-knob" />
          </button>
          <span>Show models that do not fit</span>
        </label>

        <button
          type="button"
          className="ghost-button small"
          onClick={() => {
            setMode('search')
            void runScore(prefs, 'search')
          }}
          disabled={busy || !prefs.taskFilter.trim()}
          title="Search HuggingFace live, beyond the cached catalog"
        >
          <Icon name="search" size={13} />
          Search HuggingFace
        </button>
        {mode === 'search' && (
          <button
            type="button"
            className="ghost-button small"
            onClick={() => {
              setMode('catalog')
              void runScore(prefs, 'catalog')
            }}
            disabled={busy}
          >
            Browse catalog
          </button>
        )}
      </div>

      {downloads.length > 0 && (
        <div className="mf-progress">
          {downloads
            .slice()
            .reverse()
            .slice(0, 3)
            .map((entry) => (
              <div className={`mf-progress-row ${entry.status}`} key={entry.id}>
                <span className="mf-dot" aria-hidden="true" />
                <strong>{entry.model}</strong>
                <span>
                  {entry.status === 'downloading' ? 'pulling…' : entry.status === 'done' ? 'ready' : 'failed'}
                </span>
                {entry.output && entry.status === 'downloading' && <pre>{entry.output.slice(-400)}</pre>}
                {entry.error && <span className="error-text">{entry.error}</span>}
              </div>
            ))}
        </div>
      )}

      {installFor && (
        <InstallPanel
          model={installFor}
          downloads={downloads}
          busy={installing}
          onCancel={() => setInstallFor(null)}
          onConfirm={(quant, numGpu) => void confirmInstall(quant, numGpu)}
        />
      )}

      {groups.length === 0 && !busy && (
        <div className="linked-empty">
          <Icon name="gauge" size={22} />
          <span>
            {result?.error
              ? `The catalog could not be refreshed: ${result.error}`
              : 'No models match these filters. Widen the range or clear the search.'}
          </span>
        </div>
      )}

      {groups.map((group) => (
        <section className="linked-panel mf-group" key={group.task}>
          <div className="linked-panel-head">
            <span>
              <span className="mf-group-icon" aria-hidden="true">
                {group.icon}
              </span>
              {group.label}
            </span>
            <span>{group.models.length} models</span>
          </div>
          <div className="mf-models">
            {group.models.map((model) => (
              <Fragment key={model.id}>
                <ModelRow
                  model={model}
                  download={downloadByRepo.get(model.id)}
                  onInstall={openInstall}
                  onRemove={(entry) => void removeModel(entry)}
                />
              </Fragment>
            ))}
          </div>
        </section>
      ))}

      <div className="linked-help">
        <strong>About Model Farm</strong>
        <p>
          The catalog is the top-downloaded GGUF models on HuggingFace, measured by their real file
          size. Fit compares that against this machine: <em>now</em> uses the memory free right now
          (93% of it, so the desktop stays responsive), <em>whole machine</em> uses total RAM. The
          letter grade pairs this PC against a model on memory, GPU, compute and storage, weighted
          toward the weakest link. Installs pull the GGUF into the local Ollama runtime.
        </p>
      </div>

      <p className="hint">
        <Icon name="shield" size={13} /> Nothing leaves this PC except public HuggingFace requests and
        the model download you start. Ollama must be installed for installs to work.
      </p>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'modelfarm',
  name: 'Model Farm',
  description: 'See which local AI models fit this PC, grade the setup and pull them into Ollama.',
  icon: 'gauge',
  accent: '#7c9cff',
  order: 5,
  component: ModelFarmTool
}
