import { randomUUID } from 'node:crypto'
import { lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import type { KitFolder, KitLaunch, KitTarget, WorkspaceKit } from '../../shared/workspace-kits'

const KIT_LIMIT = 20
const TARGET_LIMIT = 12
const validId = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,100}$/.test(value)
type Shortcut = { id: string; name: string; enabled: boolean }
type Dependencies = {
  shortcuts: () => Promise<Shortcut[]>
  openFolder: (path: string) => Promise<void>
  openShortcut: (id: string) => Promise<unknown>
}

function validFolder(value: unknown): value is KitFolder {
  if (!value || typeof value !== 'object') return false
  const { id, path } = value as Partial<KitFolder>
  return validId(id) && typeof path === 'string' && isAbsolute(path)
}

function validKit(value: unknown): value is WorkspaceKit {
  if (!value || typeof value !== 'object') return false
  const { id, name, folders, shortcutIds } = value as Partial<WorkspaceKit>
  return validId(id) && typeof name === 'string' && name.trim().length > 0 && name.length <= 80 &&
    Array.isArray(folders) && folders.every(validFolder) && Array.isArray(shortcutIds) &&
    shortcutIds.every(validId) && folders.length + shortcutIds.length <= TARGET_LIMIT
}

export function createWorkspaceKits(storePath: string, deps: Dependencies) {
  const pendingFolders = new Map<string, KitFolder>()
  let writes = Promise.resolve()

  async function list(): Promise<WorkspaceKit[]> {
    try {
      const value = JSON.parse(await readFile(storePath, 'utf8'))
      if (!value || typeof value !== 'object' || value.version !== 1 || !Array.isArray(value.kits) || value.kits.length > KIT_LIMIT || !value.kits.every(validKit)) {
        throw new Error('Workspace kits could not be read. The saved data has an unsupported format.')
      }
      return value.kits
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw cause
    }
  }

  async function persist(kits: WorkspaceKit[]) {
    const temporary = `${storePath}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, JSON.stringify({ version: 1, kits }, null, 2), { flag: 'wx' })
      await rename(temporary, storePath)
    } finally {
      await unlink(temporary).catch(() => {})
    }
  }

  function change<T>(operation: () => Promise<T>): Promise<T> {
    const next = writes.then(operation)
    writes = next.then(() => {}, () => {})
    return next
  }

  async function get(id: unknown) {
    const kit = (await list()).find(item => item.id === id)
    if (!kit) throw new Error('Select a saved workspace kit.')
    return kit
  }

  async function targets(id: unknown) {
    const kit = await get(id)
    const shortcuts = kit.shortcutIds.length ? await deps.shortcuts().catch(() => null) : []
    const folders = await Promise.all(kit.folders.map(async ({ path }) => ({
      label: path,
      issue: (await lstat(path).catch(() => null))?.isDirectory() ? undefined : 'Folder unavailable',
      open: () => deps.openFolder(path)
    })))
    return folders.concat(kit.shortcutIds.map(shortcutId => {
      const shortcut = shortcuts?.find(item => item.id === shortcutId)
      let issue: string | undefined
      if (!shortcuts) issue = 'AI launchpad unavailable'
      else if (!shortcut) issue = 'Shortcut no longer exists'
      else if (!shortcut.enabled) issue = 'Disabled in AI launchpad'
      return { label: shortcut?.name ?? shortcutId, issue, open: async () => { await deps.openShortcut(shortcutId) } }
    }))
  }

  return {
    list,
    async addPickedFolder(path: string): Promise<KitFolder> {
      if (!isAbsolute(path) || !(await lstat(path)).isDirectory()) throw new Error('Select an available folder.')
      const existing = [...pendingFolders.values()].find(item => item.path === path)
      if (existing) return existing
      const folder = { id: randomUUID(), path }
      if (pendingFolders.size >= 100) pendingFolders.delete(pendingFolders.keys().next().value!)
      pendingFolders.set(folder.id, folder)
      return folder
    },
    save(input: unknown): Promise<WorkspaceKit> {
      return change(async () => {
        if (!input || typeof input !== 'object') throw new Error('Enter a kit name and select targets.')
        const { id, name, folderIds, shortcutIds } = input as Record<string, unknown>
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 ||
            !Array.isArray(folderIds) || !folderIds.every(validId) || !Array.isArray(shortcutIds) || !shortcutIds.every(validId) ||
            folderIds.length + shortcutIds.length < 1 || folderIds.length + shortcutIds.length > TARGET_LIMIT) {
          throw new Error('Enter a name and select between 1 and 12 targets.')
        }
        const kits = await list()
        const current = kits.find(kit => kit.id === id)
        if (id !== undefined && !current) throw new Error('That kit no longer exists.')
        if (!current && kits.length >= KIT_LIMIT) throw new Error('You can save up to 20 workspace kits.')
        const folders = [...new Set(folderIds)].map(folderId => {
          const folder = current?.folders.find(item => item.id === folderId) ?? pendingFolders.get(folderId)
          if (!folder) throw new Error('Select the folder again.')
          return folder
        })
        const options = shortcutIds.some(shortcutId => !current?.shortcutIds.includes(shortcutId)) ? await deps.shortcuts() : []
        const shortcuts = [...new Set(shortcutIds)]
        for (const shortcutId of shortcuts) {
          if (!current?.shortcutIds.includes(shortcutId) && !options.some(item => item.id === shortcutId && item.enabled)) {
            throw new Error('Select an enabled AI launchpad shortcut.')
          }
        }
        const kit = { id: current?.id ?? randomUUID(), name: name.trim(), folders, shortcutIds: shortcuts }
        await persist(current ? kits.map(item => item.id === current.id ? kit : item) : [...kits, kit])
        return kit
      })
    },
    remove(id: unknown): Promise<void> {
      return change(async () => {
        const kits = await list()
        if (kits.some(kit => kit.id === id)) await persist(kits.filter(kit => kit.id !== id))
      })
    },
    async inspect(id: unknown): Promise<KitTarget[]> {
      return (await targets(id)).map(({ label, issue }) => ({ label, issue }))
    },
    async open(id: unknown): Promise<KitLaunch[]> {
      const result: KitLaunch[] = []
      for (const target of await targets(id)) {
        const { label, issue } = target
        if (issue) { result.push({ label, issue, opened: false }); continue }
        try {
          await target.open()
          result.push({ label, opened: true })
        } catch {
          result.push({ label, issue: 'Could not open this item', opened: false })
        }
      }
      return result
    }
  }
}
