import { contextBridge, ipcRenderer } from 'electron'
import type {
  ArtistWaveStatus,
  GitHubStatus,
  MailStatus,
  ModelFarmDownload,
  ToolboxApi
} from '../shared/types'

const api: ToolboxApi = {
  integration: {status:()=>ipcRenderer.invoke('integration:status')},
  aiMonitor: {check:input=>ipcRenderer.invoke('ai-monitor:check',input)},
  configuration: { services:names=>ipcRenderer.invoke('configuration:services',names) },
  diskExplorer: {pickFolder:()=>ipcRenderer.invoke('disk-explorer:pick-folder'),scan:path=>ipcRenderer.invoke('disk-explorer:scan',path),capacity:path=>ipcRenderer.invoke('disk-explorer:capacity',path)},
  downloadsInbox: {
    refresh: () => ipcRenderer.invoke('downloads-inbox:refresh'),
    pick: () => ipcRenderer.invoke('downloads-inbox:pick'),
    reveal: name => ipcRenderer.invoke('downloads-inbox:reveal', name)
  },
  fileVerification: {
    pick: () => ipcRenderer.invoke('file-verification:pick'),
    run: id => ipcRenderer.invoke('file-verification:run', id),
    progress: id => ipcRenderer.invoke('file-verification:progress', id),
    cancel: id => ipcRenderer.invoke('file-verification:cancel', id)
  },
  workspaceKits: {
    list: () => ipcRenderer.invoke('workspace-kits:list'),
    pickFolder: () => ipcRenderer.invoke('workspace-kits:pick-folder'),
    save: input => ipcRenderer.invoke('workspace-kits:save', input),
    remove: id => ipcRenderer.invoke('workspace-kits:remove', id),
    inspect: id => ipcRenderer.invoke('workspace-kits:inspect', id),
    open: id => ipcRenderer.invoke('workspace-kits:open', id)
  },
  powerBattery: { read: () => ipcRenderer.invoke('power-battery:read') },
  reminders: {list:()=>ipcRenderer.invoke('reminders:list'),add:input=>ipcRenderer.invoke('reminders:add',input),remove:id=>ipcRenderer.invoke('reminders:remove',id)},
  projects: { pickFolder: () => ipcRenderer.invoke('projects:pick-folder'), list: path => ipcRenderer.invoke('projects:list', path), fetch:path => ipcRenderer.invoke('projects:fetch',path) },
  diagnostics: { run: input => ipcRenderer.invoke('diagnostics:run', input), incident: includeEvents => ipcRenderer.invoke('diagnostics:incident', includeEvents), emailDraft: input => ipcRenderer.invoke('diagnostics:email-draft', input), sendEmail: input => ipcRenderer.invoke('diagnostics:send-email', input) },
  appWindow: {
    setCompact: (compact, width) => ipcRenderer.invoke('window:set-compact', compact, width),
    setPlayerMini: (active, width) => ipcRenderer.invoke('window:set-player-mini', active, width),
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
    setWatchlist: (ids) => ipcRenderer.invoke('markets:set-watchlist', ids),
    series: (id, days) => ipcRenderer.invoke('markets:series', id, days)
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
    setMini: (active) => ipcRenderer.invoke('artistwave:set-mini', active),
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
    restore: (input) => ipcRenderer.invoke('backup:restore', input),
    verify: (input) => ipcRenderer.invoke('backup:verify', input)
  },
  updates: {
    version: () => ipcRenderer.invoke('updates:version'),
    check: (source) => ipcRenderer.invoke('updates:check', source),
    open: (url) => ipcRenderer.invoke('updates:open', url)
  },
  shortcuts: {
    status: () => ipcRenderer.invoke('shortcuts:status'),
    toggle: (id, enabled) => ipcRenderer.invoke('shortcuts:toggle', id, enabled),
    add: (input) => ipcRenderer.invoke('shortcuts:add', input),
    remove: (id) => ipcRenderer.invoke('shortcuts:remove', id),
    rescan: () => ipcRenderer.invoke('shortcuts:rescan'),
    open: (id) => ipcRenderer.invoke('shortcuts:open', id)
  },
  modelFarm: {
    status: (forceDetect) => ipcRenderer.invoke('modelfarm:status', forceDetect),
    catalog: (forceRefresh) => ipcRenderer.invoke('modelfarm:catalog', forceRefresh),
    score: (input) => ipcRenderer.invoke('modelfarm:score', input),
    search: (query, scenario) => ipcRenderer.invoke('modelfarm:search', query, scenario),
    quants: (repo) => ipcRenderer.invoke('modelfarm:quants', repo),
    prefs: () => ipcRenderer.invoke('modelfarm:prefs'),
    setPrefs: (input) => ipcRenderer.invoke('modelfarm:set-prefs', input),
    install: (input) => ipcRenderer.invoke('modelfarm:install', input),
    remove: (input) => ipcRenderer.invoke('modelfarm:remove', input),
    downloads: () => ipcRenderer.invoke('modelfarm:downloads'),
    onProgress: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: ModelFarmDownload[]) =>
        listener(payload)
      ipcRenderer.on('modelfarm:progress', handler)
      return () => ipcRenderer.removeListener('modelfarm:progress', handler)
    },
    refresh: () => ipcRenderer.invoke('modelfarm:refresh')
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('api', api)
