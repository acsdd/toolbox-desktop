/**
 * End-to-end smoke test for the production build.
 *
 * Boots the real built main process with an isolated userData folder, drives the
 * renderer, and verifies each tool plus the security-sensitive vault behaviour.
 * Run with: npm run smoke
 */
const { app, BrowserWindow, clipboard } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const packageJson = require('../package.json')

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolbox-smoke-userdata-'))
app.setPath('userData', userDataDir)

fs.writeFileSync(
  path.join(userDataDir, 'bartender.json'),
  JSON.stringify({
    version: 1,
    ingredients: [
      { id: 3, name: 'Tequila', category: 'Spirit' },
      { id: 5, name: 'Triple Sec', category: 'Liqueur' },
      { id: 4, name: 'Lime Juice', category: 'Mixer' }
    ],
    selectedIds: [3, 5],
    lastLoaded: 1700000000000
  })
)

const fileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolbox-smoke-files-'))
fs.writeFileSync(path.join(fileDir, 'note.txt'), 'smoke')
fs.writeFileSync(path.join(fileDir, 'image.png'), 'smoke')
fs.mkdirSync(path.join(fileDir, 'nested'))

const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolbox-smoke-backup-'))

require('../out/main/index.js')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const consoleErrors = []

async function waitForWindow(timeoutMs = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.webContents.isLoading()) {
        await new Promise((resolve) => win.webContents.once('did-finish-load', resolve))
      }
      return win
    }
    await delay(150)
  }
  throw new Error('No BrowserWindow appeared within the timeout.')
}

async function main() {
  await app.whenReady()
  const originalClipboard = await clipboard.readText().catch(() => '')
  const win = await waitForWindow()
  win.hide()

  win.webContents.on('console-message', (event, ...args) => {
    const details = args[0]
    if (details && typeof details === 'object') {
      if (details.level === 'error') consoleErrors.push(String(details.message))
    } else if (args[0] === 3) {
      consoleErrors.push(String(args[1]))
    }
  })

  await delay(700)

  const ui = await win.webContents.executeJavaScript(`(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    window.__smokeErrors = []
    window.addEventListener('error', (event) => window.__smokeErrors.push('error: ' + event.message))
    window.addEventListener('unhandledrejection', (event) => window.__smokeErrors.push('rejection: ' + event.reason))

    const result = {}
    result.apiAvailable = typeof window.api === 'object' && typeof window.api.vault?.add === 'function'

    const cards = [...document.querySelectorAll('.tool-card')].filter(
      (card) => !card.classList.contains('tool-card-loading')
    )
    result.cardCount = cards.length
    result.cardNames = cards.map((card) => card.querySelector('h3')?.textContent ?? '')

    result.toolChecks = []
    for (let index = 0; index < cards.length; index++) {
      document.querySelectorAll('.tool-card')[index].click()
      await delay(500)
      const surface = document.querySelector('.tool-surface')
      result.toolChecks.push({
        name: result.cardNames[index],
        rendered: Boolean(surface),
        textLength: (surface?.textContent ?? '').length
      })
      document.querySelector('.back-button')?.click()
      await delay(250)
    }

    const backupCard = [...document.querySelectorAll('.tool-card')].find(
      (card) => card.querySelector('h3')?.textContent === 'Encrypted backup'
    )
    if (backupCard) {
      backupCard.click()
      await delay(900)
      result.backupUi = {
        badge: Boolean(document.querySelector('.backup-badge')),
        panels: document.querySelectorAll('.backup-panel').length,
        passwordFields: document.querySelectorAll('.backup-fields input[type="password"]').length,
        locationChips: document.querySelectorAll('.location-chip').length,
        hasFolderPath: Boolean(document.querySelector('.backup-path-row .path-chip'))
      }
      document.querySelector('.back-button')?.click()
      await delay(300)
    } else {
      result.backupUi = { badge: false, panels: 0, passwordFields: 0, locationChips: 0 }
    }

    document.querySelector('.settings-toggle').click()
    await delay(350)
    const switchCount = document.querySelectorAll('.switch').length
    document.querySelector('[aria-label="Enable Quick notes"]')?.click()
    await delay(250)
    document.querySelector('.back-button').click()
    await delay(400)
    const afterDisable = [...document.querySelectorAll('.tool-card h3')].map((node) => node.textContent)

    document.querySelector('.settings-toggle').click()
    await delay(350)
    document.querySelector('[aria-label="Enable Quick notes"]')?.click()
    await delay(250)
    document.querySelector('.back-button').click()
    await delay(400)
    const afterEnable = [...document.querySelectorAll('.tool-card h3')].map((node) => node.textContent)

    result.customization = {
      switchCount,
      afterDisableCount: afterDisable.length,
      hiddenName: !afterDisable.includes('Quick notes'),
      afterEnableCount: afterEnable.length,
      restored: afterEnable.includes('Quick notes')
    }

    await window.api.clipboard.clear()
    await window.api.clipboard.copy('smoke clipboard text')
    const clipItems = await window.api.clipboard.list()
    result.clipboard = {
      count: clipItems.length,
      hasCopied: clipItems.some((item) => item.text === 'smoke clipboard text')
    }
    await window.api.clipboard.clear()

    const stats = await window.api.system.stats()
    result.system = {
      memTotal: stats.memTotal,
      cpuPercent: stats.cpuPercent,
      diskTotal: stats.diskTotal,
      hostname: stats.hostname
    }
    result.processCount = (await window.api.system.processes()).length

    const vaultBefore = await window.api.vault.list()
    const created = await window.api.vault.add({
      name: 'Smoke test key',
      value: 'smoke-secret-value',
      notes: 'temporary'
    })
    const vaultAfterAdd = await window.api.vault.list()
    await window.api.vault.copy(created.id)
    const clipAfterVault = await window.api.clipboard.list()
    await delay(1200)
    const clipAfterWait = await window.api.clipboard.list()

    result.vault = {
      before: vaultBefore.length,
      afterAdd: vaultAfterAdd.length,
      created,
      entryShapeOk:
        typeof created.id === 'string' &&
        !Object.prototype.hasOwnProperty.call(created, 'value') &&
        !Object.prototype.hasOwnProperty.call(created, 'secret'),
      secretInHistory:
        clipAfterVault.some((item) => item.text.includes('smoke-secret-value')) ||
        clipAfterWait.some((item) => item.text.includes('smoke-secret-value'))
    }

    const backupBefore = await window.api.vault.list()
    let shortPasswordRejected = false
    try {
      await window.api.backup.create({
        destination: ${JSON.stringify(backupDir)},
        password: 'short',
        config: { disabled: [], pinned: false }
      })
    } catch {
      shortPasswordRejected = true
    }

    const backupCreated = await window.api.backup.create({
      destination: ${JSON.stringify(backupDir)},
      password: 'smoke-backup-password',
      config: { disabled: ['system'], pinned: true, cardSize: 'large' }
    })
    const backupsListed = await window.api.backup.list(${JSON.stringify(backupDir)})

    const restoreProbe = await window.api.vault.add({
      name: 'Restore probe',
      value: 'restore-secret-value',
      notes: 'should disappear after restore'
    })

    let wrongPasswordRejected = false
    let wrongPasswordMessage = ''
    try {
      await window.api.backup.restore({
        file: backupCreated.file,
        password: 'wrong-password'
      })
    } catch (cause) {
      wrongPasswordMessage = String(cause?.message ?? cause)
      wrongPasswordRejected = /Incorrect password/.test(wrongPasswordMessage)
    }
    const vaultAfterWrong = await window.api.vault.list()

    const restoredBackup = await window.api.backup.restore({
      file: backupCreated.file,
      password: 'smoke-backup-password'
    })
    const vaultAfterRestore = await window.api.vault.list()

    result.backup = {
      before: backupBefore.length,
      shortPasswordRejected,
      create: backupCreated,
      listed: backupsListed.length,
      listNameOk: backupsListed[0]?.fileName === backupCreated.fileName,
      wrongPasswordRejected,
      wrongPasswordMessage,
      vaultCountAfterWrong: vaultAfterWrong.length,
      restoreProbe: restoreProbe.name,
      restore: restoredBackup,
      vaultCountAfterRestore: vaultAfterRestore.length,
      restoredIdMatches: vaultAfterRestore[0]?.id === created.id,
      restoredProbeGone: !vaultAfterRestore.some((entry) => entry.name === 'Restore probe'),
      configDisabledSystem: restoredBackup.config.disabled.includes('system'),
      configCardSize: restoredBackup.config.cardSize
    }

    await delay(150)
    result.rendererErrors = window.__smokeErrors
    return result
  })()`)

  const clockUi = await win.webContents.executeJavaScript(`(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const card = [...document.querySelectorAll('.tool-card')].find(
      (item) => item.querySelector('h3')?.textContent === 'Clock & weather'
    )
    card?.click()
    await delay(700)

    const first = document.querySelector('.clock-time')?.textContent ?? ''
    await delay(1100)
    const second = document.querySelector('.clock-time')?.textContent ?? ''

    const result = {
      cardFound: Boolean(card),
      timeShape: /^\\d{2}:\\d{2}:\\d{2}$/.test(first),
      ticking: first !== second,
      dateLength: (document.querySelector('.clock-date')?.textContent ?? '').length,
      hasSearch: Boolean(document.querySelector('.clock-search-form input')),
      emptyWeather: Boolean(document.querySelector('.clock-weather-empty')),
      zoneText: document.querySelector('.clock-eyebrow')?.textContent ?? '',
      storedCity: localStorage.getItem('toolbox.weatherCity'),
      weatherAvailable: typeof window.api.weather?.search === 'function',
      shortQueryRejected: false,
      invalidLocationRejected: false,
      weatherMessage: ''
    }

    try {
      await window.api.weather.search('a')
    } catch (cause) {
      result.weatherMessage = String(cause?.message ?? cause)
      result.shortQueryRejected = /at least two/i.test(result.weatherMessage)
    }

    try {
      await window.api.weather.current({ latitude: 500, longitude: 0 })
    } catch {
      result.invalidLocationRejected = true
    }

    document.querySelector('.back-button')?.click()
    await delay(300)
    return result
  })()`)

  const pagesUi = await win.webContents.executeJavaScript(`(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const cards = () =>
      [...document.querySelectorAll('.tool-card')].filter(
        (card) => !card.classList.contains('tool-card-loading')
      )
    const tabs = () => [...document.querySelectorAll('.home-switch button')]
    const heading = () => document.querySelector('.hero h1')?.textContent ?? ''
    const openCard = async (name) => {
      const card = cards().find((item) => item.querySelector('h3')?.textContent === name)
      card?.click()
      await delay(700)
      return Boolean(card)
    }
    const back = async () => {
      document.querySelector('.back-button')?.click()
      await delay(350)
    }
    const result = {
      tabCount: tabs().length,
      workspaceSelected: tabs()[0]?.getAttribute('aria-selected') === 'true',
      workspaceCards: cards().length,
      connectedSelected: false,
      connectedCards: 0,
      connectedNames: [],
      connectedHeading: '',
      connectedOverflow: -1,
      gmailCard: false,
      githubCard: false,
      feedsCard: false,
      marketsCard: false,
      homePageStored: '',
      mailTool: false,
      mailInputs: 0,
      mailPasswordEmpty: false,
      mailHelpSteps: 0,
      mailStatus: null,
      mailSecretLeak: false,
      invalidEmailRejected: false,
      shortPasswordRejected: false,
      mailMessage: '',
      githubTool: false,
      githubInputs: 0,
      githubPasswordField: false,
      githubHelpSteps: 0,
      githubStatus: null,
      githubSecretLeak: false,
      githubInvalidTokenRejected: false,
      githubMessage: '',
      feedsTool: false,
      feedsUrlField: false,
      feedsSuggestions: 0,
      feedsStatus: null,
      feedsInvalidRejected: false,
      feedsPrivateRejected: false,
      feedsSchemeRejected: false,
      feedsMessage: '',
      marketsTool: false,
      marketsInputValue: '',
      marketsStatus: null,
      marketsDefaults: false,
      marketsEmptyRejected: false,
      marketsTooManyRejected: false,
      marketsBadChartRejected: false,
      marketsBadRangeRejected: false,
      marketsMessage: '',
      launchpadCard: false,
      launchpadTool: false,
      launchpadTiles: 0,
      launchpadStatus: null,
      launchpadCatalog: 0,
      launchpadDefaults: false,
      launchpadToggleOff: false,
      launchpadToggleOn: false,
      launchpadToggleUnknownRejected: false,
      launchpadCustomAdded: false,
      launchpadCustomRemoved: false,
      launchpadBadUrlRejected: false,
      launchpadOpenUnknownRejected: false,
      launchpadManage: false,
      launchpadLinksFirst: false,
      launchpadFiltered: false,
      launchpadFilterCase: false,
      launchpadFilterTrim: false,
      launchpadFilterHint: false,
      launchpadFilterEmpty: false,
      launchpadFilterCustom: false,
      launchpadFilterKeepsCustom: false,
      launchpadFilterReset: false,
      launchpadMessage: '',
      artistwaveCard: false,
      artistwaveTool: false,
      artistwaveLaunch: false,
      artistwaveHeader: false,
      artistwaveStatus: null,
      artistwaveAttached: false,
      artistwaveDetached: false,
      artistwaveMiniResized: false,
      artistwaveMiniWidth: 0,
      artistwaveMiniRestoredWidth: 0,
      artistwaveCommandRejected: false,
      artistwaveInvalidRejected: false,
      artistwaveMessage: '',
      playerClosed: false,
      bartenderCard: false,
      bartenderTool: false,
      bartenderLaunch: false,
      bartenderChips: 0,
      bartenderSelected: '',
      bartenderStatus: null,
      bartenderCached: false,
      bartenderNoSelectionRejected: false,
      bartenderUnknownRejected: false,
      bartenderMessage: '',
      backToWorkspace: false,
      workspaceCardsAfter: 0,
      workspaceHeading: ''
    }

    tabs()[1]?.click()
    await delay(450)
    result.connectedSelected = tabs()[1]?.getAttribute('aria-selected') === 'true'
    result.connectedCards = cards().length
    result.connectedNames = cards().map((item) => item.querySelector('h3')?.textContent ?? '')
    result.connectedHeading = heading()
    const connectedContent = document.querySelector('.content')
    if (connectedContent) {
      result.connectedOverflow = connectedContent.scrollHeight - connectedContent.clientHeight
    }
    result.gmailCard = result.connectedNames.includes('Gmail announcer')
    result.githubCard = result.connectedNames.includes('GitHub notifier')
    result.feedsCard = result.connectedNames.includes('RSS reader')
    result.marketsCard = result.connectedNames.includes('Crypto watch')
    result.artistwaveCard =
      result.connectedNames.includes('ArtistWave') &&
      Boolean(
        cards()
          .find((item) => item.querySelector('h3')?.textContent === 'ArtistWave')
          ?.querySelector('.tool-icon')
      )
    result.bartenderCard =
      result.connectedNames.includes('Bartender Aid') &&
      Boolean(
        cards()
          .find((item) => item.querySelector('h3')?.textContent === 'Bartender Aid')
          ?.querySelector('.tool-icon')
      )
    const gmail = cards().find((item) => item.querySelector('h3')?.textContent === 'Gmail announcer')
    result.gmailCard = result.gmailCard && Boolean(gmail?.querySelector('.tool-icon'))
    result.homePageStored = localStorage.getItem('toolbox.homePage') ?? ''

    gmail?.click()
    await delay(700)
    result.mailTool = Boolean(document.querySelector('.mail-tool'))
    result.mailInputs = document.querySelectorAll('.mail-form input').length
    const passwordInput = document.querySelector('.mail-form input[type="password"]')
    result.mailPasswordEmpty = Boolean(passwordInput) && passwordInput.value === ''
    result.mailHelpSteps = document.querySelectorAll('.mail-help li').length

    try {
      result.mailStatus = await window.api.mail.status()
    } catch (cause) {
      result.mailMessage = String(cause?.message ?? cause)
    }
    const statusText = JSON.stringify(result.mailStatus ?? {})
    result.mailSecretLeak = /password|secret|apppass/i.test(statusText)

    try {
      await window.api.mail.connect({ email: 'not-an-email', password: 'abcdefgh' })
    } catch (cause) {
      result.mailMessage = String(cause?.message ?? cause)
      result.invalidEmailRejected = /valid Gmail address/i.test(result.mailMessage)
    }

    try {
      await window.api.mail.connect({ email: 'you@gmail.com', password: 'short' })
    } catch (cause) {
      result.mailMessage = String(cause?.message ?? cause)
      result.shortPasswordRejected = /16.character/i.test(result.mailMessage)
    }
    await back()

    await openCard('GitHub notifier')
    result.githubTool = Boolean(document.querySelector('.linked-tool.github'))
    result.githubInputs = document.querySelectorAll('.linked-form input').length
    result.githubPasswordField = Boolean(
      document.querySelector('.linked-form input[type="password"]')
    )
    result.githubHelpSteps = document.querySelectorAll('.linked-help li').length

    try {
      result.githubStatus = await window.api.github.status()
    } catch (cause) {
      result.githubMessage = String(cause?.message ?? cause)
    }
    result.githubSecretLeak = /token|secret/i.test(JSON.stringify(result.githubStatus ?? {}))

    try {
      await window.api.github.connect({ token: 'short' })
    } catch (cause) {
      result.githubMessage = String(cause?.message ?? cause)
      result.githubInvalidTokenRejected = /does not look like a GitHub token/i.test(
        result.githubMessage
      )
    }
    await back()

    await openCard('RSS reader')
    result.feedsTool = Boolean(document.querySelector('.linked-tool.feeds'))
    result.feedsUrlField = Boolean(document.querySelector('.linked-form input[type="url"]'))
    result.feedsSuggestions = document.querySelectorAll('.linked-suggestions .chip-button').length

    try {
      result.feedsStatus = await window.api.feeds.status()
    } catch (cause) {
      result.feedsMessage = String(cause?.message ?? cause)
    }

    try {
      await window.api.feeds.add('not a url')
    } catch (cause) {
      result.feedsMessage = String(cause?.message ?? cause)
      result.feedsInvalidRejected = /not a valid URL/i.test(result.feedsMessage)
    }

    try {
      await window.api.feeds.add('http://127.0.0.1/feed.xml')
    } catch (cause) {
      result.feedsMessage = String(cause?.message ?? cause)
      result.feedsPrivateRejected = /private network/i.test(result.feedsMessage)
    }

    try {
      await window.api.feeds.add('ftp://example.com/feed.xml')
    } catch (cause) {
      result.feedsMessage = String(cause?.message ?? cause)
      result.feedsSchemeRejected = /http or https/i.test(result.feedsMessage)
    }
    await back()

    await openCard('Crypto watch')
    result.marketsTool = Boolean(document.querySelector('.linked-tool.markets'))
    result.marketsInputValue = document.querySelector('.linked-form input')?.value ?? ''

    try {
      result.marketsStatus = await window.api.markets.status()
    } catch (cause) {
      result.marketsMessage = String(cause?.message ?? cause)
    }
    result.marketsDefaults =
      JSON.stringify(result.marketsStatus?.watchlist ?? []) ===
      JSON.stringify(['bitcoin', 'ethereum', 'solana'])

    try {
      await window.api.markets.setWatchlist([])
    } catch (cause) {
      result.marketsMessage = String(cause?.message ?? cause)
      result.marketsEmptyRejected = /at least one/i.test(result.marketsMessage)
    }

    try {
      await window.api.markets.setWatchlist([
        'coin-1',
        'coin-2',
        'coin-3',
        'coin-4',
        'coin-5',
        'coin-6',
        'coin-7',
        'coin-8',
        'coin-9'
      ])
    } catch (cause) {
      result.marketsMessage = String(cause?.message ?? cause)
      result.marketsTooManyRejected = /up to 8/i.test(result.marketsMessage)
    }

    try {
      await window.api.markets.series('bad id!', 90)
    } catch (cause) {
      result.marketsMessage = String(cause?.message ?? cause)
      result.marketsBadChartRejected = /coingecko coin id/i.test(result.marketsMessage)
    }

    try {
      await window.api.markets.series('bitcoin', 45)
    } catch (cause) {
      result.marketsMessage = String(cause?.message ?? cause)
      result.marketsBadRangeRejected = /1, 3 or 6/i.test(result.marketsMessage)
    }
    await back()

    await openCard('ArtistWave')
    result.artistwaveTool = Boolean(document.querySelector('.player-page:not(.player-hidden)'))
    result.artistwaveLaunch = Boolean(
      document.querySelector('.player-frame[src*="ArtistWave"]')
    )
    result.artistwaveHeader = Boolean(document.querySelector('.player-button'))

    try {
      const beforeMini = window.outerWidth
      await window.api.appWindow.setPlayerMini(true)
      await new Promise((resolve) => setTimeout(resolve, 500))
      result.artistwaveMiniWidth = window.outerWidth
      await window.api.appWindow.setPlayerMini(false)
      await new Promise((resolve) => setTimeout(resolve, 500))
      result.artistwaveMiniRestoredWidth = window.outerWidth
      result.artistwaveMiniResized =
        result.artistwaveMiniWidth < 500 &&
        result.artistwaveMiniRestoredWidth >= beforeMini - 40
    } catch (cause) {
      result.artistwaveMessage = String(cause?.message ?? cause)
    }

    try {
      result.artistwaveStatus = await window.api.artistwave.status()
      result.artistwaveAttached =
        result.artistwaveStatus?.open === true &&
        result.artistwaveStatus?.visible === true
    } catch (cause) {
      result.artistwaveMessage = String(cause?.message ?? cause)
    }

    try {
      await window.api.artistwave.command('bogus-command')
    } catch (cause) {
      result.artistwaveMessage = String(cause?.message ?? cause)
      result.artistwaveInvalidRejected = /unknown artistwave command/i.test(
        result.artistwaveMessage
      )
    }

    try {
      const detached = await window.api.artistwave.detach()
      result.artistwaveDetached = detached?.open === false && detached?.snapshot === null
    } catch (cause) {
      result.artistwaveMessage = String(cause?.message ?? cause)
    }

    try {
      await window.api.artistwave.command('play')
    } catch (cause) {
      result.artistwaveMessage = String(cause?.message ?? cause)
      result.artistwaveCommandRejected = /player is not open/i.test(result.artistwaveMessage)
    }

    document.querySelector('.player-stop')?.click()
    await delay(400)
    result.playerClosed = Boolean(document.querySelector('.home'))

    // Widget host: the rail glues a widget screen beside the compact player.
    // The full and mini players must never be on screen at the same time.
    await openCard('ArtistWave')
    const waitForPlayer = async () => {
      let latest = null
      for (let attempt = 0; attempt < 30; attempt++) {
        latest = await window.api.artistwave.status()
        if (latest?.ready && !latest?.loading) return latest
        await delay(500)
      }
      return latest
    }
    const railClick = async (label) => {
      const button = [...document.querySelectorAll('.rail-tool, .rail-brand')].find(
        (item) => item.getAttribute('aria-label') === label
      )
      if (!button) return false
      button.click()
      return true
    }
    const hostState = async () => {
      const body = document.querySelector('.app-body')
      const classes = body ? [...body.classList] : []
      const artistwave = await window.api.artistwave.status()
      return {
        mode: classes.find((name) => name.indexOf('mode-') === 0) || 'unknown',
        rail: Boolean(document.querySelector('.tool-rail')),
        screen: Boolean(document.querySelector('.host-screen')),
        screenTitle: document.querySelector('.host-screen .tool-page h1')?.textContent ?? '',
        miniClass: Boolean(document.querySelector('.app-player-mini')),
        mini: artistwave?.mini === true,
        width: window.outerWidth
      }
    }

    await waitForPlayer()
    result.widgetHost = {
      full: await hostState(),
      openedNotes: false,
      notes: null,
      openedCrypto: false,
      crypto: null,
      backToFull: false,
      fullAgain: null,
      exclusive: true
    }
    result.widgetHost.exclusive =
      result.widgetHost.full.mini === result.widgetHost.full.miniClass &&
      result.widgetHost.full.screen === false

    result.widgetHost.openedNotes = await railClick('Quick notes')
    await delay(2000)
    result.widgetHost.notes = await hostState()
    result.widgetHost.exclusive =
      result.widgetHost.exclusive &&
      result.widgetHost.notes.mini === true &&
      result.widgetHost.notes.miniClass === true &&
      result.widgetHost.notes.screen === true

    result.widgetHost.openedCrypto = await railClick('Crypto watch')
    await delay(1500)
    result.widgetHost.crypto = await hostState()

    result.widgetHost.backToFull = await railClick('ArtistWave')
    await delay(2000)
    result.widgetHost.fullAgain = await hostState()

    // Leave the dashboard reachable for the rest of the smoke run.
    result.widgetHost.exitDashboard = await railClick('Open dashboard')
    await delay(800)
    result.widgetHost.homeAfter = Boolean(document.querySelector('.home'))

    // Model Farm — machine scorecard, catalog scoring and install planning.
    tabs()[0]?.click()
    await delay(500)
    await openCard('Model Farm')
    const waitForSelector = async (selector, timeout = 30000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (document.querySelector(selector)) return true
        await delay(300)
      }
      return false
    }
    await waitForSelector('.mf-machine')
    result.modelFarm = {
      card: Boolean(document.querySelector('.model-farm')),
      machine: Boolean(document.querySelector('.mf-machine')),
      score: document.querySelector('.mf-score-ring strong')?.textContent ?? '',
      axes: document.querySelectorAll('.mf-axis').length,
      ollama: document.querySelector('.mf-ollama')?.textContent ?? '',
      controls: Boolean(document.querySelector('.mf-controls')),
      status: null,
      statusError: '',
      prefsRoundTrip: false,
      prefsError: '',
      scenarioToggled: false,
      groups: 0,
      models: 0,
      catalogState: '',
      emptyOrError: '',
      emptyRepoRejected: false,
      installMessage: ''
    }

    try {
      const status = await window.api.modelFarm.status()
      result.modelFarm.status = {
        cores: status?.machine?.cores ?? 0,
        totalRamBytes: status?.machine?.totalRamBytes ?? 0,
        grade: status?.machineGrade?.score ?? null,
        axes: status?.machineGrade?.axes?.length ?? 0,
        ollamaInstalled: status?.machine?.ollama?.installed === true
      }
    } catch (cause) {
      result.modelFarm.statusError = String(cause?.message ?? cause)
    }

    try {
      await window.api.modelFarm.setPrefs({ scenario: 'total' })
      const stored = await window.api.modelFarm.prefs()
      result.modelFarm.prefsRoundTrip = stored?.scenario === 'total'
      await window.api.modelFarm.setPrefs({ scenario: 'now' })
    } catch (cause) {
      result.modelFarm.prefsError = String(cause?.message ?? cause)
    }

    // The scenario control is renderer state, so drive it through the UI.
    const wholeMachine = [...document.querySelectorAll('.mf-seg button')].find(
      (button) => button.textContent === 'Whole machine'
    )
    if (wholeMachine) {
      wholeMachine.click()
      await delay(1200)
      result.modelFarm.scenarioToggled = wholeMachine.classList.contains('active')
    }

    // The catalog is a live HuggingFace fetch: it must render groups, say why
    // it could not, or still be fetching when the wait ends.
    const waitForCatalog = async () => {
      const started = Date.now()
      while (Date.now() - started < 60000) {
        if (document.querySelectorAll('.mf-group').length > 0) return 'groups'
        const empty = document.querySelector('.model-farm .linked-empty, .model-farm .error-text')
        if (empty && empty.textContent.trim()) return 'empty'
        await delay(1000)
      }
      return 'timeout'
    }
    result.modelFarm.catalogState = await waitForCatalog()
    result.modelFarm.groups = document.querySelectorAll('.mf-group').length
    result.modelFarm.models = document.querySelectorAll('.mf-model').length
    result.modelFarm.emptyOrError =
      document.querySelector('.model-farm .linked-empty, .model-farm .error-text')?.textContent ?? ''

    try {
      const rejected = await window.api.modelFarm.install({ repo: '   ' })
      result.modelFarm.emptyRepoRejected =
        rejected?.ok === false && /repo id is required/i.test(rejected?.error ?? '')
    } catch (cause) {
      result.modelFarm.installMessage = String(cause?.message ?? cause)
    }
    await back()
    tabs()[1]?.click()
    await delay(450)

    await openCard('Bartender Aid')
    result.bartenderTool = Boolean(document.querySelector('.linked-tool.bartender-tool'))
    result.bartenderLaunch = Boolean(
      document.querySelector(
        '.bartender-tool .linked-actions .ghost-button, .bartender-tool .linked-intro .primary-button'
      )
    )
    result.bartenderChips = document.querySelectorAll('.bartender-chips .chip-button').length
    result.bartenderSelected =
      document.querySelector('.bartender-picker .linked-panel-head span:last-child')?.textContent ??
      ''

    try {
      result.bartenderStatus = await window.api.bartender.status()
      result.bartenderCached =
        result.bartenderStatus?.ingredients?.length === 3 &&
        JSON.stringify(result.bartenderStatus?.selectedIds) === '[3,5]'
    } catch (cause) {
      result.bartenderMessage = String(cause?.message ?? cause)
    }

    try {
      await window.api.bartender.match([])
    } catch (cause) {
      result.bartenderMessage = String(cause?.message ?? cause)
      result.bartenderNoSelectionRejected = /at least one ingredient/i.test(
        result.bartenderMessage
      )
    }

    try {
      await window.api.bartender.match([999999])
    } catch (cause) {
      result.bartenderMessage = String(cause?.message ?? cause)
      result.bartenderUnknownRejected = /not in the bar list/i.test(result.bartenderMessage)
    }
    await back()

    tabs()[0]?.click()
    await delay(450)
    result.backToWorkspace = tabs()[0]?.getAttribute('aria-selected') === 'true'
    result.workspaceCardsAfter = cards().length
    result.workspaceHeading = heading()
    result.launchpadCard = result.workspaceCardsAfter > 0 &&
      cards().some((item) => item.querySelector('h3')?.textContent === 'AI launchpad')

    await openCard('AI launchpad')
    result.launchpadTool = Boolean(document.querySelector('.launchpad'))
    result.launchpadTiles = document.querySelectorAll('.launchpad-tile').length

    document.querySelector('.launchpad-strip .ghost-button')?.click()
    await delay(300)
    result.launchpadManage = Boolean(document.querySelector('#launchpad-manage'))
    const launchpadGroups = [...document.querySelectorAll('#launchpad-manage .launchpad-group')]
    result.launchpadLinksFirst = launchpadGroups[0]?.getAttribute('data-group') === 'custom'

    const filterInput = document.querySelector('.launchpad-search input')
    if (filterInput) {
      const setInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      const typeInto = async (node, value) => {
        setInput?.call(node, value)
        node.dispatchEvent(new Event('input', { bubbles: true }))
        await delay(250)
      }
      const presetRows = () => [
        ...document.querySelectorAll(
          '#launchpad-manage .launchpad-group[data-group]:not([data-group="custom"]) .launchpad-row'
        )
      ]
      const customRows = () => [
        ...document.querySelectorAll(
          '#launchpad-manage .launchpad-group[data-group="custom"] .launchpad-row'
        )
      ]

      await typeInto(filterInput, 'ollama')
      const filteredRows = presetRows()
      result.launchpadFiltered =
        filteredRows.length === 1 && /Ollama/i.test(filteredRows[0].textContent ?? '')

      await typeInto(filterInput, 'OLLAMA')
      const caseRows = presetRows()
      result.launchpadFilterCase =
        caseRows.length === 1 && /Ollama/i.test(caseRows[0].textContent ?? '')

      await typeInto(filterInput, '  ollama  ')
      const trimRows = presetRows()
      result.launchpadFilterTrim =
        trimRows.length === 1 && /Ollama/i.test(trimRows[0].textContent ?? '')

      await typeInto(filterInput, 'offline chat')
      const hintRows = presetRows()
      result.launchpadFilterHint =
        hintRows.length === 1 && /GPT4All/i.test(hintRows[0].textContent ?? '')

      await typeInto(filterInput, 'zzz-nothing')
      result.launchpadFilterEmpty =
        presetRows().length === 0 && Boolean(document.querySelector('.launchpad-no-match'))

      const nameInput = document.querySelector('.launchpad-add input')
      const urlInput = document.querySelectorAll('.launchpad-add input')[1]
      if (nameInput && urlInput) {
        setInput?.call(nameInput, 'Filter check')
        nameInput.dispatchEvent(new Event('input', { bubbles: true }))
        setInput?.call(urlInput, 'https://example.com/filter-check')
        urlInput.dispatchEvent(new Event('input', { bubbles: true }))
        await delay(120)
        document.querySelector('.launchpad-add')?.requestSubmit()
        await delay(450)
        const addedRow = customRows()[0]
        result.launchpadFilterCustom =
          customRows().length === 1 && /Filter check/i.test(addedRow?.textContent ?? '')

        await typeInto(filterInput, 'ollama')
        const mixedRows = [...document.querySelectorAll('#launchpad-manage .launchpad-row')]
        result.launchpadFilterKeepsCustom =
          mixedRows.length === 2 &&
          customRows().length === 1 &&
          presetRows().length === 1 &&
          mixedRows.some((row) => /Filter check/i.test(row.textContent ?? ''))
      }
    }

    document.querySelector('.launchpad-strip .ghost-button')?.click()
    await delay(300)

    document.querySelector('.launchpad-strip .ghost-button')?.click()
    await delay(300)
    const resetInput = document.querySelector('.launchpad-search input')
    const resetRows = [
      ...document.querySelectorAll(
        '#launchpad-manage .launchpad-group[data-group]:not([data-group="custom"]) .launchpad-row'
      )
    ]
    result.launchpadFilterReset =
      Boolean(resetInput) && resetInput.value === '' && resetRows.length > 20
    document
      .querySelector('#launchpad-manage .launchpad-group[data-group="custom"] .launchpad-remove')
      ?.click()
    await delay(400)
    document.querySelector('.launchpad-strip .ghost-button')?.click()
    await delay(250)

    try {
      result.launchpadStatus = await window.api.shortcuts.status()
      result.launchpadCatalog = result.launchpadStatus?.items?.length ?? 0
      result.launchpadDefaults =
        result.launchpadStatus?.items?.filter((item) => item.enabled).length === 10
    } catch (cause) {
      result.launchpadMessage = String(cause?.message ?? cause)
    }

    try {
      const off = await window.api.shortcuts.toggle('chatgpt', false)
      result.launchpadToggleOff =
        off.items.find((item) => item.id === 'chatgpt')?.enabled === false
      const on = await window.api.shortcuts.toggle('chatgpt', true)
      result.launchpadToggleOn = on.items.find((item) => item.id === 'chatgpt')?.enabled === true
    } catch (cause) {
      result.launchpadMessage = String(cause?.message ?? cause)
    }

    try {
      await window.api.shortcuts.toggle('not-a-shortcut', true)
    } catch (cause) {
      result.launchpadMessage = String(cause?.message ?? cause)
      result.launchpadToggleUnknownRejected = /not part of the preset list/i.test(
        result.launchpadMessage
      )
    }

    try {
      await window.api.shortcuts.add({ name: 'Bad link', url: 'ftp://example.com' })
    } catch (cause) {
      result.launchpadMessage = String(cause?.message ?? cause)
      result.launchpadBadUrlRejected = /http and https/i.test(result.launchpadMessage)
    }

    try {
      const added = await window.api.shortcuts.add({
        name: 'Local UI',
        url: 'http://localhost:3000'
      })
      const custom = added.items.find((item) => item.custom)
      result.launchpadCustomAdded =
        custom?.name === 'Local UI' && custom?.url === 'http://localhost:3000/'
      const removed = custom ? await window.api.shortcuts.remove(custom.id) : null
      result.launchpadCustomRemoved = Boolean(removed) && !removed.items.some((item) => item.custom)
    } catch (cause) {
      result.launchpadMessage = String(cause?.message ?? cause)
    }

    try {
      await window.api.shortcuts.open('not-a-shortcut')
    } catch (cause) {
      result.launchpadMessage = String(cause?.message ?? cause)
      result.launchpadOpenUnknownRejected = /no longer on your launchpad/i.test(
        result.launchpadMessage
      )
    }
    await back()
    return result
  })()`)

  const headerUi = await win.webContents.executeJavaScript(`(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const header = () => document.querySelector('.header-status')
    const result = {
      presentHome: Boolean(header()),
      timeShape: /^\\d{2}:\\d{2}$/.test(
        header()?.querySelector('.header-clock strong')?.textContent ?? ''
      ),
      dateLength: (header()?.querySelector('.header-clock span')?.textContent ?? '').length,
      setCityInitial: (header()?.textContent ?? '').includes('Set city'),
      presentSettings: false,
      presentTool: false,
      openedClock: false,
      openedClockSearch: false,
      cityUpdated: false,
      headerTextAfterCity: '',
      setCityRestored: false,
      homeOverflow: -1
    }

    document.querySelector('.settings-toggle')?.click()
    await delay(350)
    result.presentSettings = Boolean(header())
    document.querySelector('.back-button')?.click()
    await delay(300)

    const notesCard = [...document.querySelectorAll('.tool-card')].find(
      (item) => item.querySelector('h3')?.textContent === 'Quick notes'
    )
    notesCard?.click()
    await delay(500)
    result.presentTool = Boolean(header()) && Boolean(document.querySelector('.notes-layout'))

    header()?.click()
    await delay(500)
    result.openedClock = Boolean(document.querySelector('.clock-tool'))
    result.openedClockSearch = Boolean(document.querySelector('.clock-search-form input'))
    document.querySelector('.back-button')?.click()
    await delay(300)

    const lisbon = {
      id: 2267057,
      name: 'Lisbon',
      country: 'Portugal',
      region: 'Lisboa',
      latitude: 38.7167,
      longitude: -9.1333,
      timezone: 'Europe/Lisbon'
    }
    localStorage.setItem('toolbox.weatherCity', JSON.stringify(lisbon))
    window.dispatchEvent(new CustomEvent('toolbox:weather-city', { detail: lisbon }))
    await delay(300)
    result.headerTextAfterCity = header()?.textContent ?? ''
    result.cityUpdated = result.headerTextAfterCity.includes('Lisbon')

    localStorage.removeItem('toolbox.weatherCity')
    window.dispatchEvent(new CustomEvent('toolbox:weather-city', { detail: null }))
    await delay(250)
    result.setCityRestored = (header()?.textContent ?? '').includes('Set city')

    document.querySelectorAll('.card-size-button')[1]?.click()
    await delay(400)
    const content = document.querySelector('.content')
    if (content) result.homeOverflow = content.scrollHeight - content.clientHeight

    return result
  })()`)

  let vaultFileText = ''
  try {
    vaultFileText = fs.readFileSync(path.join(userDataDir, 'vault.json'), 'utf8')
  } catch (cause) {
    vaultFileText = `unreadable: ${cause.message}`
  }

  const backupInfo = (() => {
    const file = ui.backup?.create?.file
    if (!file) return { exists: false }
    try {
      const raw = fs.readFileSync(file)
      return {
        exists: true,
        path: file,
        magic: raw.subarray(0, 4).toString('ascii'),
        size: raw.length,
        hasPlaintext: raw.includes(Buffer.from('smoke-secret-value')),
        hasConfigText: raw.includes(Buffer.from('disabled')),
        hasJsonText: raw.includes(Buffer.from('"secrets"'))
      }
    } catch (cause) {
      return { exists: false, error: cause.message }
    }
  })()

  let tamperPath = ''
  if (backupInfo.exists && backupInfo.path) {
    const raw = fs.readFileSync(backupInfo.path)
    raw[raw.length - 1] ^= 0x01
    tamperPath = path.join(backupDir, 'tampered.tbx')
    fs.writeFileSync(tamperPath, raw)
  }

  const tamperCheck = tamperPath
    ? await win.webContents.executeJavaScript(`(async () => {
        const before = (await window.api.vault.list()).length
        let rejected = false
        let message = ''
        try {
          await window.api.backup.restore({
            file: ${JSON.stringify(tamperPath)},
            password: 'smoke-backup-password'
          })
        } catch (cause) {
          rejected = true
          message = String(cause?.message ?? cause)
        }
        const after = (await window.api.vault.list()).length
        return { rejected, message, unchanged: before === after }
      })()`)
    : { rejected: false, unchanged: false }

  const files = await win.webContents.executeJavaScript(`(async () => {
    const before = await window.api.files.list(${JSON.stringify(fileDir)})
    const summary = await window.api.files.organize(${JSON.stringify(fileDir)})
    const after = await window.api.files.list(${JSON.stringify(fileDir)})
    let rootGuard = false
    try {
      await window.api.files.list('C:\\\\')
    } catch {
      rootGuard = true
    }
    return {
      before: before.length,
      moved: summary.moved,
      categories: summary.categories,
      foldersAfter: after.filter((entry) => entry.isDirectory).map((entry) => entry.name),
      rootGuard
    }
  })()`)

  const vaultRemoved = await win.webContents.executeJavaScript(`(async () => {
    await window.api.vault.remove(${JSON.stringify(ui.vault?.created?.id ?? '')})
    return (await window.api.vault.list()).length
  })()`)

  const userToolApi = await win.webContents.executeJavaScript(`(async () => {
    const before = await window.api.userTools.list()
    const first = await window.api.userTools.installExample()
    const second = await window.api.userTools.installExample()
    const after = await window.api.userTools.list()
    const code = await window.api.userTools.code('text-stats')
    let invalidIdRejected = false
    try {
      await window.api.userTools.code('../vault')
    } catch {
      invalidIdRejected = true
    }
    let traversalRejected = false
    try {
      await window.api.userTools.code('..')
    } catch {
      traversalRejected = true
    }
    return {
      beforeCount: before.tools.length,
      first,
      second,
      afterIds: after.tools.map((tool) => tool.id),
      afterErrors: after.errors.length,
      codeLength: code.length,
      codeExportsMount: /export function mount/.test(code),
      invalidIdRejected,
      traversalRejected
    }
  })()`)

  const reloaded = new Promise((resolve) => win.webContents.once('did-finish-load', resolve))
  win.webContents.reload()
  await reloaded
  await delay(900)

  const updatesApi = await win.webContents.executeJavaScript(`(async () => {
    const result = { version: '', empty: '', invalid: '', private: '', insecure: '' }
    result.version = await window.api.updates.version()
    const probes = [
      ['empty', ''],
      ['invalid', 'not a source'],
      ['private', 'https://localhost/update.json'],
      ['insecure', 'http://example.com/update.json']
    ]
    for (const [key, value] of probes) {
      try {
        await window.api.updates.check(value)
        result[key] = 'accepted'
      } catch (cause) {
        result[key] = String(cause?.message ?? cause)
      }
    }
    return result
  })()`)

  const userToolUi = await win.webContents.executeJavaScript(`(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    window.__smokeErrors = []
    window.addEventListener('error', (event) => window.__smokeErrors.push('error: ' + event.message))
    window.addEventListener('unhandledrejection', (event) => window.__smokeErrors.push('rejection: ' + event.reason))

    const waitFor = async (probe, timeout = 5000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        const value = probe()
        if (value) return value
        await delay(100)
      }
      return null
    }

    const cards = await waitFor(() => {
      const list = [...document.querySelectorAll('.tool-card')]
      return list.length >= 6 ? list : null
    })
    const names = (cards ?? []).map((card) => card.querySelector('h3')?.textContent ?? '')
    const userCard = cards?.find((card) => card.querySelector('.card-badge'))
    const badge = userCard?.querySelector('.card-badge')?.textContent ?? ''

    userCard?.click()
    const host = await waitFor(() => {
      const element = document.querySelector('.user-tool-host')
      return element && element.children.length > 0 ? element : null
    })

    const result = {
      cardCount: cards ? cards.length : 0,
      names,
      badge,
      tagged: Boolean(document.querySelector('.user-tool-tag')),
      hasTextarea: Boolean(document.querySelector('.user-tool-host textarea')),
      mountedTiles: document.querySelectorAll('.user-tool-host .stat-tile').length,
      hostTextLength: (host?.textContent ?? '').length,
      hostError: document.querySelector('.user-tool-view .result-banner.warn')?.textContent ?? ''
    }

    document.querySelector('.back-button')?.click()
    await delay(300)
    document.querySelector('.settings-toggle')?.click()
    await delay(400)

    result.rowBadges = document.querySelectorAll('.row-badge').length
    result.rowBadgeLabels = [...document.querySelectorAll('.row-badge')].map(
      (badge) => badge.textContent?.trim() ?? ''
    )
    result.switchCount = document.querySelectorAll('.switch').length
    result.userSection = Boolean(document.querySelector('.user-tools-panel'))
    result.actions = [...document.querySelectorAll('.user-tools-actions button')].map(
      (button) => button.textContent?.trim() ?? ''
    )

    const sourceInput = document.querySelector('.updates-field input')
    const checkButton = document.querySelector('.updates-check')
    result.updates = {
      section: Boolean(document.querySelector('.updates-panel')),
      field: Boolean(sourceInput),
      checkLabel: checkButton?.textContent?.trim() ?? '',
      checkDisabled: checkButton?.disabled ?? null,
      installed: document.querySelector('.updates-version')?.textContent?.trim() ?? '',
      enabledAfterSource: false
    }
    if (sourceInput && checkButton) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(sourceInput, 'owner/repo')
      sourceInput.dispatchEvent(new Event('input', { bubbles: true }))
      await delay(200)
      result.updates.enabledAfterSource = checkButton.disabled === false
      setter?.call(sourceInput, '')
      sourceInput.dispatchEvent(new Event('input', { bubbles: true }))
      await delay(150)
    }
    result.errors = window.__smokeErrors
    return result
  })()`)

  const pinOn = await win.webContents.executeJavaScript(`(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    document.querySelector('.back-button')?.click()
    await delay(300)
    const button = document.querySelector('.pin-toggle')
    button?.click()
    await delay(200)
    return {
      pressed: button?.getAttribute('aria-pressed'),
      pinnedClass: button?.classList.contains('pinned') ?? false
    }
  })()`)
  const pinnedState = win.isAlwaysOnTop()

  const pinOff = await win.webContents.executeJavaScript(`(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const button = document.querySelector('.pin-toggle')
    button?.click()
    await delay(200)
    return {
      pressed: button?.getAttribute('aria-pressed'),
      pinnedClass: button?.classList.contains('pinned') ?? false
    }
  })()`)
  const unpinnedState = win.isAlwaysOnTop()

  const miniEntry = await win.webContents.executeJavaScript(`(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    document.querySelector('.mini-toggle')?.click()
    await delay(800)
    return {
      miniBar: Boolean(document.querySelector('.mini-bar')),
      toolIcons: document.querySelectorAll('.mini-tools .mini-tool').length,
      hasExpand: Boolean(document.querySelector('.mini-expand')),
      hasManage: Boolean(document.querySelector('.mini-actions .mini-tool')),
      hasPin: Boolean(document.querySelector('.mini-pin'))
    }
  })()`)
  const compactSize = win.getContentSize()

  const miniAction = await win.webContents.executeJavaScript(`(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    document.querySelector('.mini-tools .mini-tool[aria-label="Quick notes"]')?.click()
    await delay(700)
    const openedTool = document.querySelector('.tool-heading h1')?.textContent ?? ''
    const barAfterOpen = Boolean(document.querySelector('.mini-bar'))

    document.querySelector('.back-button')?.click()
    await delay(300)
    document.querySelector('.mini-toggle')?.click()
    await delay(800)
    const enteredAgain = Boolean(document.querySelector('.mini-bar'))
    document.querySelector('.mini-expand')?.click()
    await delay(800)

    return {
      openedTool,
      barAfterOpen,
      enteredAgain,
      expanded: Boolean(document.querySelector('.tool-grid')),
      miniGone: !document.querySelector('.mini-bar'),
      errors: window.__smokeErrors ?? []
    }
  })()`)
  const restoredSize = win.getContentSize()

  const uiRestore = await win.webContents.executeJavaScript(`(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    localStorage.setItem('toolbox.backupDir', ${JSON.stringify(backupDir)})

    const backupCard = [...document.querySelectorAll('.tool-card')].find(
      (card) => card.querySelector('h3')?.textContent === 'Encrypted backup'
    )
    backupCard?.click()
    await delay(1000)

    const rowButton = document.querySelector('.backup-row .ghost-button')
    rowButton?.click()
    await delay(300)

    const input = document.querySelector('.backup-restore-panel input[type="password"]')
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set
    setter?.call(input, 'smoke-backup-password')
    input?.dispatchEvent(new Event('input', { bubbles: true }))
    await delay(250)

    document.querySelector('.backup-restore-panel .primary-button')?.click()
    await delay(300)
    const confirmLabel =
      document.querySelector('.backup-restore-panel .primary-button')?.textContent ?? ''
    document.querySelector('.backup-restore-panel .primary-button')?.click()
    await delay(2000)

    const notice = document.querySelector('.backup-tool .result-banner')?.textContent ?? ''
    const storedDisabled = JSON.parse(localStorage.getItem('toolbox.disabled') ?? '[]')

    document.querySelector('.back-button')?.click()
    await delay(400)

    const pinButton = document.querySelector('.pin-toggle')
    return {
      listedBefore: Boolean(rowButton),
      confirmLabel,
      notice,
      storedDisabled,
      visibleCards: document.querySelectorAll('.tool-card').length,
      systemHidden: ![...document.querySelectorAll('.tool-card h3')].some(
        (node) => node.textContent === 'System dashboard'
      ),
      homeClass: document.querySelector('.home')?.className ?? '',
      pinnedAfter: pinButton?.getAttribute('aria-pressed'),
      pinnedClass: pinButton?.classList.contains('pinned') ?? false
    }
  })()`)

  const sizeControl = await win.webContents.executeJavaScript(`(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const buttons = [...document.querySelectorAll('.card-size-button')]
    const labels = buttons.map((button) => button.getAttribute('aria-label'))

    buttons[0]?.click()
    await delay(250)
    const smallClass = document.querySelector('.home')?.className ?? ''
    const smallActive = buttons[0]?.getAttribute('aria-pressed')

    buttons[2]?.click()
    await delay(250)
    const largeClass = document.querySelector('.home')?.className ?? ''
    const largeActive = buttons[2]?.getAttribute('aria-pressed')

    return {
      count: buttons.length,
      labels,
      smallClass,
      smallActive,
      largeClass,
      largeActive,
      stored: localStorage.getItem('toolbox.cardSize')
    }
  })()`)

  // Hidden windows do not receive renderer resize events on Windows, so the
  // layout viewport can lag behind the native window size. Show it briefly so
  // viewport-dependent UI (the fixed-position context menu) is measured fairly.
  win.showInactive()
  await delay(600)

  const vaultMenuUi = await win.webContents.executeJavaScript(`(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    await window.api.vault.add({
      name: 'Context key',
      value: 'context-secret-value',
      notes: 'right-click target'
    })

    const card = [...document.querySelectorAll('.tool-card')].find(
      (item) => item.querySelector('h3')?.textContent === 'API vault'
    )
    card?.click()
    await delay(900)

    const panel = document.querySelector('.vault-tool')
    panel?.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 220,
        clientY: 260
      })
    )
    await delay(250)

    const menu = document.querySelector('.vault-menu')
    const items = [...document.querySelectorAll('.vault-menu-item')]
    const rect = menu?.getBoundingClientRect()
    const firstName = items[0]?.querySelector('strong')?.textContent ?? ''
    items[0]?.click()
    await delay(400)

    const notice = document.querySelector('.vault-tool .result-banner')?.textContent ?? ''
    const history = await window.api.clipboard.list()
    const entries = await window.api.vault.list()
    const added = entries.find((entry) => entry.name === 'Context key')
    if (added) await window.api.vault.remove(added.id)

    return {
      cardFound: Boolean(card),
      menuOpen: Boolean(menu),
      itemCount: items.length,
      firstName,
      menuInsideViewport: rect
        ? rect.left >= 0 &&
          rect.top >= 0 &&
          rect.right <= innerWidth &&
          rect.bottom <= innerHeight
        : false,
      closed: !document.querySelector('.vault-menu'),
      notice,
      leakedToHistory: history.some((item) => item.text.includes('context-secret-value'))
    }
  })()`)
  const menuClipboard = await clipboard.readText()
  win.hide()

  const cleanup = {
    vaultRemoved,
    vaultFileHasPlaintext: vaultFileText.includes('smoke-secret-value'),
    vaultFileHasCipherField: vaultFileText.includes('"secret"'),
    files: fs.readdirSync(fileDir).sort()
  }

  const failures = []
  const expect = (condition, message) => {
    if (!condition) failures.push(message)
  }

  expect(ui.apiAvailable, 'preload bridge is unavailable')
  expect(ui.cardCount === 19, `expected 19 tool cards, found ${ui.cardCount}`)
  for (const check of ui.toolChecks) {
    expect(check.rendered, `tool "${check.name}" did not render`)
    expect(check.textLength > 10, `tool "${check.name}" rendered empty`)
  }
  expect(ui.backupUi?.badge, 'backup tool is missing its encryption badge')
  expect(ui.backupUi?.panels >= 3, 'backup tool is missing its settings panels')
  expect(ui.backupUi?.passwordFields === 2, 'backup tool is missing password confirmation')
  expect(ui.backupUi?.hasFolderPath, 'backup tool is missing its destination path')
  expect(ui.customization?.switchCount === 25, 'manage tools did not list all switches')
  expect(ui.customization?.afterDisableCount === 18, 'disabling a tool did not shrink the dashboard')
  expect(ui.customization?.hiddenName, 'disabled tool remained on the dashboard')
  expect(ui.customization?.afterEnableCount === 19, 're-enabling a tool did not restore the dashboard')
  expect(ui.customization?.restored, 're-enabled tool did not reappear')
  expect(ui.clipboard?.hasCopied, 'clipboard history did not record a copy')
  expect(ui.system?.memTotal > 0, 'system stats did not report memory')
  expect(ui.vault?.before === 0, 'vault was not empty at the start')
  expect(ui.vault?.afterAdd === 1, 'vault add did not persist one entry')
  expect(ui.vault?.entryShapeOk, 'vault add returned secret material to the renderer')
  expect(!ui.vault?.secretInHistory, 'vault copy leaked into clipboard history')
  expect(ui.backup?.before === 1, 'backup did not see the existing vault secret')
  expect(ui.backup?.shortPasswordRejected, 'backup accepted a short password')
  expect(/^toolbox-backup-\d{8}-\d{6}\.tbx$/.test(ui.backup?.create?.fileName ?? ''), 'backup file name is unexpected')
  expect(ui.backup?.create?.secretCount === 1, 'backup did not include the vault secret')
  expect(ui.backup?.create?.size > 200, 'backup file is unexpectedly small')
  expect(ui.backup?.listed === 1 && ui.backup?.listNameOk, 'backup list did not find the new file')
  expect(ui.backup?.wrongPasswordRejected, `wrong backup password was not rejected: ${ui.backup?.wrongPasswordMessage}`)
  expect(ui.backup?.vaultCountAfterWrong === 2, 'wrong password altered the vault')
  expect(ui.backup?.restore?.secretCount === 1, 'restore reported the wrong secret count')
  expect(
    ui.backup?.restore?.appVersion === packageJson.version,
    `backup metadata reports ${ui.backup?.restore?.appVersion} instead of ${packageJson.version}`
  )
  expect(ui.backup?.vaultCountAfterRestore === 1, 'restore did not replace the vault')
  expect(ui.backup?.restoredIdMatches, 'restored secret did not keep its id')
  expect(ui.backup?.restoredProbeGone, 'restore kept a secret added after the backup')
  expect(ui.backup?.configDisabledSystem, 'restore did not return the saved tool layout')
  expect(ui.backup?.configCardSize === 'large', 'restore did not return the saved card size')
  expect(backupInfo.exists, 'backup file could not be read from disk')
  expect(backupInfo.magic === 'TBX1', 'backup file is missing its magic header')
  expect(!backupInfo.hasPlaintext, 'backup file contains a plaintext secret')
  expect(!backupInfo.hasConfigText, 'backup file contains plaintext config')
  expect(!backupInfo.hasJsonText, 'backup file contains plaintext JSON')
  expect(tamperCheck.rejected, 'tampered backup was not rejected')
  expect(tamperCheck.unchanged, 'tampered restore altered the vault')
  expect(files.rootGuard, 'drive-root guard did not reject C:\\\\')
  expect(files.moved === 2, `file organizer moved ${files.moved} files, expected 2`)
  expect(files.foldersAfter?.includes('Documents'), 'file organizer did not create Documents')
  expect(files.foldersAfter?.includes('Images'), 'file organizer did not create Images')
  expect(cleanup.vaultRemoved === 0, 'vault remove did not delete the entry')
  expect(!cleanup.vaultFileHasPlaintext, 'vault file contains the plaintext secret')
  expect(cleanup.vaultFileHasCipherField, 'vault file is missing encrypted payload')
  expect(userToolApi.beforeCount === 0, 'user tools folder was not empty at the start')
  expect(userToolApi.first?.installed === true, 'example user tool was not installed')
  expect(userToolApi.first?.id === 'text-stats', 'example user tool has an unexpected id')
  expect(userToolApi.second?.installed === false, 'example user tool was installed twice')
  expect(
    userToolApi.afterIds?.includes('text-stats'),
    'installed example tool was not found by the scanner'
  )
  expect(userToolApi.afterErrors === 0, 'user tool scan reported unexpected folder errors')
  expect(userToolApi.codeLength > 200, 'user tool source was not returned')
  expect(userToolApi.codeExportsMount, 'user tool source is missing the mount export')
  expect(userToolApi.invalidIdRejected, 'invalid user tool id was not rejected')
  expect(userToolApi.traversalRejected, 'path traversal user tool id was not rejected')
  expect(userToolUi.cardCount === 10, `expected 10 tool cards after install, found ${userToolUi.cardCount}`)
  expect(userToolUi.names?.includes('Text stats'), 'installed user tool is missing from the dashboard')
  expect(userToolUi.badge?.includes('User tool'), 'user tool card is missing its badge')
  expect(userToolUi.tagged, 'user tool page is missing its installed-tool banner')
  expect(userToolUi.hasTextarea, 'user tool did not mount its UI')
  expect(userToolUi.mountedTiles === 3, `user tool mounted ${userToolUi.mountedTiles} stat tiles, expected 3`)
  expect(userToolUi.hostTextLength > 10, 'user tool mounted empty content')
  expect(!userToolUi.hostError, `user tool failed to load: ${userToolUi.hostError}`)
  expect(
    userToolUi.rowBadges === 7 &&
      userToolUi.rowBadgeLabels?.filter((label) => label === 'Connected').length === 6 &&
      userToolUi.rowBadgeLabels?.includes('User'),
    'manage tools is missing its connected/user badges'
  )
  expect(userToolUi.switchCount === 16, 'manage tools did not list the user tool switch')
  expect(userToolUi.userSection, 'manage tools is missing the user tools section')
  expect(userToolUi.actions?.length === 3, 'user tools panel is missing its actions')
  expect(userToolUi.errors?.length === 0, `user tool renderer errors: ${userToolUi.errors?.join(' | ')}`)
  expect(/^\d+\.\d+\.\d+$/.test(updatesApi.version), `updates API returned version "${updatesApi.version}"`)
  expect(/release source/i.test(updatesApi.empty), `empty update source was not rejected: ${updatesApi.empty}`)
  expect(
    /GitHub repository|owner\/repo/i.test(updatesApi.invalid),
    `invalid update source was not rejected: ${updatesApi.invalid}`
  )
  expect(
    /private network/i.test(updatesApi.private),
    `private update host was not rejected: ${updatesApi.private}`
  )
  expect(/https/i.test(updatesApi.insecure), `http update source was not rejected: ${updatesApi.insecure}`)
  expect(userToolUi.updates?.section, 'manage tools is missing the app updates section')
  expect(userToolUi.updates?.field, 'app updates section is missing its source field')
  expect(/Check now/.test(userToolUi.updates?.checkLabel ?? ''), 'app updates section is missing its check button')
  expect(userToolUi.updates?.checkDisabled === true, 'update check should wait for a release source')
  expect(/Installed v\d+\.\d+\.\d+/.test(userToolUi.updates?.installed ?? ''), 'app updates section is missing the installed version')
  expect(userToolUi.updates?.enabledAfterSource, 'update check did not enable after entering a source')
  expect(miniEntry.miniBar, 'mini bar did not appear')
  expect(miniEntry.toolIcons === 16, `mini bar shows ${miniEntry.toolIcons} tool icons, expected 16`)
  expect(miniEntry.hasExpand, 'mini bar is missing the expand control')
  expect(miniEntry.hasManage, 'mini bar is missing the manage control')
  expect(miniEntry.hasPin, 'mini bar is missing the pin control')
  expect(
    pinOn.pressed === 'true' && pinOn.pinnedClass,
    'always-on-top toggle did not switch on'
  )
  expect(pinnedState === true, 'window did not become always-on-top')
  expect(
    pinOff.pressed === 'false' && !pinOff.pinnedClass,
    'always-on-top toggle did not switch off'
  )
  expect(unpinnedState === false, 'window did not clear always-on-top')
  expect(
    compactSize[1] <= 120 && compactSize[0] >= 360 && compactSize[0] < 900,
    `compact window size is ${compactSize.join('x')}`
  )
  expect(miniAction.openedTool === 'Quick notes', 'mini tool icon did not open its tool')
  expect(!miniAction.barAfterOpen, 'mini bar stayed open after opening a tool')
  expect(miniAction.enteredAgain, 'mini bar did not reopen')
  expect(miniAction.expanded, 'expanding from the mini bar did not restore the dashboard')
  expect(miniAction.miniGone, 'mini bar remained after expanding')
  expect(
    restoredSize[0] >= 900 && restoredSize[1] >= 600,
    `restored window size is ${restoredSize.join('x')}`
  )
  expect(miniAction.errors?.length === 0, `mini bar renderer errors: ${miniAction.errors?.join(' | ')}`)
  expect(uiRestore.listedBefore, 'backup tool did not list the backup file')
  expect(uiRestore.confirmLabel.includes('Replace'), 'restore did not ask for confirmation')
  expect(uiRestore.notice.includes('Restored'), 'restore success message was missing')
  expect(uiRestore.storedDisabled.includes('system'), 'restored tool layout was not saved')
  expect(uiRestore.homeClass.includes('cards-large'), 'restored card size was not applied')
  expect(uiRestore.visibleCards === 19, `restored layout shows ${uiRestore.visibleCards} cards, expected 19`)
  expect(uiRestore.systemHidden, 'restored layout did not hide the system tool')
  expect(
    uiRestore.pinnedAfter === 'true' && uiRestore.pinnedClass,
    'restored pin preference was not applied'
  )
  expect(sizeControl.count === 3, 'card size control is missing options')
  expect(
    sizeControl.smallClass.includes('cards-small') && sizeControl.smallActive === 'true',
    'small card size did not apply'
  )
  expect(
    sizeControl.largeClass.includes('cards-large') && sizeControl.largeActive === 'true',
    'large card size did not apply'
  )
  expect(sizeControl.stored === 'large', 'card size was not persisted')
  expect(clockUi.cardFound, 'clock & weather card is missing')
  expect(clockUi.timeShape, 'clock time has an unexpected shape')
  expect(clockUi.ticking, 'clock did not tick')
  expect(clockUi.dateLength > 5, 'clock is missing its date')
  expect(clockUi.hasSearch, 'clock is missing its city search')
  expect(clockUi.emptyWeather, 'clock did not show the empty weather state')
  expect(clockUi.weatherAvailable, 'weather bridge is unavailable')
  expect(clockUi.shortQueryRejected, `weather search accepted a one-character query: ${clockUi.weatherMessage}`)
  expect(clockUi.invalidLocationRejected, 'weather accepted an invalid location')
  expect(clockUi.storedCity === null, 'clock persisted a city before one was chosen')
  expect(pagesUi.tabCount === 2, `expected 2 dashboard pages, found ${pagesUi.tabCount}`)
  expect(pagesUi.workspaceSelected, 'workspace page is not selected by default')
  expect(pagesUi.workspaceCards === 19, `workspace page shows ${pagesUi.workspaceCards} cards, expected 19`)
  expect(pagesUi.connectedSelected, 'clicking the Connected tab did not select it')
  expect(pagesUi.connectedCards === 6, `connected page shows ${pagesUi.connectedCards} cards, expected 6`)
  expect(/one dashboard/i.test(pagesUi.connectedHeading), 'connected page is missing its heading')
  expect(
    pagesUi.connectedOverflow <= 1,
    `connected page scrolls at the default window height (overflow ${pagesUi.connectedOverflow}px)`
  )
  expect(pagesUi.gmailCard, 'Gmail announcer card is missing from the connected page')
  expect(pagesUi.githubCard, 'GitHub notifier card is missing from the connected page')
  expect(pagesUi.feedsCard, 'RSS reader card is missing from the connected page')
  expect(pagesUi.marketsCard, 'Crypto watch card is missing from the connected page')
  expect(pagesUi.artistwaveCard, 'ArtistWave card is missing from the connected page')
  expect(pagesUi.bartenderCard, 'Bartender Aid card is missing from the connected page')
  expect(pagesUi.homePageStored === 'connected', 'selected dashboard page was not persisted')
  expect(pagesUi.mailTool, 'Gmail announcer did not open')
  expect(pagesUi.mailInputs === 2, `Gmail setup shows ${pagesUi.mailInputs} fields, expected 2`)
  expect(pagesUi.mailPasswordEmpty, 'Gmail App Password field is not an empty password input')
  expect(pagesUi.mailHelpSteps === 3, `Gmail App Password help has ${pagesUi.mailHelpSteps} steps, expected 3`)
  expect(pagesUi.mailStatus?.configured === false, 'Gmail was unexpectedly configured before setup')
  expect(!pagesUi.mailSecretLeak, 'mail status leaked secret material')
  expect(pagesUi.invalidEmailRejected, `Gmail accepted an invalid address: ${pagesUi.mailMessage}`)
  expect(pagesUi.shortPasswordRejected, `Gmail accepted a short password: ${pagesUi.mailMessage}`)
  expect(pagesUi.githubTool, 'GitHub notifier did not open')
  expect(pagesUi.githubInputs === 1, `GitHub setup shows ${pagesUi.githubInputs} fields, expected 1`)
  expect(pagesUi.githubPasswordField, 'GitHub token field is not masked')
  expect(pagesUi.githubHelpSteps === 3, `GitHub help has ${pagesUi.githubHelpSteps} steps, expected 3`)
  expect(pagesUi.githubStatus?.configured === false, 'GitHub was unexpectedly configured before setup')
  expect(!pagesUi.githubSecretLeak, 'GitHub status leaked token material')
  expect(
    pagesUi.githubInvalidTokenRejected,
    `GitHub accepted an invalid token: ${pagesUi.githubMessage}`
  )
  expect(pagesUi.feedsTool, 'RSS reader did not open')
  expect(pagesUi.feedsUrlField, 'RSS reader is missing its URL field')
  expect(pagesUi.feedsSuggestions === 4, `RSS reader shows ${pagesUi.feedsSuggestions} suggestions, expected 4`)
  expect(pagesUi.feedsStatus?.feeds?.length === 0, 'RSS reader had feeds before any were added')
  expect(pagesUi.feedsInvalidRejected, `RSS reader accepted an invalid URL: ${pagesUi.feedsMessage}`)
  expect(pagesUi.feedsPrivateRejected, `RSS reader accepted a private address: ${pagesUi.feedsMessage}`)
  expect(pagesUi.feedsSchemeRejected, `RSS reader accepted a non-web URL: ${pagesUi.feedsMessage}`)
  expect(pagesUi.marketsTool, 'Crypto watch did not open')
  expect(
    pagesUi.marketsInputValue.includes('bitcoin'),
    `Crypto watch input is missing defaults: ${pagesUi.marketsInputValue}`
  )
  expect(pagesUi.marketsDefaults, 'Crypto watch defaults are unexpected')
  expect(pagesUi.marketsEmptyRejected, `Crypto watch accepted an empty list: ${pagesUi.marketsMessage}`)
  expect(pagesUi.marketsTooManyRejected, `Crypto watch accepted too many coins: ${pagesUi.marketsMessage}`)
  expect(
    pagesUi.marketsBadChartRejected,
    `Crypto chart accepted an invalid coin id: ${pagesUi.marketsMessage}`
  )
  expect(
    pagesUi.marketsBadRangeRejected,
    `Crypto chart accepted an invalid range: ${pagesUi.marketsMessage}`
  )
  expect(pagesUi.launchpadCard, 'AI launchpad card is missing from the workspace page')
  expect(pagesUi.launchpadTool, 'AI launchpad did not open')
  expect(pagesUi.launchpadTiles === 10, `AI launchpad shows ${pagesUi.launchpadTiles} tiles, expected 10`)
  expect(pagesUi.launchpadManage, 'AI launchpad settings did not open')
  expect(pagesUi.launchpadLinksFirst, 'custom links are not shown before the preset list')
  expect(pagesUi.launchpadFiltered, 'AI launchpad preset filter did not narrow the list')
  expect(pagesUi.launchpadFilterCase, 'AI launchpad preset filter is not case-insensitive')
  expect(pagesUi.launchpadFilterTrim, 'AI launchpad preset filter does not trim whitespace')
  expect(pagesUi.launchpadFilterHint, 'AI launchpad preset filter does not match hint text')
  expect(pagesUi.launchpadFilterEmpty, 'AI launchpad filter did not show an empty result')
  expect(pagesUi.launchpadFilterCustom, 'AI launchpad custom link could not be added while filtering')
  expect(
    pagesUi.launchpadFilterKeepsCustom,
    'AI launchpad preset filter hides custom links'
  )
  expect(
    pagesUi.launchpadFilterReset,
    'AI launchpad filter is not cleared when the panel is closed'
  )
  expect(
    pagesUi.launchpadCatalog >= 25,
    `AI launchpad catalog has only ${pagesUi.launchpadCatalog} entries`
  )
  expect(pagesUi.launchpadDefaults, 'AI launchpad default selection is unexpected')
  expect(pagesUi.launchpadToggleOff, 'AI launchpad could not hide a preset')
  expect(pagesUi.launchpadToggleOn, 'AI launchpad could not restore a preset')
  expect(
    pagesUi.launchpadToggleUnknownRejected,
    `AI launchpad accepted an unknown preset: ${pagesUi.launchpadMessage}`
  )
  expect(
    pagesUi.launchpadBadUrlRejected,
    `AI launchpad accepted a non-web link: ${pagesUi.launchpadMessage}`
  )
  expect(pagesUi.launchpadCustomAdded, `AI launchpad custom link failed: ${pagesUi.launchpadMessage}`)
  expect(pagesUi.launchpadCustomRemoved, 'AI launchpad could not remove a custom link')
  expect(
    pagesUi.launchpadOpenUnknownRejected,
    `AI launchpad opened an unknown shortcut: ${pagesUi.launchpadMessage}`
  )
  expect(pagesUi.artistwaveTool, 'ArtistWave player page did not open')
  expect(pagesUi.artistwaveLaunch, 'ArtistWave player is missing its embedded frame')
  expect(pagesUi.artistwaveHeader, 'ArtistWave player button is missing beside the clock')
  expect(pagesUi.artistwaveAttached, 'ArtistWave did not attach to the embedded page')
  expect(pagesUi.artistwaveDetached, 'ArtistWave did not detach cleanly')
  expect(
    pagesUi.artistwaveMiniResized,
    `ArtistWave mini window did not shrink/restore: ${pagesUi.artistwaveMiniWidth} -> ${pagesUi.artistwaveMiniRestoredWidth}`
  )
  expect(
    pagesUi.artistwaveCommandRejected,
    `ArtistWave accepted a command without an open player: ${pagesUi.artistwaveMessage}`
  )
  expect(
    pagesUi.artistwaveInvalidRejected,
    `ArtistWave accepted an unknown command: ${pagesUi.artistwaveMessage}`
  )
  expect(pagesUi.playerClosed, 'Stopping ArtistWave did not return to the dashboard')
  expect(
    pagesUi.widgetHost?.full?.mode === 'mode-full',
    `ArtistWave reopened in ${pagesUi.widgetHost?.full?.mode}, expected mode-full`
  )
  expect(pagesUi.widgetHost?.full?.rail === true, 'full player is missing the tool rail')
  expect(
    pagesUi.widgetHost?.full?.mini === false && pagesUi.widgetHost?.full?.miniClass === false,
    'full player reported a mini state'
  )
  expect(pagesUi.widgetHost?.openedNotes === true, 'Quick notes rail button was not found')
  expect(
    pagesUi.widgetHost?.notes?.mode === 'mode-host',
    `glued notes ran in ${pagesUi.widgetHost?.notes?.mode}, expected mode-host`
  )
  expect(
    pagesUi.widgetHost?.notes?.screenTitle === 'Quick notes',
    `host screen title was "${pagesUi.widgetHost?.notes?.screenTitle}"`
  )
  expect(
    pagesUi.widgetHost?.notes?.mini === true && pagesUi.widgetHost?.notes?.miniClass === true,
    'glued widget did not switch the embedded player to mini'
  )
  expect(
    pagesUi.widgetHost?.notes?.width >= 800,
    `host window width was ${pagesUi.widgetHost?.notes?.width}`
  )
  expect(pagesUi.widgetHost?.openedCrypto === true, 'Crypto watch rail button was not found')
  expect(
    pagesUi.widgetHost?.crypto?.mode === 'mode-host',
    `switching rail widgets left host mode (${pagesUi.widgetHost?.crypto?.mode})`
  )
  expect(
    pagesUi.widgetHost?.crypto?.screenTitle === 'Crypto watch',
    `crypto host title was "${pagesUi.widgetHost?.crypto?.screenTitle}"`
  )
  expect(pagesUi.widgetHost?.backToFull === true, 'ArtistWave rail button was not found')
  expect(
    pagesUi.widgetHost?.fullAgain?.mode === 'mode-full',
    `returning to the player gave ${pagesUi.widgetHost?.fullAgain?.mode}`
  )
  expect(
    pagesUi.widgetHost?.fullAgain?.screen === false,
    'host screen stayed glued after returning to the full player'
  )
  expect(
    pagesUi.widgetHost?.fullAgain?.mini === false &&
      pagesUi.widgetHost?.fullAgain?.miniClass === false,
    'mini player stayed on after returning to the full player'
  )
  expect(
    pagesUi.widgetHost?.fullAgain?.width >= 900,
    `full player window width was ${pagesUi.widgetHost?.fullAgain?.width}`
  )
  expect(pagesUi.widgetHost?.exclusive === true, 'full and mini player state disagreed')
  expect(pagesUi.widgetHost?.exitDashboard === true, 'dashboard rail button was not found')
  expect(pagesUi.widgetHost?.homeAfter === true, 'widget host did not return to the dashboard')
  expect(pagesUi.modelFarm?.card === true, 'Model Farm tool did not open')
  expect(pagesUi.modelFarm?.machine === true, 'Model Farm is missing the machine scorecard')
  expect(pagesUi.modelFarm?.axes === 4, `Model Farm shows ${pagesUi.modelFarm?.axes} grade axes, expected 4`)
  expect(pagesUi.modelFarm?.controls === true, 'Model Farm is missing its filter controls')
  expect(pagesUi.modelFarm?.status?.cores > 0, 'Model Farm did not detect the CPU')
  expect(pagesUi.modelFarm?.status?.totalRamBytes > 0, 'Model Farm did not detect RAM')
  expect(typeof pagesUi.modelFarm?.status?.grade === 'number', 'Model Farm did not grade the machine')
  expect(pagesUi.modelFarm?.status?.axes === 4, 'Model Farm grade is missing its axes')
  expect(pagesUi.modelFarm?.prefsRoundTrip === true, 'Model Farm preferences did not persist')
  expect(pagesUi.modelFarm?.scenarioToggled === true, 'Model Farm scenario toggle did not switch on')
  expect(
    pagesUi.modelFarm?.emptyRepoRejected === true,
    `Model Farm accepted an empty repo: ${pagesUi.modelFarm?.installMessage}`
  )
  // The catalog is a live HuggingFace fetch: it must render groups, explain an
  // empty result, or still be fetching when the wait ends.
  expect(
    (pagesUi.modelFarm?.groups ?? 0) > 0 ||
      (pagesUi.modelFarm?.emptyOrError?.length ?? 0) > 0 ||
      pagesUi.modelFarm?.catalogState === 'timeout',
    `Model Farm rendered no catalog and no state (${pagesUi.modelFarm?.catalogState})`
  )
  if (pagesUi.modelFarm?.groups > 0) {
    expect(pagesUi.modelFarm.models > 0, 'Model Farm rendered groups without models')
  }
  expect(pagesUi.bartenderTool, 'Bartender Aid did not open')
  expect(pagesUi.bartenderLaunch, 'Bartender Aid is missing its load/refresh control')
  expect(pagesUi.bartenderCached, 'Bartender Aid did not restore the cached bar list')
  expect(
    pagesUi.bartenderChips === 3,
    `Bartender Aid shows ${pagesUi.bartenderChips} ingredient chips, expected 3`
  )
  expect(
    /2 selected/i.test(pagesUi.bartenderSelected),
    `Bartender Aid did not restore the selected count: ${pagesUi.bartenderSelected}`
  )
  expect(
    pagesUi.bartenderNoSelectionRejected,
    `Bartender Aid accepted an empty selection: ${pagesUi.bartenderMessage}`
  )
  expect(
    pagesUi.bartenderUnknownRejected,
    `Bartender Aid accepted an unknown ingredient: ${pagesUi.bartenderMessage}`
  )
  expect(pagesUi.backToWorkspace, 'could not return to the workspace page')
  expect(pagesUi.workspaceCardsAfter === 19, 'workspace cards did not return after switching back')
  expect(headerUi.presentHome, 'header status is missing on the dashboard')
  expect(headerUi.timeShape, 'header clock has an unexpected shape')
  expect(headerUi.dateLength > 3, 'header clock is missing its date')
  expect(headerUi.setCityInitial, 'header did not show the empty weather state')
  expect(headerUi.presentSettings, 'header status is missing on the settings page')
  expect(headerUi.presentTool, 'header status is missing on a tool page')
  expect(headerUi.openedClock, 'clicking the header did not open Clock & weather')
  expect(headerUi.openedClockSearch, 'empty header weather state did not open city search')
  expect(headerUi.cityUpdated, `header did not show the chosen city: ${headerUi.headerTextAfterCity}`)
  expect(headerUi.setCityRestored, 'header did not return to the empty weather state')
  // Nine tools wrap to a third row at the default window size, so the
  // dashboard scrolls by one row; the guard catches unbounded overflow.
  expect(
    headerUi.homeOverflow <= 260,
    `dashboard scrolls at the default window height (overflow ${headerUi.homeOverflow}px)`
  )
  expect(vaultMenuUi.cardFound, 'vault card is missing for the context-menu test')
  expect(vaultMenuUi.menuOpen, 'right-click did not open the vault secret menu')
  expect(vaultMenuUi.itemCount === 2, `vault menu listed ${vaultMenuUi.itemCount} secrets, expected 2`)
  expect(vaultMenuUi.firstName === 'Context key', `vault menu listed "${vaultMenuUi.firstName}"`)
  expect(vaultMenuUi.menuInsideViewport, 'vault menu escaped the viewport')
  expect(vaultMenuUi.closed, 'vault menu stayed open after choosing a secret')
  expect(vaultMenuUi.notice.includes('Context key'), 'vault menu copy did not report success')
  expect(!vaultMenuUi.leakedToHistory, 'vault menu copy leaked into clipboard history')
  expect(menuClipboard === 'context-secret-value', 'vault menu did not copy the selected secret')
  expect(ui.rendererErrors.length === 0, `renderer errors: ${ui.rendererErrors.join(' | ')}`)
  expect(consoleErrors.length === 0, `console errors: ${consoleErrors.join(' | ')}`)

  console.log(
    JSON.stringify(
      {
        ui,
        files,
        cleanup,
        backupInfo,
        tamperCheck,
        userToolApi,
        userToolUi,
        updatesApi,
        pinOn,
        pinnedState,
        pinOff,
        unpinnedState,
        miniEntry,
        compactSize,
        miniAction,
        restoredSize,
        uiRestore,
        sizeControl,
        clockUi,
        pagesUi,
        headerUi,
        vaultMenuUi,
        menuClipboard,
        consoleErrors,
        failures,
        userDataDir
      },
      null,
      2
    )
  )

  await clipboard.writeText(originalClipboard).catch(() => {})
  fs.rmSync(fileDir, { recursive: true, force: true })
  try {
    fs.rmSync(backupDir, { recursive: true, force: true })
  } catch {
    // Intentionally ignored.
  }
  try {
    // Electron keeps profile files locked until the process exits; the OS cleans
    // up anything left behind in the temp directory.
    fs.rmSync(userDataDir, { recursive: true, force: true })
  } catch {
    // Intentionally ignored.
  }

  if (failures.length > 0) {
    console.error(`SMOKE TEST FAILED (${failures.length})`)
    app.exit(1)
  } else {
    console.log('SMOKE TEST PASSED')
    app.exit(0)
  }
}

main().catch((cause) => {
  console.error('SMOKE TEST CRASHED:', cause)
  app.exit(1)
})
