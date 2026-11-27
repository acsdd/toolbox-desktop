/** Focused production-build check for the Desktop command bar and navigation rail. */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')

function compositeColor(foreground, background) {
  const alpha = foreground[3] / 255
  return [0, 1, 2]
    .map((index) => Math.round(foreground[index] * alpha + background[index] * (1 - alpha)))
    .concat(255)
}

function contrastRatio(first, second) {
  const luminance = (color) => color
    .slice(0, 3)
    .map((value) => value / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
  const a = luminance(first)
  const b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

async function readActiveStateContrast(win) {
  const colors = await win.webContents.executeJavaScript(`(() => {
    const active = document.querySelector('.sidebar-tool.active')
    const sidebar = document.querySelector('.tool-sidebar')
    if (!active || !sidebar) return null

    const activeStyle = getComputedStyle(active)
    const sidebarStyle = getComputedStyle(sidebar)
    const colorPattern = /(?:rgba?\\([^)]*\\)|color\\([^)]*\\)|#[0-9a-f]{3,8})/i
    const sidebarBackground = sidebarStyle.backgroundImage.match(colorPattern)?.[0]
    const indicator = activeStyle.boxShadow.match(colorPattern)?.[0]
    if (!sidebarBackground || !indicator) return null

    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d')
    const rgba = (value) => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = value
      context.fillRect(0, 0, 1, 1)
      return [...context.getImageData(0, 0, 1, 1).data]
    }

    return {
      sidebar: rgba(sidebarBackground),
      active: rgba(activeStyle.backgroundColor),
      border: rgba(activeStyle.borderTopColor),
      indicator: rgba(indicator)
    }
  })()`)
  assert.ok(colors, 'Active sidebar state colors are missing')

  const active = compositeColor(colors.active, colors.sidebar)
  return {
    border: contrastRatio(compositeColor(colors.border, colors.sidebar), colors.sidebar),
    indicator: contrastRatio(compositeColor(colors.indicator, active), active)
  }
}

const rendererErrors = []
const capturePrimed = new WeakSet()
const startupErrorScript = `(() => {
  window.__uxErrors = []
  window.addEventListener('error', (event) => {
    window.__uxErrors.push('error: ' + event.message)
  })
  window.addEventListener('unhandledrejection', (event) => {
    window.__uxErrors.push('rejection: ' + String(event.reason))
  })
})()`

app.on('web-contents-created', (_event, webContents) => {
  webContents.on('console-message', (event) => {
    if (event.level === 'error') {
      rendererErrors.push(`console: ${event.message}`)
      console.log(`renderer: ${event.message}`)
    }
  })
})

const loadFile = BrowserWindow.prototype.loadFile
const loadURL = BrowserWindow.prototype.loadURL
const capturePage = 'about:blank'

async function loadWithStartupCapture(win, method, args) {
  if (!capturePrimed.has(win.webContents)) {
    capturePrimed.add(win.webContents)
    try {
      await loadURL.call(win, capturePage)
      win.webContents.debugger.attach('1.3')
      await win.webContents.debugger.sendCommand('Page.enable')
      await win.webContents.debugger.sendCommand('Runtime.enable')
      await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: startupErrorScript
      })
    } catch (error) {
      rendererErrors.push(`capture: ${error.message}`)
    }
  }
  return method === 'loadURL' ? loadURL.apply(win, args) : loadFile.apply(win, args)
}

BrowserWindow.prototype.loadFile = function (...args) {
  return loadWithStartupCapture(this, 'loadFile', args)
}
BrowserWindow.prototype.loadURL = function (...args) {
  return loadWithStartupCapture(this, 'loadURL', args)
}

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'toolbox-ux-smoke-')))
BrowserWindow.prototype.show = function () {}
require('../out/main/index.js')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForWindow() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const win = BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed())
    if (win && !win.webContents.isLoading()) return win
    await delay(100)
  }
  throw new Error('BrowserWindow did not finish loading.')
}

async function waitFor(win, source, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await win.webContents.executeJavaScript(`(${source})()`)) return
    await delay(50)
  }
  throw new Error(`Timed out waiting for ${label}.`)
}

async function click(win, selector) {
  const clicked = await win.webContents.executeJavaScript(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)})
    if (!target) return false
    target.click()
    return true
  })()`)
  assert.equal(clicked, true, `Missing click target: ${selector}`)
}

async function runCommand(win, command) {
  await win.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('.terminal-input')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(command)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.closest('form').requestSubmit()
  })()`)
}

app.whenReady().then(async () => {
  const win = await waitForWindow()
  await delay(400)

  const navigation = await win.webContents.executeJavaScript(`(() => ({
    sidebar: Boolean(document.querySelector('.tool-sidebar')),
    labels: [...document.querySelectorAll('.sidebar-group-label')].map((node) => node.textContent),
    home: Boolean(document.querySelector('.sidebar-home')),
    manage: Boolean(document.querySelector('.sidebar-manage')),
    tools: [...document.querySelectorAll('.sidebar-tool')].map((node) => node.getAttribute('aria-label')),
    terminalButton: Boolean(document.querySelector('.terminal-button'))
  }))()`)

  assert.equal(navigation.sidebar, true, 'Persistent sidebar is missing')
  assert.deepEqual(navigation.labels, ['AI', 'IT'])
  assert.equal(navigation.home, true, 'Home navigation is missing')
  assert.equal(navigation.manage, true, 'Manage navigation is missing')
  assert.equal(navigation.terminalButton, true, 'Terminal entry point is missing')
  for (const name of ['AI launchpad', 'Model Farm', 'System dashboard', 'API vault']) {
    assert.equal(navigation.tools.includes(name), true, `${name} is missing from the sidebar`)
  }
  console.log('UX: navigation checked')

  const nightSidebarBackground = await win.webContents.executeJavaScript(
    `getComputedStyle(document.querySelector('.tool-sidebar')).backgroundImage`
  )
  await win.webContents.executeJavaScript(`(() => {
    const select = document.querySelector('[aria-label="Color theme"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    setter.call(select, 'day')
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await waitFor(win, `() => document.documentElement.dataset.theme === 'day'`, 'Day theme')
  await waitFor(
    win,
    `() => getComputedStyle(document.querySelector('.terminal-button')).color === 'rgb(36, 63, 49)'`,
    'Day terminal colors'
  )
  const dayColors = await win.webContents.executeJavaScript(`(() => ({
    sidebarBackground: getComputedStyle(document.querySelector('.tool-sidebar')).backgroundImage,
    terminalColor: getComputedStyle(document.querySelector('.terminal-button')).color
  }))()`)
  assert.notEqual(dayColors.sidebarBackground, nightSidebarBackground, 'Sidebar must follow the Day theme')
  assert.equal(dayColors.terminalColor, 'rgb(36, 63, 49)', 'Terminal button must use Day theme text')

  await click(win, '.sidebar-tool[aria-label="Model Farm"]')
  await waitFor(
    win,
    `() => document.querySelector('.tool-heading h1')?.textContent === 'Model Farm'`,
    'Day active tool'
  )
  await win.webContents.executeJavaScript(
    `Promise.all(document.querySelector('.sidebar-tool.active').getAnimations().map((animation) => animation.finished))`
  )
  const dayActiveToolColor = await win.webContents.executeJavaScript(
    `getComputedStyle(document.querySelector('.sidebar-tool.active')).color`
  )
  assert.equal(
    dayActiveToolColor,
    'rgb(36, 63, 49)',
    'Active sidebar tools must use Day theme text'
  )
  const activeContrast = await readActiveStateContrast(win)
  assert.ok(
    activeContrast.border >= 3 && activeContrast.indicator >= 3,
    `Day active-state indicators must reach 3:1 (border ${activeContrast.border.toFixed(2)}:1, marker ${activeContrast.indicator.toFixed(2)}:1)`
  )
  console.log(
    `UX: Day active-state contrast checked (border ${activeContrast.border.toFixed(2)}:1, marker ${activeContrast.indicator.toFixed(2)}:1)`
  )
  await click(win, '.sidebar-home')
  await waitFor(win, `() => Boolean(document.querySelector('.home'))`, 'dashboard after Day tool')
  console.log('UX: Day theme contrast checked')

  await click(win, '.terminal-button')
  await waitFor(win, `() => Boolean(document.querySelector('.terminal-view'))`, 'Terminal view')
  const terminalFocusRule = await win.webContents.executeJavaScript(`(() => {
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (!rule.selectorText) continue
        const selectors = rule.selectorText.split(',').map((selector) => selector.trim())
        if (selectors.includes('.terminal-input:focus')) {
          return { outlineStyle: rule.style.outlineStyle, outlineWidth: rule.style.outlineWidth }
        }
      }
    }
    return null
  })()`)
  assert.deepEqual(
    terminalFocusRule,
    { outlineStyle: 'solid', outlineWidth: '2px' },
    'Terminal input must have a visible focus ring'
  )
  const terminalOnly = await win.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('.terminal-input')
    return {
      topbar: Boolean(document.querySelector('.topbar')),
      sidebar: Boolean(document.querySelector('.tool-sidebar')),
      home: Boolean(document.querySelector('.home')),
      tool: Boolean(document.querySelector('.tool-surface')),
      input: Boolean(input),
      status: Boolean(document.querySelector('.terminal-status')),
      terminalColor: getComputedStyle(document.querySelector('.terminal-button')).color,
      placeholderColor: getComputedStyle(input, '::placeholder').color
    }
  })()`)
  assert.deepEqual(terminalOnly, {
    topbar: true,
    sidebar: true,
    home: false,
    tool: false,
    input: true,
    status: true,
    terminalColor: 'rgb(36, 63, 49)',
    placeholderColor: 'rgb(143, 169, 199)'
  })
  console.log('UX: terminal-only view checked')

  await runCommand(win, 'help')
  await waitFor(
    win,
    `() => document.querySelector('.terminal-output')?.textContent.includes('open <tool>')`,
    'help output'
  )
  console.log('UX: help command checked')

  await runCommand(win, 'status')
  await waitFor(
    win,
    `() => {
      const output = document.querySelector('.terminal-output')?.textContent ?? ''
      return output.includes('CPU ') && output.includes('Disk ')
    }`,
    'system status output'
  )
  console.log('UX: status command checked')

  console.log('UX: sending ArrowUp')
  await win.webContents.executeJavaScript(`(() => {
    document.querySelector('.terminal-input').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
    )
  })()`)
  await waitFor(win, `() => document.querySelector('.terminal-input')?.value === 'status'`, 'command history')
  console.log('UX: command history checked')

  await runCommand(win, 'clear')
  await waitFor(win, `() => document.querySelectorAll('.terminal-entry').length === 0`, 'clear output')
  console.log('UX: clear command checked')

  await runCommand(win, 'home')
  await waitFor(win, `() => Boolean(document.querySelector('.home'))`, 'home command')
  console.log('UX: home command checked')

  console.log('UX: opening Manage')
  await click(win, '.sidebar-manage')
  await waitFor(win, `() => Boolean(document.querySelector('.updates-field input'))`, 'release source setting')
  const releaseSource = await win.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('.updates-field input')
    return { value: input.value, type: input.type }
  })()`)
  assert.deepEqual(releaseSource, { value: 'acsdd/toolbox-desktop', type: 'text' })
  console.log('UX: release source checked')

  await click(win, '[aria-label="Enable API vault"]')
  await click(win, '.back-button')
  await waitFor(win, `() => Boolean(document.querySelector('.home'))`, 'dashboard after Manage')
  const hiddenFromSidebar = await win.webContents.executeJavaScript(
    `document.querySelector('.sidebar-tool[aria-label="API vault"]') === null`
  )
  assert.equal(hiddenFromSidebar, true, 'Hidden tools must be omitted from the sidebar')
  console.log('UX: hidden tool omitted from sidebar')

  await click(win, '.sidebar-manage')
  await waitFor(win, `() => Boolean(document.querySelector('[aria-label="Enable API vault"]'))`, 'Manage tools')
  await click(win, '[aria-label="Enable API vault"]')
  await click(win, '.back-button')
  await waitFor(win, `() => Boolean(document.querySelector('.home'))`, 'restored dashboard')

  await click(win, '.terminal-button')
  await waitFor(win, `() => Boolean(document.querySelector('.terminal-view'))`, 'Terminal view again')
  await runCommand(win, 'open Model Farm')
  await waitFor(win, `() => document.querySelector('.tool-heading h1')?.textContent === 'Model Farm'`, 'open command')
  console.log('UX: open command checked')

  const pageErrors = await win.webContents.executeJavaScript(`window.__uxErrors ?? []`)
  assert.deepEqual(
    [...rendererErrors, ...pageErrors],
    [],
    'Renderer reported errors'
  )
  console.log('DESKTOP UX SMOKE PASSED')
  app.quit()
}).catch((error) => {
  console.error(error)
  console.error('UX error details:', error?.name, error?.message, error?.stack)
  app.exit(1)
})

setTimeout(() => {
  console.error('Desktop UX smoke timed out.')
  app.exit(1)
}, 30000)
