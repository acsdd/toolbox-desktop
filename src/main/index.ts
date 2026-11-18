import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron'
import { join } from 'node:path'
import { clipboardHistory } from './services/clipboard-history'
import { getProcesses, getSystemStats } from './services/system-info'
import { listFiles, organizeFolder } from './services/file-organizer'
import { addSecret, copySecret, listSecrets, removeSecret } from './services/vault'
import {
  createBackup,
  listBackupLocations,
  listBackups,
  openBackupFolder,
  restoreBackup
} from './services/backup'
import {
  getUserToolCode,
  installExampleTool,
  openUserToolsFolder,
  scanUserTools
} from './services/user-tools'
import { getCurrentWeather, searchWeatherCities } from './services/weather'
import {
  checkMail,
  connectMail,
  disconnectMail,
  getMailStatus,
  initMail,
  setMailNotifications,
  stopMail
} from './services/mail'
import {
  checkGitHub,
  connectGitHub,
  disconnectGitHub,
  getGitHubStatus,
  initGitHub,
  markAllGitHubRead,
  markGitHubThreadRead,
  openGitHubThread,
  setGitHubNotifications,
  stopGitHub
} from './services/github'
import { addFeed, getFeedStatus, initFeeds, openFeedItem, refreshFeeds, removeFeed } from './services/feeds'
import { getMarketSeries, getMarketStatus, initMarkets, refreshMarkets, setMarketWatchlist } from './services/markets'
import {
  getBartenderStatus,
  initBartender,
  loadBartenderIngredients,
  matchBartenderCocktails,
  openBartenderSource
} from './services/bartender'
import {
  attachArtistWave,
  commandArtistWave,
  detachArtistWave,
  getArtistWaveStatus,
  isArtistWaveMiniUrl,
  requestArtistWaveMini,
  setArtistWaveMini,
  setArtistWaveVisible,
  stopArtistWave
} from './services/artistwave'
import {
  getModelFarmCatalog,
  getModelFarmDownloads,
  getModelFarmQuants,
  getModelFarmStatus,
  installModelFarm,
  loadModelFarmPrefs,
  refreshModelFarm,
  removeModelFarmModel,
  scoreModelFarm,
  searchModelFarm,
  setModelFarmPrefs
} from './services/model-farm'
import { checkForUpdate, getAppVersion, openUpdatePage } from './services/updates'
import {
  addShortcut,
  getShortcutStatus,
  initShortcuts,
  openShortcut,
  removeShortcut,
  rescanShortcuts,
  toggleShortcut
} from './services/shortcuts'

let restoreBounds: { bounds: Electron.Rectangle; maximized: boolean } | null = null
let playerMiniRestore: { bounds: Electron.Rectangle; maximized: boolean } | null = null

function setPlayerMiniWindow(window: BrowserWindow, active: boolean, width?: unknown): void {
  if (active) {
    if (!playerMiniRestore) {
      playerMiniRestore = { bounds: window.getBounds(), maximized: window.isMaximized() }
    }
    if (window.isMaximized()) window.unmaximize()

    const display = screen.getDisplayMatching(window.getBounds())
    const work = display.workArea
    // A plain mini player is narrow; the widget host glues a widget screen and
    // a vertical tool rail beside it, so the renderer asks for a wider window.
    const requested = typeof width === 'number' && Number.isFinite(width) ? width : 380
    const host = requested > 480
    const finalWidth = Math.min(Math.max(Math.round(requested), 320), work.width - 24)
    const height = Math.min(work.height, playerMiniRestore.bounds.height)
    const x = Math.max(work.x, work.x + work.width - finalWidth - 26)

    window.setResizable(true)
    window.setMaximizable(false)
    window.setMinimumSize(host ? 560 : 320, 480)
    window.setBounds({ x, y: work.y, width: finalWidth, height })
    window.setTitle(host ? 'Toolbox widgets' : 'ArtistWave mini player')
    return
  }

  window.setResizable(true)
  window.setMaximizable(true)
  window.setMinimumSize(940, 620)
  window.setTitle('Toolbox')

  if (playerMiniRestore) {
    const { bounds, maximized } = playerMiniRestore
    playerMiniRestore = null
    window.setBounds(bounds)
    if (maximized) window.maximize()
  }
}

function setCompactWindow(window: BrowserWindow, compact: boolean, width: unknown): void {
  if (compact) {
    if (!restoreBounds) {
      restoreBounds = { bounds: window.getBounds(), maximized: window.isMaximized() }
    }
    if (window.isMaximized()) window.unmaximize()

    const display = screen.getDisplayMatching(window.getBounds())
    const requested = typeof width === 'number' && Number.isFinite(width) ? width : 560
    const contentWidth = Math.min(
      Math.max(Math.round(requested), 360),
      display.workAreaSize.width - 24
    )

    window.setMinimumSize(320, 72)
    window.setContentSize(contentWidth, 60, true)
    window.setResizable(false)
    return
  }

  window.setResizable(true)
  window.setMinimumSize(940, 620)

  if (restoreBounds) {
    const { bounds, maximized } = restoreBounds
    restoreBounds = null
    window.setBounds(bounds, true)
    if (maximized) window.maximize()
  }
}

function registerIpc(): void {
  ipcMain.handle('window:set-compact', (event, compact: unknown, width: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    setCompactWindow(window, compact === true, width)
  })

  ipcMain.handle('window:set-player-mini', (event, active: unknown, width: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    setPlayerMiniWindow(window, active === true, width)
  })

  ipcMain.handle('window:set-always-on-top', (event, value: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return false
    window.setAlwaysOnTop(value === true)
    return window.isAlwaysOnTop()
  })

  ipcMain.handle('clipboard:list', () => clipboardHistory.list())

  ipcMain.handle('clipboard:copy', async (_event, text: unknown) => {
    if (typeof text !== 'string') throw new Error('Clipboard text must be a string.')
    await clipboardHistory.copy(text)
  })

  ipcMain.handle('clipboard:clear', () => clipboardHistory.clear())

  ipcMain.handle('vault:list', () => listSecrets())
  ipcMain.handle('vault:add', (_event, input: unknown) => addSecret(input))
  ipcMain.handle('vault:copy', (_event, id: unknown) => copySecret(id))
  ipcMain.handle('vault:remove', (_event, id: unknown) => removeSecret(id))

  ipcMain.handle('user-tools:list', () => scanUserTools())
  ipcMain.handle('user-tools:code', (_event, id: unknown) => getUserToolCode(id))
  ipcMain.handle('user-tools:open-folder', () => openUserToolsFolder())
  ipcMain.handle('user-tools:install-example', () => installExampleTool())

  ipcMain.handle('system:stats', () => getSystemStats())
  ipcMain.handle('system:processes', () => getProcesses())

  ipcMain.handle('files:pick-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a folder to organize',
      buttonLabel: 'Select folder',
      properties: ['openDirectory']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('files:list', (_event, dir: unknown) => listFiles(dir))
  ipcMain.handle('files:organize', (_event, dir: unknown) => organizeFolder(dir))

  ipcMain.handle('backup:locations', () => listBackupLocations())

  ipcMain.handle('backup:pick-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a backup folder',
      buttonLabel: 'Use this folder',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('backup:pick-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose an encrypted backup',
      buttonLabel: 'Open backup',
      properties: ['openFile'],
      filters: [
        { name: 'Toolbox encrypted backup', extensions: ['tbx'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('backup:open-folder', (_event, destination: unknown) =>
    openBackupFolder(destination)
  )
  ipcMain.handle('backup:list', (_event, destination: unknown) => listBackups(destination))
  ipcMain.handle('backup:create', (_event, input: unknown) => createBackup(input))
  ipcMain.handle('backup:restore', (_event, input: unknown) => restoreBackup(input))

  ipcMain.handle('weather:search', (_event, query: unknown) => searchWeatherCities(query))
  ipcMain.handle('weather:current', (_event, city: unknown) => getCurrentWeather(city))

  ipcMain.handle('mail:status', () => getMailStatus())
  ipcMain.handle('mail:connect', (_event, input: unknown) => connectMail(input))
  ipcMain.handle('mail:disconnect', () => disconnectMail())
  ipcMain.handle('mail:check', () => checkMail())
  ipcMain.handle('mail:set-notifications', (_event, enabled: unknown) =>
    setMailNotifications(enabled)
  )

  ipcMain.handle('github:status', () => getGitHubStatus())
  ipcMain.handle('github:connect', (_event, input: unknown) => connectGitHub(input))
  ipcMain.handle('github:disconnect', () => disconnectGitHub())
  ipcMain.handle('github:check', () => checkGitHub())
  ipcMain.handle('github:set-notifications', (_event, enabled: unknown) =>
    setGitHubNotifications(enabled)
  )
  ipcMain.handle('github:mark-read', (_event, id: unknown) => markGitHubThreadRead(id))
  ipcMain.handle('github:mark-all-read', () => markAllGitHubRead())
  ipcMain.handle('github:open-thread', (_event, url: unknown) => openGitHubThread(url))

  ipcMain.handle('feeds:status', () => getFeedStatus())
  ipcMain.handle('feeds:add', (_event, url: unknown) => addFeed(url))
  ipcMain.handle('feeds:remove', (_event, id: unknown) => removeFeed(id))
  ipcMain.handle('feeds:refresh', () => refreshFeeds())
  ipcMain.handle('feeds:open-item', (_event, url: unknown) => openFeedItem(url))

  ipcMain.handle('markets:status', () => getMarketStatus())
  ipcMain.handle('markets:refresh', () => refreshMarkets())
  ipcMain.handle('markets:set-watchlist', (_event, ids: unknown) => setMarketWatchlist(ids))
  ipcMain.handle('markets:series', (_event, id: unknown, days: unknown) => getMarketSeries(id, days))

  ipcMain.handle('bartender:status', async () => {
    await initBartender()
    return getBartenderStatus()
  })
  ipcMain.handle('bartender:load', () => loadBartenderIngredients())
  ipcMain.handle('bartender:match', (_event, ids: unknown) => matchBartenderCocktails(ids))
  ipcMain.handle('bartender:open-source', (_event, url: unknown) => openBartenderSource(url))

  ipcMain.handle('artistwave:status', () => getArtistWaveStatus())
  ipcMain.handle('artistwave:attach', (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!owner) throw new Error('The ArtistWave player needs an app window.')
    return attachArtistWave(owner)
  })
  ipcMain.handle('artistwave:detach', () => detachArtistWave())
  ipcMain.handle('artistwave:set-visible', (_event, visible: unknown) =>
    setArtistWaveVisible(visible === true)
  )
  ipcMain.handle('artistwave:command', (_event, action: unknown, value: unknown) =>
    commandArtistWave(action, value)
  )
  ipcMain.handle('artistwave:set-mini', (_event, active: unknown) => setArtistWaveMini(active))

  ipcMain.handle('modelfarm:status', (_event, forceDetect: unknown) =>
    getModelFarmStatus(forceDetect === true)
  )
  ipcMain.handle('modelfarm:catalog', (_event, forceRefresh: unknown) =>
    getModelFarmCatalog(forceRefresh === true)
  )
  ipcMain.handle('modelfarm:score', (_event, input: unknown) => scoreModelFarm(input as never))
  ipcMain.handle('modelfarm:search', (_event, query: unknown, scenario: unknown) =>
    searchModelFarm(typeof query === 'string' ? query : '', scenario as never)
  )
  ipcMain.handle('modelfarm:quants', (_event, repo: unknown) =>
    getModelFarmQuants(typeof repo === 'string' ? repo : '')
  )
  ipcMain.handle('modelfarm:prefs', () => loadModelFarmPrefs())
  ipcMain.handle('modelfarm:set-prefs', (_event, input: unknown) => setModelFarmPrefs(input as never))
  ipcMain.handle('modelfarm:install', (_event, input: unknown) => installModelFarm(input as never))
  ipcMain.handle('modelfarm:remove', (_event, input: unknown) => removeModelFarmModel(input as never))
  ipcMain.handle('modelfarm:downloads', () => getModelFarmDownloads())
  ipcMain.handle('modelfarm:refresh', () => refreshModelFarm())

  ipcMain.handle('updates:version', () => getAppVersion())
  ipcMain.handle('updates:check', (_event, source: unknown) => checkForUpdate(source))
  ipcMain.handle('updates:open', (_event, url: unknown) => openUpdatePage(url))

  ipcMain.handle('shortcuts:status', () => getShortcutStatus())
  ipcMain.handle('shortcuts:toggle', (_event, id: unknown, enabled: unknown) =>
    toggleShortcut(id, enabled)
  )
  ipcMain.handle('shortcuts:add', (_event, input: unknown) => addShortcut(input))
  ipcMain.handle('shortcuts:remove', (_event, id: unknown) => removeShortcut(id))
  ipcMain.handle('shortcuts:rescan', () => rescanShortcuts())
  ipcMain.handle('shortcuts:open', (_event, id: unknown) => openShortcut(id))
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 940,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0c10',
    title: 'Toolbox',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // The embedded player keeps its queue and audio running while you browse
      // other pages, so do not let Chromium throttle the hidden page.
      backgroundThrottling: false
    }
  })

  window.on('ready-to-show', () => window.show())

  // ArtistWave runs embedded. Its own mini-player button should shrink this
  // window instead of spawning a browser popup; every other popup opens in the
  // system browser so the app stays a single window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isArtistWaveMiniUrl(url)) {
      requestArtistWaveMini()
      return { action: 'deny' }
    }
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  window.on('closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.alpha.toolbox')
  clipboardHistory.start()
  registerIpc()
  createWindow()
  void initMail()
  void initGitHub()
  void initFeeds()
  void initMarkets()
  void initBartender()
  void initShortcuts()
  void loadModelFarmPrefs()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  clipboardHistory.stop()
  stopMail()
  stopGitHub()
  stopArtistWave()
})
