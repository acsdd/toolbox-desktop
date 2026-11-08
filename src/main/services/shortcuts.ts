import { app, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { ShortcutGroup, ShortcutInput, ShortcutItem, ShortcutStatus } from '../../shared/types'

const STORE_VERSION = 1
const MAX_CUSTOM = 40
const MAX_NAME = 48
const MAX_URL = 500
const SCAN_DEPTH = 4

type CatalogGroup = Exclude<ShortcutGroup, 'custom'>

interface CatalogEntry {
  id: string
  name: string
  hint: string
  url: string
  group: CatalogGroup
  /** Names of Start Menu shortcuts that indicate the desktop app is installed. */
  apps?: string[]
}

/**
 * The launchpad catalog. `apps` lists exact Start Menu shortcut names; a match
 * means the desktop client is installed, so a click launches it instead of the
 * website. Everything else opens in the default browser.
 */
const CATALOG: CatalogEntry[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    hint: 'OpenAI chat',
    url: 'https://chatgpt.com/',
    group: 'assistant',
    apps: ['ChatGPT']
  },
  {
    id: 'claude',
    name: 'Claude',
    hint: 'Anthropic chat',
    url: 'https://claude.ai/',
    group: 'assistant',
    apps: ['Claude']
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    hint: 'Google AI',
    url: 'https://gemini.google.com/',
    group: 'assistant',
    apps: ['Gemini']
  },
  {
    id: 'copilot',
    name: 'Microsoft Copilot',
    hint: 'Microsoft AI',
    url: 'https://copilot.microsoft.com/',
    group: 'assistant'
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    hint: 'AI search',
    url: 'https://www.perplexity.ai/',
    group: 'assistant'
  },
  {
    id: 'grok',
    name: 'Grok',
    hint: 'xAI chat',
    url: 'https://grok.com/',
    group: 'assistant'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    hint: 'DeepSeek chat',
    url: 'https://chat.deepseek.com/',
    group: 'assistant'
  },
  {
    id: 'mistral',
    name: 'Le Chat',
    hint: 'Mistral AI',
    url: 'https://chat.mistral.ai/',
    group: 'assistant',
    apps: ['Mistral', 'Le Chat']
  },
  {
    id: 'qwen',
    name: 'Qwen Chat',
    hint: 'Alibaba AI',
    url: 'https://chat.qwen.ai/',
    group: 'assistant'
  },
  {
    id: 'kimi',
    name: 'Kimi',
    hint: 'Moonshot AI',
    url: 'https://www.kimi.com/',
    group: 'assistant'
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    hint: 'Local model runner',
    url: 'https://lmstudio.ai/',
    group: 'local',
    apps: ['LM Studio', 'LM-Studio']
  },
  {
    id: 'ollama',
    name: 'Ollama',
    hint: 'Local models',
    url: 'https://ollama.com/',
    group: 'local',
    apps: ['Ollama']
  },
  {
    id: 'jan',
    name: 'Jan',
    hint: 'Local chat client',
    url: 'https://jan.ai/',
    group: 'local',
    apps: ['Jan']
  },
  {
    id: 'gpt4all',
    name: 'GPT4All',
    hint: 'Offline chat',
    url: 'https://www.nomic.ai/gpt4all',
    group: 'local',
    apps: ['GPT4All']
  },
  {
    id: 'anythingllm',
    name: 'AnythingLLM',
    hint: 'Local RAG workspace',
    url: 'https://anythingllm.com/',
    group: 'local',
    apps: ['AnythingLLM']
  },
  {
    id: 'openwebui',
    name: 'Open WebUI',
    hint: 'Self-hosted chat',
    url: 'https://openwebui.com/',
    group: 'local',
    apps: ['Open WebUI']
  },
  {
    id: 'chatall',
    name: 'ChatALL',
    hint: 'Compare AI bots',
    url: 'https://github.com/sunner/ChatALL',
    group: 'local',
    apps: ['ChatALL']
  },
  {
    id: 'cherry-studio',
    name: 'Cherry Studio',
    hint: 'Local AI desktop',
    url: 'https://www.cherry-ai.com/',
    group: 'local',
    apps: ['Cherry Studio']
  },
  {
    id: 'chatbox',
    name: 'Chatbox',
    hint: 'Local AI desktop',
    url: 'https://chatboxai.app/',
    group: 'local',
    apps: ['Chatbox']
  },
  {
    id: 'msty',
    name: 'Msty',
    hint: 'Local model chat',
    url: 'https://msty.app/',
    group: 'local',
    apps: ['Msty']
  },
  {
    id: 'github',
    name: 'GitHub',
    hint: 'Code hosting',
    url: 'https://github.com/',
    group: 'developer'
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    hint: 'AI pair programmer',
    url: 'https://github.com/features/copilot',
    group: 'developer',
    apps: ['GitHub Copilot']
  },
  {
    id: 'cursor',
    name: 'Cursor',
    hint: 'AI code editor',
    url: 'https://cursor.com/',
    group: 'developer',
    apps: ['Cursor']
  },
  {
    id: 'vscode',
    name: 'VS Code',
    hint: 'Code editor',
    url: 'https://code.visualstudio.com/',
    group: 'developer',
    apps: ['Visual Studio Code', 'VS Code']
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    hint: 'AI code editor',
    url: 'https://windsurf.com/',
    group: 'developer',
    apps: ['Windsurf']
  },
  {
    id: 'zed',
    name: 'Zed',
    hint: 'Collaborative editor',
    url: 'https://zed.dev/',
    group: 'developer',
    apps: ['Zed']
  },
  {
    id: 'qoder',
    name: 'Qoder',
    hint: 'AI code editor',
    url: 'https://qoder.com/',
    group: 'developer',
    apps: ['Qoder']
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    hint: 'Terminal agent',
    url: 'https://opencode.ai/',
    group: 'developer',
    apps: ['OpenCode']
  },
  {
    id: 'aider',
    name: 'aider',
    hint: 'Terminal pair programmer',
    url: 'https://aider.chat/',
    group: 'developer',
    apps: ['aider-desk', 'aider', 'Aider']
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    hint: 'Google AI IDE',
    url: 'https://antigravity.google/',
    group: 'developer',
    apps: ['Antigravity IDE', 'Antigravity']
  }
]

const DEFAULT_ENABLED = [
  'chatgpt',
  'claude',
  'gemini',
  'copilot',
  'deepseek',
  'github',
  'github-copilot',
  'lmstudio',
  'ollama',
  'cursor'
]

interface StoredCustom {
  id: string
  name: string
  url: string
}

interface StoredShortcuts {
  version: 1
  enabled: string[]
  custom: StoredCustom[]
}

interface ShortcutState {
  store: StoredShortcuts | null
  links: Map<string, string>
  scannedAt: number
  scanning: Promise<void> | null
}

const state: ShortcutState = {
  store: null,
  links: new Map(),
  scannedAt: 0,
  scanning: null
}

function storePath(): string {
  return join(app.getPath('userData'), 'shortcuts.json')
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function startMenuRoots(): string[] {
  const programData = process.env['ProgramData'] ?? 'C:\\ProgramData'
  return [
    join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  ]
}

async function walk(startMenu: string, depth: number, found: string[]): Promise<void> {
  if (depth > SCAN_DEPTH) return
  let entries: Dirent[]
  try {
    entries = await readdir(startMenu, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(startMenu, entry.name)
    if (entry.isDirectory()) {
      await walk(full, depth + 1, found)
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lnk')) {
      found.push(full)
    }
  }
}

async function scanApps(): Promise<Map<string, string>> {
  const found: string[] = []
  for (const root of startMenuRoots()) {
    await walk(root, 0, found)
  }

  const byName = new Map<string, string>()
  for (const link of found) {
    const name = normalize(basename(link, '.lnk'))
    if (name && !byName.has(name)) byName.set(name, link)
  }

  const links = new Map<string, string>()
  for (const entry of CATALOG) {
    for (const label of entry.apps ?? []) {
      const link = byName.get(normalize(label))
      if (link) {
        links.set(entry.id, link)
        break
      }
    }
  }
  return links
}

async function rescanApps(): Promise<void> {
  if (state.scanning) return state.scanning
  state.scanning = (async () => {
    try {
      state.links = await scanApps()
      state.scannedAt = Date.now()
    } finally {
      state.scanning = null
    }
  })()
  return state.scanning
}

function isStoredCustom(value: unknown): value is StoredCustom {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    item.id.startsWith('custom-') &&
    typeof item.name === 'string' &&
    typeof item.url === 'string'
  )
}

function defaultStore(): StoredShortcuts {
  return { version: STORE_VERSION, enabled: [...DEFAULT_ENABLED], custom: [] }
}

async function loadStore(): Promise<StoredShortcuts> {
  if (state.store) return state.store

  let store = defaultStore()
  try {
    const raw = JSON.parse(await readFile(storePath(), 'utf8')) as Record<string, unknown>
    const known = new Set(CATALOG.map((entry) => entry.id))
    const enabled = Array.isArray(raw.enabled)
      ? raw.enabled.filter((id): id is string => typeof id === 'string' && known.has(id))
      : DEFAULT_ENABLED
    const custom = Array.isArray(raw.custom)
      ? raw.custom.filter(isStoredCustom).slice(0, MAX_CUSTOM).map((item) => ({
          id: item.id,
          name: item.name.slice(0, MAX_NAME),
          url: item.url
        }))
      : []
    store = { version: STORE_VERSION, enabled: [...new Set(enabled)], custom }
  } catch {
    // Missing or malformed store: start from the curated defaults.
  }

  state.store = store
  return store
}

async function persist(store: StoredShortcuts): Promise<void> {
  const path = storePath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(store, null, 2), 'utf8')
  state.store = store
}

function hostLabel(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.host || parsed.hostname
  } catch {
    return url
  }
}

function buildStatus(): ShortcutStatus {
  const store = state.store ?? defaultStore()
  const enabled = new Set(store.enabled)
  const items: ShortcutItem[] = [
    ...CATALOG.map((entry) => ({
      id: entry.id,
      name: entry.name,
      hint: entry.hint,
      url: entry.url,
      group: entry.group,
      enabled: enabled.has(entry.id),
      installed: state.links.has(entry.id),
      custom: false
    })),
    ...store.custom.map((item) => ({
      id: item.id,
      name: item.name,
      hint: hostLabel(item.url),
      url: item.url,
      group: 'custom' as const,
      enabled: true,
      installed: false,
      custom: true
    }))
  ]
  return { items }
}

function parseLink(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Enter a full link, for example https://chatgpt.com.')
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_URL) {
    throw new Error('Enter a full link, for example https://chatgpt.com.')
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Enter a full link, for example https://chatgpt.com.')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http and https links can be added.')
  }
  if (parsed.username || parsed.password) {
    throw new Error('Remove the username and password from the link.')
  }
  return parsed.toString()
}

function parseName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Give the shortcut a name.')
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) throw new Error('Give the shortcut a name.')
  if (trimmed.length > MAX_NAME) throw new Error(`Keep the name under ${MAX_NAME} characters.`)
  return trimmed
}

export async function initShortcuts(): Promise<void> {
  await loadStore()
  void rescanApps().then(() => undefined)
}

export async function getShortcutStatus(): Promise<ShortcutStatus> {
  await loadStore()
  if (state.scanning) await state.scanning
  else if (state.scannedAt === 0) await rescanApps()
  return buildStatus()
}

export async function toggleShortcut(id: unknown, enabled: unknown): Promise<ShortcutStatus> {
  const store = await loadStore()
  if (typeof id !== 'string' || !CATALOG.some((entry) => entry.id === id)) {
    throw new Error('That shortcut is not part of the preset list.')
  }
  const next = new Set(store.enabled)
  if (enabled === true) next.add(id)
  else next.delete(id)
  await persist({ ...store, enabled: [...next] })
  return buildStatus()
}

export async function addShortcut(input: unknown): Promise<ShortcutStatus> {
  const store = await loadStore()
  const value = (input ?? {}) as Partial<ShortcutInput>
  const name = parseName(value.name)
  const url = parseLink(value.url)

  if (store.custom.length >= MAX_CUSTOM) {
    throw new Error(`Keep up to ${MAX_CUSTOM} custom shortcuts.`)
  }
  if (store.custom.some((item) => item.url === url)) {
    throw new Error('That link is already on your launchpad.')
  }
  if (CATALOG.some((entry) => entry.url === url)) {
    throw new Error('That site is already in the preset list.')
  }

  const custom = [...store.custom, { id: `custom-${randomUUID()}`, name, url }]
  await persist({ ...store, custom })
  return buildStatus()
}

export async function removeShortcut(id: unknown): Promise<ShortcutStatus> {
  const store = await loadStore()
  if (typeof id !== 'string' || !id.startsWith('custom-')) {
    throw new Error('Only custom shortcuts can be removed. Turn presets off instead.')
  }
  const custom = store.custom.filter((item) => item.id !== id)
  if (custom.length === store.custom.length) throw new Error('That shortcut no longer exists.')
  await persist({ ...store, custom })
  return buildStatus()
}

export async function rescanShortcuts(): Promise<ShortcutStatus> {
  await loadStore()
  await rescanApps()
  return buildStatus()
}

export async function openShortcut(id: unknown): Promise<'app' | 'link'> {
  const store = await loadStore()
  if (typeof id !== 'string') throw new Error('Pick a shortcut first.')

  const preset = CATALOG.find((entry) => entry.id === id)
  const custom = store.custom.find((item) => item.id === id)
  if (!preset && !custom) throw new Error('That shortcut is no longer on your launchpad.')

  const target = preset?.url ?? parseLink(custom?.url)
  if (preset) {
    const link = state.links.get(preset.id)
    if (link) {
      const failure = await shell.openPath(link)
      if (!failure) return 'app'
    }
  }

  await shell.openExternal(target)
  return 'link'
}
