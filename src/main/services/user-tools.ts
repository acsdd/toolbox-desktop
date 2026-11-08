import { app, shell } from 'electron'
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import type {
  InstallExampleResult,
  UserToolMeta,
  UserToolScan
} from '../../shared/types'

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/
const ACCENT_PATTERN = /^#[0-9a-f]{6}$/i
const MAX_ENTRY_BYTES = 1024 * 1024

const ALLOWED_ICONS = new Set([
  'notes',
  'clipboard',
  'folder',
  'gauge',
  'key',
  'settings',
  'back',
  'plus',
  'trash',
  'copy',
  'refresh',
  'check',
  'warning',
  'close',
  'spark',
  'search',
  'mini',
  'expand',
  'pin',
  'shield',
  'grid',
  'clock',
  'sun',
  'cloud',
  'rain',
  'snow',
  'storm'
])

const DEFAULT_ICON = 'spark'
const DEFAULT_ACCENT = '#5b8cff'

function toolsDirectory(): string {
  return join(app.getPath('userData'), 'tools')
}

async function ensureToolsDirectory(): Promise<string> {
  const directory = toolsDirectory()
  await mkdir(directory, { recursive: true })
  return directory
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function validateManifest(folder: string, raw: unknown): UserToolMeta {
  if (!raw || typeof raw !== 'object') throw new Error('manifest.json must contain an object.')

  const manifest = raw as Record<string, unknown>
  const id = typeof manifest.id === 'string' ? manifest.id.trim() : ''

  if (!ID_PATTERN.test(id)) {
    throw new Error('manifest id must be 2-41 lowercase letters, digits, or dashes.')
  }
  if (id !== folder) {
    throw new Error(`manifest id "${id}" must match the folder name "${folder}".`)
  }

  const name = typeof manifest.name === 'string' ? manifest.name.trim() : ''
  if (!name) throw new Error('manifest name is required.')
  if (name.length > 60) throw new Error('manifest name must be 60 characters or fewer.')

  const description = typeof manifest.description === 'string' ? manifest.description.trim() : ''
  if (!description) throw new Error('manifest description is required.')
  if (description.length > 200) {
    throw new Error('manifest description must be 200 characters or fewer.')
  }

  const icon =
    typeof manifest.icon === 'string' && ALLOWED_ICONS.has(manifest.icon)
      ? manifest.icon
      : DEFAULT_ICON

  const accent =
    typeof manifest.accent === 'string' && ACCENT_PATTERN.test(manifest.accent)
      ? manifest.accent
      : DEFAULT_ACCENT

  return { id, name, description, icon, accent }
}

export async function scanUserTools(): Promise<UserToolScan> {
  const directory = await ensureToolsDirectory()
  const entries = await readdir(directory, { withFileTypes: true })

  const tools: UserToolMeta[] = []
  const errors: UserToolScan['errors'] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const folder = entry.name
    const folderPath = join(directory, folder)

    try {
      if (!ID_PATTERN.test(folder)) {
        throw new Error('Folder name must be lowercase letters, digits, or dashes.')
      }

      const manifestRaw = await readFile(join(folderPath, 'manifest.json'), 'utf8')
      const manifest = validateManifest(folder, JSON.parse(manifestRaw))

      await access(join(folderPath, 'index.js'))
      tools.push(manifest)
    } catch (cause) {
      errors.push({ folder, message: errorMessage(cause) })
    }
  }

  tools.sort((a, b) => a.name.localeCompare(b.name))
  return { tools, errors }
}

export async function getUserToolCode(id: unknown): Promise<string> {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new Error('Invalid tool id.')
  }

  const directory = await ensureToolsDirectory()
  const entry = join(directory, id, 'index.js')
  if (!entry.startsWith(directory + sep)) throw new Error('Invalid tool path.')

  const info = await stat(entry)
  if (info.size > MAX_ENTRY_BYTES) {
    throw new Error('Tool entry file is larger than 1 MB.')
  }

  return readFile(entry, 'utf8')
}

export async function openUserToolsFolder(): Promise<void> {
  const directory = await ensureToolsDirectory()
  const failure = await shell.openPath(directory)
  if (failure) throw new Error(failure)
}

const EXAMPLE_ID = 'text-stats'

const EXAMPLE_MANIFEST = {
  id: EXAMPLE_ID,
  name: 'Text stats',
  description: 'Live word, character, and line counts for anything you paste.',
  icon: 'notes',
  accent: '#38bdf8'
}

const EXAMPLE_SOURCE = `/**
 * Toolbox user tool example.
 *
 * A tool is a folder inside the tools directory:
 *   manifest.json  - id, name, description, icon, accent
 *   index.js       - exports mount(root, ctx)
 *
 * mount() receives a DOM element and a small host context. Return a cleanup
 * function if you attach timers or listeners outside the element.
 *
 * ctx.storage   - namespaced key/value storage (localStorage-backed)
 * ctx.clipboard - list() and copy(text)
 * ctx.system    - stats()
 * ctx.h         - React.createElement, if you prefer React
 */
export function mount(root, ctx) {
  root.innerHTML = ''

  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'column'
  wrap.style.gap = '12px'

  const intro = document.createElement('p')
  intro.className = 'hint'
  intro.textContent =
    'This tool was installed from your tools folder. Edit its index.js, then press Rescan in Manage tools.'
  wrap.appendChild(intro)

  const textarea = document.createElement('textarea')
  textarea.placeholder = 'Paste or type text to count words, characters, and lines.'
  textarea.value = ctx.storage.get('draft') || ''
  textarea.style.width = '100%'
  textarea.style.minHeight = '220px'
  textarea.style.resize = 'vertical'
  textarea.style.padding = '12px'
  textarea.style.borderRadius = '10px'
  textarea.style.border = '1px solid var(--border)'
  textarea.style.background = '#0d1117'
  textarea.style.color = 'var(--text)'
  textarea.style.fontFamily = "'Cascadia Mono', ui-monospace, Consolas, monospace"
  textarea.style.fontSize = '13px'
  textarea.style.lineHeight = '1.6'
  textarea.style.outline = 'none'
  wrap.appendChild(textarea)

  const grid = document.createElement('div')
  grid.className = 'stat-grid'
  wrap.appendChild(grid)

  root.appendChild(wrap)

  function createTile(label) {
    const tile = document.createElement('div')
    tile.className = 'stat-tile'
    const labelEl = document.createElement('span')
    labelEl.className = 'stat-label'
    labelEl.textContent = label
    const valueEl = document.createElement('strong')
    valueEl.className = 'stat-value'
    valueEl.textContent = '0'
    tile.appendChild(labelEl)
    tile.appendChild(valueEl)
    grid.appendChild(tile)
    return valueEl
  }

  const words = createTile('Words')
  const characters = createTile('Characters')
  const lines = createTile('Lines')

  let saveTimer = null

  function update() {
    const text = textarea.value
    const trimmed = text.trim()
    words.textContent = String(trimmed ? trimmed.split(/\\s+/).length : 0)
    characters.textContent = String(text.length)
    lines.textContent = String(text ? text.split(/\\n/).length : 0)
  }

  function onInput() {
    update()
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(function () {
      ctx.storage.set('draft', textarea.value)
    }, 250)
  }

  textarea.addEventListener('input', onInput)
  update()

  return function cleanup() {
    if (saveTimer) clearTimeout(saveTimer)
    textarea.removeEventListener('input', onInput)
  }
}
`

export async function installExampleTool(): Promise<InstallExampleResult> {
  const directory = await ensureToolsDirectory()
  const folder = join(directory, EXAMPLE_ID)

  try {
    await access(folder)
    return { installed: false, id: EXAMPLE_ID }
  } catch {
    // Folder does not exist yet — create it below.
  }

  await mkdir(folder, { recursive: true })
  await writeFile(
    join(folder, 'manifest.json'),
    `${JSON.stringify(EXAMPLE_MANIFEST, null, 2)}\n`,
    'utf8'
  )
  await writeFile(join(folder, 'index.js'), EXAMPLE_SOURCE, 'utf8')

  return { installed: true, id: EXAMPLE_ID }
}
