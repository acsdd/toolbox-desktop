/**
 * Captures UI screenshots of the production build for visual verification.
 * Run with: npm run screenshots
 */
const { app, BrowserWindow, desktopCapturer } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolbox-shots-userdata-'))
app.setPath('userData', userDataDir)

const outputDir = path.join(__dirname, '..', '.screenshots')
fs.mkdirSync(outputDir, { recursive: true })

require('../out/main/index.js')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
  const win = await waitForWindow()
  win.setSize(1180, 940)
  win.show()
  win.focus()
  win.setAlwaysOnTop(true)
  win.webContents.setBackgroundThrottling(false)
  await delay(900)

  await win.webContents.executeJavaScript(`window.api.userTools.installExample()`)
  await win.webContents.executeJavaScript(
    `localStorage.setItem('toolbox.weatherCity', JSON.stringify({ id: 2267057, name: 'Lisbon', country: 'Portugal', region: 'Lisbon', latitude: 38.7167, longitude: -9.1333, timezone: 'Europe/Lisbon' }))`
  )
  const reloaded = new Promise((resolve) => win.webContents.once('did-finish-load', resolve))
  win.webContents.reload()
  await reloaded
  await delay(2500)

  const capture = async (name) => {
    await win.webContents.executeJavaScript(
      'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
    )
    await delay(200)
    const image = await win.webContents.capturePage()
    const target = path.join(outputDir, `${name}.png`)
    fs.writeFileSync(target, image.toPNG())
    console.log(`saved ${target} (${image.getSize().width}x${image.getSize().height})`)
  }

  // webContents.capturePage() returns the embedded iframe blank on Windows, so
  // grab this window from the compositor instead.
  const captureWindow = async (name) => {
    // The compositor only refreshes an occluded window's surfaces, so bring it
    // to the front briefly before grabbing it.
    win.show()
    win.focus()
    win.moveTop()
    await delay(1200)
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 1200, height: 1000 }
    })
    const source = sources.find((item) => /Toolbox/i.test(item.name))
    if (!source) throw new Error('Toolbox window source not found for capture')
    const image = source.thumbnail
    const target = path.join(outputDir, `${name}.png`)
    fs.writeFileSync(target, image.toPNG())
    console.log(`saved ${target} (${image.getSize().width}x${image.getSize().height})`)
  }

  // The dashboard grew a third row, so give the docs shot enough height to show
  // every card and the footer instead of clipping the last row.
  const overflow = await win.webContents.executeJavaScript(`(() => {
    const node = document.querySelector('.content')
    return node ? Math.max(0, Math.ceil(node.scrollHeight - node.clientHeight)) : 0
  })()`)
  if (overflow > 0) {
    win.setContentSize(1164, 901 + overflow + 4)
    await delay(700)
  }
  await capture('01-home')
  if (overflow > 0) {
    win.setContentSize(1164, 901)
    await delay(400)
  }

  await win.webContents.executeJavaScript(`(() => {
    const tabs = [...document.querySelectorAll('.home-switch button')]
    tabs[1]?.click()
  })()`)
  await delay(600)
  await capture('01b-connected-page')

  await win.webContents.executeJavaScript(`(() => {
    const card = [...document.querySelectorAll('.tool-card')].find(
      (item) => item.querySelector('h3')?.textContent === 'Gmail announcer'
    )
    card?.click()
  })()`)
  await delay(900)
  await capture('01c-gmail-announcer')

  await win.webContents.executeJavaScript(`document.querySelector('.back-button')?.click()`)
  await delay(400)

  await win.webContents.executeJavaScript(`(() => {
    const card = [...document.querySelectorAll('.tool-card')].find(
      (item) => item.querySelector('h3')?.textContent === 'GitHub notifier'
    )
    card?.click()
  })()`)
  await delay(900)
  await capture('01d-github-notifier')

  await win.webContents.executeJavaScript(`document.querySelector('.back-button')?.click()`)
  await delay(400)

  await win.webContents.executeJavaScript(`(async () => {
    await window.api.feeds.add('https://hnrss.org/frontpage').catch(() => null)
    await window.api.feeds.refresh().catch(() => null)
    const card = [...document.querySelectorAll('.tool-card')].find(
      (item) => item.querySelector('h3')?.textContent === 'RSS reader'
    )
    card?.click()
  })()`)
  await delay(900)
  await capture('01e-rss-reader')

  await win.webContents.executeJavaScript(`document.querySelector('.back-button')?.click()`)
  await delay(400)

  await win.webContents.executeJavaScript(`(async () => {
    const card = [...document.querySelectorAll('.tool-card')].find(
      (item) => item.querySelector('h3')?.textContent === 'Crypto watch'
    )
    card?.click()
    await window.api.markets.refresh().catch(() => null)
  })()`)
  await delay(900)
  await win.webContents.executeJavaScript(`(() => {
    const row = [...document.querySelectorAll('.market-row')].find((item) =>
      item.textContent?.includes('Bitcoin')
    )
    row?.querySelector('.market-chart-toggle')?.click()
  })()`)
  await win.webContents.executeJavaScript(`new Promise((resolve) => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (document.querySelector('.market-chart-svg') || Date.now() - started > 10000) {
        clearInterval(timer)
        resolve(true)
      }
    }, 200)
  })`)
  await delay(400)
  await capture('01f-crypto-watch')

  await win.webContents.executeJavaScript(`document.querySelector('.back-button')?.click()`)
  await delay(400)

  await win.webContents.executeJavaScript(`(() => {
    const tabs = [...document.querySelectorAll('.home-switch button')]
    tabs[0]?.click()
  })()`)
  await delay(500)
  await win.webContents.executeJavaScript(`(() => {
    const card = [...document.querySelectorAll('.tool-card')].find(
      (item) => item.querySelector('h3')?.textContent === 'AI launchpad'
    )
    card?.click()
  })()`)
  await delay(1200)
  await capture('01g-launchpad')

  await win.webContents.executeJavaScript(
    `document.querySelector('.launchpad-strip .ghost-button')?.click()`
  )
  await delay(700)
  await capture('01g2-launchpad-manage')

  await win.webContents.executeJavaScript(`document.querySelector('.back-button')?.click()`)
  await delay(400)
  await win.webContents.executeJavaScript(`(() => {
    const tabs = [...document.querySelectorAll('.home-switch button')]
    tabs[1]?.click()
  })()`)
  await delay(500)

  await win.webContents.executeJavaScript(`(() => {
    const card = [...document.querySelectorAll('.tool-card')].find(
      (item) => item.querySelector('h3')?.textContent === 'ArtistWave'
    )
    card?.click()
  })()`)
  await delay(7000)
  await captureWindow('01h-artistwave')

  // Mode B — full player with the vertical widget rail on the right.
  await captureWindow('01h2-player-rail')

  const clickRail = (label) =>
    win.webContents.executeJavaScript(`(() => {
      const btn = [...document.querySelectorAll('.rail-tool')].find(
        (item) => item.getAttribute('aria-label') === ${JSON.stringify(label)}
      )
      if (!btn) return 'NO_RAIL_BUTTON'
      btn.click()
      return 'CLICKED'
    })()`)

  // Mode A — glue the Notes widget beside the mini player.
  console.log('rail notes:', await clickRail('Quick notes'))
  await delay(4000)
  await captureWindow('01h3-host-notes')

  // Mode A — swap the glued widget to Crypto watch (existing component as-is).
  console.log('rail crypto:', await clickRail('Crypto watch'))
  await delay(2500)
  await captureWindow('01h4-host-crypto')

  // Back to Mode B — opening the full player closes the mini player.
  console.log('rail artistwave:', await clickRail('ArtistWave'))
  await delay(2500)
  await captureWindow('01h5-player-full-again')

  await win.webContents.executeJavaScript(`document.querySelector('.player-stop')?.click()`)
  await delay(400)

  await win.webContents.executeJavaScript(`(async () => {
    const loaded = await window.api.bartender.load().catch(() => null)
    const status = loaded ?? (await window.api.bartender.status().catch(() => null))
    const wanted = ['Tequila', 'Triple Sec', 'Lime Juice', 'Salt', 'Simple Syrup']
    const picks = (status?.ingredients ?? [])
      .filter((item) => wanted.includes(item.name))
      .map((item) => item.id)
    if (picks.length > 0) await window.api.bartender.match(picks).catch(() => null)
    const card = [...document.querySelectorAll('.tool-card')].find(
      (item) => item.querySelector('h3')?.textContent === 'Bartender Aid'
    )
    card?.click()
  })()`)
  await delay(1200)
  await capture('01i-bartender')

  await win.webContents.executeJavaScript(`(async () => {
    document.querySelector('.bartender-results')?.scrollIntoView({ block: 'start' })
    await new Promise((resolve) => setTimeout(resolve, 350))
    document.querySelector('.bartender-recipe-head')?.click()
    await new Promise((resolve) => setTimeout(resolve, 350))
    document.querySelector('.bartender-results')?.scrollIntoView({ block: 'start' })
  })()`)
  await delay(500)
  await capture('01j-bartender-recipe')

  await win.webContents.executeJavaScript(`document.querySelector('.back-button')?.click()`)
  await delay(400)
  await win.webContents.executeJavaScript(`(() => {
    const tabs = [...document.querySelectorAll('.home-switch button')]
    tabs[0]?.click()
  })()`)
  await delay(500)

  const headerRect = await win.webContents.executeJavaScript(`(() => {
    const node = document.querySelector('.header-status')
    if (!node) return null
    const rect = node.getBoundingClientRect()
    return {
      x: Math.max(0, Math.floor(rect.left - 18)),
      y: Math.max(0, Math.floor(rect.top - 12)),
      width: Math.ceil(rect.width + 36),
      height: Math.ceil(rect.height + 24),
      text: node.textContent
    }
  })()`)

  if (headerRect) {
    const image = await win.webContents.capturePage(headerRect)
    const target = path.join(outputDir, '00-header-status.png')
    fs.writeFileSync(target, image.toPNG())
    console.log(`saved ${target} (${image.getSize().width}x${image.getSize().height}) ${headerRect.text}`)
  }

  const names = await win.webContents.executeJavaScript(
    `[...document.querySelectorAll('.tool-card h3')].map((node) => node.textContent)`
  )
  const shotNumber = (offset) => String(names.length + offset).padStart(2, '0')

  const demoBackupDir = path.join(os.tmpdir(), 'toolbox-shots-backups')
  fs.mkdirSync(demoBackupDir, { recursive: true })
  await win.webContents.executeJavaScript(
    `localStorage.setItem('toolbox.backupDir', ${JSON.stringify(demoBackupDir)})`
  )

  for (let index = 0; index < names.length; index++) {
    const clicked = await win.webContents.executeJavaScript(`(() => {
      const card = document.querySelectorAll('.tool-card')[${index}]
      if (!card) return 'NO_CARD'
      card.click()
      return card.querySelector('h3')?.textContent ?? 'CLICKED'
    })()`)
    await delay(
      clicked === 'System dashboard'
        ? 4600
        : clicked === 'Clock & weather'
          ? 5000
          : clicked === 'Model Farm'
            ? 16000
            : 900
    )
    const heading = await win.webContents.executeJavaScript(
      `document.querySelector('.tool-heading h1')?.textContent ?? document.querySelector('.hero h1')?.textContent ?? 'UNKNOWN'`
    )
    console.log(`clicked=${clicked} heading=${heading}`)
    const slug = names[index].toLowerCase().replace(/[^a-z0-9]+/g, '-')
    await capture(`${String(index + 2).padStart(2, '0')}-${slug}`)
    await win.webContents.executeJavaScript(`document.querySelector('.back-button').click()`)
    await delay(400)
  }

  await win.webContents.executeJavaScript(
    `document.querySelector('.settings-toggle').click()`
  )
  await delay(500)
  await capture(`${shotNumber(2)}-settings`)

  await win.webContents.executeJavaScript(
    `document.querySelector('.updates-panel')?.scrollIntoView({ block: 'center' })`
  )
  await delay(400)
  await capture(`${shotNumber(2)}b-updates`)

  await win.webContents.executeJavaScript(
    `document.querySelector('.user-tools-panel')?.scrollIntoView({ block: 'center' })`
  )
  await delay(400)
  await capture(`${shotNumber(3)}-user-tools`)

  await win.webContents.executeJavaScript(`document.querySelector('.back-button')?.click()`)
  await delay(400)
  await win.webContents.executeJavaScript(`document.querySelector('.mini-toggle')?.click()`)
  await delay(900)
  await capture(`${shotNumber(4)}-mini-bar`)

  await win.webContents.executeJavaScript(`document.querySelector('.mini-pin')?.click()`)
  await delay(300)
  await capture(`${shotNumber(5)}-mini-pinned`)

  await win.webContents.executeJavaScript(`document.querySelector('.mini-pin')?.click()`)
  await win.webContents.executeJavaScript(`document.querySelector('.mini-expand')?.click()`)
  await delay(900)
  await capture(`${shotNumber(6)}-home-restored`)

  await win.webContents.executeJavaScript(
    `document.querySelectorAll('.card-size-button')[0]?.click()`
  )
  await delay(500)
  await capture(`${shotNumber(7)}-cards-small`)

  await win.webContents.executeJavaScript(
    `document.querySelectorAll('.card-size-button')[2]?.click()`
  )
  await delay(500)
  await capture(`${shotNumber(8)}-cards-large`)

  await win.webContents.executeJavaScript(`(async () => {
    await window.api.vault.add({
      name: 'OpenAI API key',
      value: 'sk-demo-not-a-real-key',
      notes: 'Personal project'
    })
    await window.api.vault.add({
      name: 'Mapbox token',
      value: 'pk-demo-not-a-real-token',
      notes: 'Staging site'
    })
    document.querySelectorAll('.card-size-button')[1]?.click()
  })()`)
  await delay(500)

  await win.webContents.executeJavaScript(`(() => {
    const card = [...document.querySelectorAll('.tool-card')].find(
      (item) => item.querySelector('h3')?.textContent === 'API vault'
    )
    card?.click()
  })()`)
  await delay(900)

  await win.webContents.executeJavaScript(`(() => {
    const panel = document.querySelector('.vault-tool')
    panel?.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 360,
        clientY: 430
      })
    )
  })()`)
  await delay(400)
  await capture(`${shotNumber(9)}-vault-menu`)

  await win.webContents.executeJavaScript(`document.querySelector('.back-button')?.click()`)
  await delay(400)
  await win.webContents.executeJavaScript(
    `document.querySelectorAll('.card-size-button')[1]?.click()`
  )
  win.setSize(1180, 780)
  await delay(700)
  await capture('18-home-default-height')

  await delay(200)
  app.exit(0)
}

main().catch((cause) => {
  console.error('SCREENSHOT RUN FAILED:', cause)
  app.exit(1)
})
