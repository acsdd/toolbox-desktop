import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { lstat, realpath } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { categorize } from './file-organizer'
import { getShortcutStatus, openShortcut } from './shortcuts'
import { hashSelectedFile, listInbox, revealInboxEntry } from './widget-files'
import { createWorkspaceKits } from './workspace-kits'
import { getPowerBattery } from './power-battery'
import type { InboxSnapshot, VerificationFile, VerificationProgress } from '../../shared/widget-files'

type InboxSession = { folder: string; snapshot?: InboxSnapshot; request: number }
type VerificationSelection = {
  path: string
  file: VerificationFile
  job?: { controller: AbortController; progress: VerificationProgress }
}

export function registerDesktopWidgetIpc(rendererUrl: string) {
  const inboxes = new WeakMap<WebContents, InboxSession>()
  const files = new WeakMap<WebContents, VerificationSelection>()
  const trustedUrl = new URL(rendererUrl).href.split('#', 1)[0]

  function owner(event: IpcMainInvokeEvent) {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || event.senderFrame !== event.sender.mainFrame || event.senderFrame?.url.split('#', 1)[0] !== trustedUrl) {
      throw new Error('Open the widget from Toolbox Desktop.')
    }
    return win
  }

  const kits = createWorkspaceKits(join(app.getPath('userData'), 'workspace-kits.json'), {
    shortcuts: async () => (await getShortcutStatus()).items,
    async openFolder(path) {
      const error = await shell.openPath(path)
      if (error) throw new Error(error)
    },
    openShortcut
  })

  async function readInbox(sender: WebContents, folder?: string) {
    let inbox = inboxes.get(sender)
    if (folder || !inbox) {
      inbox = { folder: folder ?? app.getPath('downloads'), request: 0 }
      inboxes.set(sender, inbox)
    }
    const request = ++inbox.request
    inbox.snapshot = undefined
    const snapshot = await listInbox(inbox.folder, categorize)
    if (inboxes.get(sender) !== inbox || request !== inbox.request) throw new Error('The inbox location changed. Refresh the current folder.')
    inbox.snapshot = snapshot
    return snapshot
  }

  ipcMain.handle('downloads-inbox:refresh', event => {
    owner(event)
    return readInbox(event.sender)
  })
  ipcMain.handle('downloads-inbox:pick', async event => {
    const result = await dialog.showOpenDialog(owner(event), { title: 'Choose an inbox folder', properties: ['openDirectory'] })
    return result.canceled || !result.filePaths[0] ? null : readInbox(event.sender, await realpath(result.filePaths[0]))
  })
  ipcMain.handle('downloads-inbox:reveal', async (event, name: unknown) => {
    owner(event)
    const inbox = inboxes.get(event.sender)
    const snapshot = inbox?.snapshot
    if (!inbox || !snapshot) throw new Error('Refresh the inbox before revealing this file.')
    const target = await revealInboxEntry(inbox.folder, snapshot, name)
    if (inboxes.get(event.sender) !== inbox || inbox.snapshot !== snapshot) throw new Error('Refresh the current inbox folder.')
    shell.showItemInFolder(target)
  })

  ipcMain.handle('file-verification:pick', async event => {
    const win = owner(event)
    if (files.get(event.sender)?.job) throw new Error('Cancel verification before choosing another file.')
    const result = await dialog.showOpenDialog(win, { title: 'Choose a file to verify', properties: ['openFile'] })
    const path = result.filePaths[0]
    if (result.canceled || !path) return null
    const info = await lstat(path)
    if (!info.isFile()) throw new Error('Choose a regular file to verify.')
    if (files.get(event.sender)?.job) throw new Error('Cancel verification before choosing another file.')
    const file = { id: randomUUID(), name: basename(path), size: info.size }
    files.set(event.sender, { path, file })
    return file
  })
  ipcMain.handle('file-verification:run', async (event, id: unknown) => {
    owner(event)
    const selection = files.get(event.sender)
    if (!selection || selection.file.id !== id) throw new Error('Choose the file again.')
    if (selection.job) throw new Error('Verification is already running.')
    const job = { controller: new AbortController(), progress: { bytes: 0, total: selection.file.size } }
    selection.job = job
    const destroy = () => job.controller.abort()
    const navigate = (details: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>) => {
      if (details.isMainFrame && !details.isSameDocument) job.controller.abort()
    }
    event.sender.once('destroyed', destroy)
    event.sender.on('did-start-navigation', navigate)
    try {
      return await hashSelectedFile(selection.path, job.controller.signal, (bytes, total) => { job.progress = { bytes, total } })
    } catch (cause) {
      if (job.controller.signal.aborted) return null
      throw cause
    } finally {
      event.sender.removeListener('destroyed', destroy)
      event.sender.removeListener('did-start-navigation', navigate)
      selection.job = undefined
    }
  })
  ipcMain.handle('file-verification:progress', (event, id: unknown) => {
    owner(event)
    const selection = files.get(event.sender)
    return selection?.file.id === id ? selection?.job?.progress ?? null : null
  })
  ipcMain.handle('file-verification:cancel', (event, id: unknown) => {
    owner(event)
    const selection = files.get(event.sender)
    if (selection?.file.id === id) selection?.job?.controller.abort()
  })

  ipcMain.handle('workspace-kits:list', event => { owner(event); return kits.list() })
  ipcMain.handle('workspace-kits:pick-folder', async event => {
    const result = await dialog.showOpenDialog(owner(event), { title: 'Choose a workspace folder', properties: ['openDirectory'] })
    return result.canceled || !result.filePaths[0] ? null : kits.addPickedFolder(await realpath(result.filePaths[0]))
  })
  ipcMain.handle('workspace-kits:save', (event, input: unknown) => { owner(event); return kits.save(input) })
  ipcMain.handle('workspace-kits:remove', (event, id: unknown) => { owner(event); return kits.remove(id) })
  ipcMain.handle('workspace-kits:inspect', (event, id: unknown) => { owner(event); return kits.inspect(id) })
  ipcMain.handle('workspace-kits:open', (event, id: unknown) => { owner(event); return kits.open(id) })
  ipcMain.handle('power-battery:read', event => { owner(event); return getPowerBattery() })
}
