import { contextBridge, ipcRenderer } from 'electron'
import type { ArtistWaveStatus, GitHubStatus, MailStatus, ToolboxApi } from '../shared/types'

const api: ToolboxApi = {
  appWindow: {
    setCompact: (compact, width) => ipcRenderer.invoke('window:set-compact', compact, width),
    setAlwaysOnTop: (value) => ipcRenderer.invoke('window:set-always-on-top', value)
  },
  clipboard: {
    list: () => ipcRenderer.invoke('clipboard:list'),
    copy: (text) => ipcRenderer.invoke('clipboard:copy', text),
    clear: () => ipcRenderer.invoke('clipboard:clear')
  },
  vault: {
    list: () => ipcRenderer.invoke('vault:list'),
    add: (input) => ipcRenderer.invoke('vault:add', input),
    copy: (id) => ipcRenderer.invoke('vault:copy', id),
    remove: (id) => ipcRenderer.invoke('vault:remove', id)
  },
  userTools: {
    list: () => ipcRenderer.invoke('user-tools:list'),
    code: (id) => ipcRenderer.invoke('user-tools:code', id),
    openFolder: () => ipcRenderer.invoke('user-tools:open-folder'),
    installExample: () => ipcRenderer.invoke('user-tools:install-example')
  },
  system: {
    stats: () => ipcRenderer.invoke('system:stats'),
    processes: () => ipcRenderer.invoke('system:processes')
  },
  files: {
    pickFolder: () => ipcRenderer.invoke('files:pick-folder'),
    list: (dir) => ipcRenderer.invoke('files:list', dir),
    organize: (dir) => ipcRenderer.invoke('files:organize', dir)
  },
  weather: {
    search: (query) => ipcRenderer.invoke('weather:search', query),
    current: (city) => ipcRenderer.invoke('weather:current', city)
  },
  mail: {
    status: () => ipcRenderer.invoke('mail:status'),
    connect: (input) => ipcRenderer.invoke('mail:connect', input),
    disconnect: () => ipcRenderer.invoke('mail:disconnect'),
    check: () => ipcRenderer.invoke('mail:check'),
    setNotifications: (enabled) => ipcRenderer.invoke('mail:set-notifications', enabled),
    onUpdate: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: MailStatus) => listener(payload)
      ipcRenderer.on('mail:update', handler)
      return () => ipcRenderer.removeListener('mail:update', handler)
    }
  },
  github: {
    status: () => ipcRenderer.invoke('github:status'),
    connect: (input) => ipcRenderer.invoke('github:connect', input),
    disconnect: () => ipcRenderer.invoke('github:disconnect'),
    check: () => ipcRenderer.invoke('github:check'),
    setNotifications: (enabled) => ipcRenderer.invoke('github:set-notifications', enabled),
    markRead: (id) => ipcRenderer.invoke('github:mark-read', id),
    markAllRead: () => ipcRenderer.invoke('github:mark-all-read'),
    openThread: (url) => ipcRenderer.invoke('github:open-thread', url),
    onUpdate: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: GitHubStatus) => listener(payload)
      ipcRenderer.on('github:update', handler)
      return () => ipcRenderer.removeListener('github:update', handler)
    }
  },
  feeds: {
    status: () => ipcRenderer.invoke('feeds:status'),
    add: (url) => ipcRenderer.invoke('feeds:add', url),
    remove: (id) => ipcRenderer.invoke('feeds:remove', id),
    refresh: () => ipcRenderer.invoke('feeds:refresh'),
    openItem: (url) => ipcRenderer.invoke('feeds:open-item', url)
  },
  markets: {
    status: () => ipcRenderer.invoke('markets:status'),
    refresh: () => ipcRenderer.invoke('markets:refresh'),
    setWatchlist: (ids) => ipcRenderer.invoke('markets:set-watchlist', ids)
  },
  bartender: {
    status: () => ipcRenderer.invoke('bartender:status'),
    load: () => ipcRenderer.invoke('bartender:load'),
    match: (ids) => ipcRenderer.invoke('bartender:match', ids),
    openSource: (url) => ipcRenderer.invoke('bartender:open-source', url)
  },
  artistwave: {
    status: () => ipcRenderer.invoke('artistwave:status'),
    attach: () => ipcRenderer.invoke('artistwave:attach'),
    detach: () => ipcRenderer.invoke('artistwave:detach'),
    setVisible: (visible) => ipcRenderer.invoke('artistwave:set-visible', visible),
    command: (action, value) => ipcRenderer.invoke('artistwave:command', action, value),
    onUpdate: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: ArtistWaveStatus) =>
        listener(payload)
      ipcRenderer.on('artistwave:update', handler)
      return () => ipcRenderer.removeListener('artistwave:update', handler)
    }
  },
  backup: {
    locations: () => ipcRenderer.invoke('backup:locations'),
    pickFolder: () => ipcRenderer.invoke('backup:pick-folder'),
    pickFile: () => ipcRenderer.invoke('backup:pick-file'),
    openFolder: (path) => ipcRenderer.invoke('backup:open-folder', path),
    list: (destination) => ipcRenderer.invoke('backup:list', destination),
    create: (input) => ipcRenderer.invoke('backup:create', input),
    restore: (input) => ipcRenderer.invoke('backup:restore', input)
  },
  updates: {
    version: () => ipcRenderer.invoke('updates:version'),
    check: (source) => ipcRenderer.invoke('updates:check', source),
    open: (url) => ipcRenderer.invoke('updates:open', url)
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('api', api)
