/* Exercise the built app with a temporary profile, selected files, and a local player response. */
const assert = require('node:assert/strict')
const { app, BrowserWindow, dialog, protocol, shell } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'toolbox-widgets-'))
const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'toolbox-downloads-'))
const digest = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
const fixture = path.join(downloads, 'notes.txt')
const revealed = []
const opened = []
fs.writeFileSync(fixture, 'abc')
fs.writeFileSync(path.join(downloads, 'example.zip'), 'fixture')
app.setPath('userData', profile)
app.setPath('downloads', downloads)

dialog.showOpenDialog = async (_win, options) => ({
  canceled: false,
  filePaths: [options.properties.includes('openFile') ? fixture : downloads]
})
shell.showItemInFolder = target => revealed.push(target)
shell.openPath = async target => { opened.push(target); return '' }
shell.openExternal = async target => { opened.push(target) }

const mockPlayer = `<!DOCTYPE html><meta charset="utf-8"><title>ArtistWave fixture</title><body><script>
  window.ArtistWaveMiniHost = {
    state: () => ({ ready: true, title: 'Fixture player', queue: [] }),
    open: () => document.body.classList.add('mini-player-active'),
    closeFallback: () => document.body.classList.remove('mini-player-active')
  };
</script></body>`
app.whenReady().then(() => {
  protocol.handle('https', request => request.url.startsWith('https://acsdd.github.io/ArtistWave/')
    ? new Response(mockPlayer, { headers: { 'Content-Type': 'text/html' } })
    : new Response('', { status: 503 }))
})

require('../out/main/index.js')
const pause = (ms = 60) => new Promise(resolve => setTimeout(resolve, ms))

async function until(fn, message, timeout = 7000) {
  const deadline = Date.now() + timeout
  do {
    if (await fn()) return
    await pause()
  } while (Date.now() < deadline)
  throw new Error(message)
}

const widgets = [
  ['Text Compare', '.text-compare'], ['Downloads Inbox', '[data-widget="downloads-inbox"]'],
  ['Meeting Planner', '.meeting-planner'], ['File Verification', '[data-widget="file-verification"]'],
  ['Workspace Kits', '[data-widget="workspace-kits"]'], ['Power & Battery', '.power-battery']
]
const output = process.env.TOOLBOX_WIDGET_SCREENSHOTS

async function main() {
  let win
  await until(async () => {
    win = BrowserWindow.getAllWindows()[0]
    return win && !win.webContents.isLoading() && await win.webContents.executeJavaScript('!!document.querySelector(".home")')
  }, 'Toolbox did not load')
  win.webContents.setBackgroundThrottling(false)
  const errors = []
  win.webContents.on('console-message', event => {
    if (event.level === 'error' && !/Failed to load resource/.test(event.message)) errors.push(event.message)
  })
  const run = script => win.webContents.executeJavaScript(script, true)
  const waitFor = (script, message) => until(() => run(script), message)
  const click = async selector => assert.ok(await run(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element || element.disabled) return false;
    element.click(); return true;
  })()`), `Could not click ${selector}`)
  const button = async (scope, name, wait = true) => {
    const script = `(() => {
      const element = [...document.querySelectorAll(${JSON.stringify(scope + ' button')})].find(button => button.textContent.trim() === ${JSON.stringify(name)});
      if (!element || element.disabled || element.getAttribute('aria-disabled') === 'true') return false;
      element.click(); return true;
    })()`
    if (wait) await waitFor(script, `Could not click ${name}`)
    else assert.ok(await run(script), `Could not click ${name}`)
  }
  const input = async (selector, value) => assert.ok(await run(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), 'value').set;
    setter.call(node, ${JSON.stringify(value)});
    node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    return true;
  })()`), `Missing field ${selector}`)
  const has = (selector, text) => `document.querySelector(${JSON.stringify(selector)})?.textContent.includes(${JSON.stringify(text)})`
  const open = async (name, selector) => {
    if (!await run('!!document.querySelector(".home")')) await click('.sidebar-home')
    await waitFor(`(() => {
      const card = [...document.querySelectorAll('.tool-card')].find(card => card.querySelector('h3')?.textContent === ${JSON.stringify(name)});
      if (!card) return false;
      card.click(); return true;
    })()`, `Missing Workspace card for ${name}`)
    await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`, `Could not open ${name}`)
  }
  const capture = async (name, selector) => {
    if (!output) return
    fs.mkdirSync(output, { recursive: true })
    await pause(250)
    await run('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    const bounds = selector ? await run(`(() => {
      const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.floor(rect.width), height: Math.floor(rect.height) };
    })()`) : undefined
    fs.writeFileSync(path.join(output, name + '.png'), (await win.webContents.capturePage(bounds)).toPNG())
  }
  // Record copy requests without replacing the user's system clipboard.
  await run(`Object.defineProperty(navigator.clipboard, 'writeText', { value: async text => { window.__widgetCopy = text; } }); true`)

  await open(...widgets[0])
  await input('.text-compare-field:nth-child(1) textarea', 'theme=night\nlayout=compact')
  await input('.text-compare-field:nth-child(2) textarea', 'theme=day\nlayout=compact')
  await waitFor(has('.text-compare', '1 added · 1 removed'), 'Diff did not show the changed line')
  await button('.text-compare', 'Copy diff')
  assert.match(await run('window.__widgetCopy'), /-theme=night\n\+theme=day/)
  await capture('01-text-compare')

  await open(...widgets[1])
  await waitFor(has('[data-widget="downloads-inbox"]', 'notes.txt'), 'Downloads listing did not load')
  await input('[data-widget="downloads-inbox"] input[type="search"]', 'notes')
  await waitFor('document.querySelectorAll("[data-widget=downloads-inbox] .utility-row").length === 1', 'File search did not filter the result')
  await click('button[aria-label="Reveal notes.txt"]')
  await until(() => revealed.includes(fixture), 'Reveal did not receive the fixture file')
  await button('[data-widget="downloads-inbox"]', 'Choose folder')
  await waitFor(has('[data-widget="downloads-inbox"]', 'notes.txt'), 'Picked folder did not load')
  await input('[data-widget="downloads-inbox"] input[type="search"]', '')
  await capture('02-downloads-inbox')

  await open(...widgets[2])
  await button('.meeting-planner', 'Add time zone')
  await input('select[aria-label="Time zone 1"]', 'Europe/London')
  await input('select[aria-label="Time zone 2"]', 'America/New_York')
  await waitFor('document.querySelectorAll(".meeting-slot").length > 0', 'Meeting Planner did not find an overlap')
  await button('.meeting-planner', 'Copy times')
  assert.match(await run('window.__widgetCopy'), /America\/New_York/)
  await capture('03-meeting-planner')

  await open(...widgets[3])
  await button('[data-widget="file-verification"]', 'Choose file')
  await button('[data-widget="file-verification"]', 'Calculate SHA-256')
  await waitFor(has('output[aria-label="Calculated SHA-256"]', digest), 'SHA-256 calculation did not reach the renderer')
  await input('[data-widget="file-verification"] input', digest)
  await waitFor(has('[data-widget="file-verification"] [role="status"]', 'Match.'), 'Digest match was not displayed')
  await button('[data-widget="file-verification"]', 'Copy result')
  assert.equal(await run('window.__widgetCopy'), digest)
  await capture('04-file-verification')

  await open(...widgets[4])
  await button('[data-widget="workspace-kits"]', 'New kit')
  await input('[data-widget="workspace-kits"] input[required]', 'Daily workspace')
  await button('[data-widget="workspace-kits"]', 'Add folder')
  await waitFor(has('[aria-label="Create workspace kit"] .utility-list', downloads), 'Folder was not added to the draft')
  await button('[data-widget="workspace-kits"]', 'Save kit')
  await waitFor(has('[aria-label="Kit preview"]', 'Daily workspace'), 'Saved kit did not open in preview')
  await button('[data-widget="workspace-kits"]', 'Open kit')
  await until(() => opened.includes(downloads), 'Workspace kit did not open the fixture folder')
  await waitFor(has('[data-widget="workspace-kits"] [role="status"]', 'Opened 1 of 1 items'), 'Kit did not report the launch result')
  await capture('05-workspace-kits')

  await open(...widgets[5])
  await waitFor(has('.power-battery', 'Last checked'), 'Power status query did not settle')
  const power = await run('window.api.powerBattery.read()')
  assert.ok(['battery', 'no-battery'].includes(power.status), `Live Windows power status was ${power.status}`)
  await capture('06-power-and-battery')

  await click('.sidebar-home')
  await click('.mini-toggle')
  await waitFor('!!document.querySelector(".mini-bar")', 'Mini bar did not open')
  for (const [name] of widgets) assert.ok(await run(`!!document.querySelector(${JSON.stringify('.mini-tool[aria-label="' + name + '"]')})`))
  await click('.mini-expand')
  await waitFor('!!document.querySelector(".home")', 'Mini bar did not return to Workspace')
  await click('.player-button')
  await waitFor('(async () => (await window.api.artistwave.status()).ready)()', 'Fixture player did not load')
  for (const [index, [name, selector]] of widgets.entries()) {
    await click(`.rail-tool[aria-label="${name}"]`)
    const host = `.host-screen ${selector}`
    await waitFor(`!!document.querySelector(${JSON.stringify(host)})`, `${name} did not open in the widget host`)
    const dimensions = await run(`(() => { const node = document.querySelector(${JSON.stringify(host)}); return { width: node.clientWidth, overflow: node.scrollWidth - node.clientWidth }; })()`)
    assert.ok(dimensions.width > 150 && dimensions.width <= 440 && dimensions.overflow <= 2, `${name} overflows the widget host: ${JSON.stringify(dimensions)}`)
    if (index === 2) {
      await capture('07-meeting-planner-narrow', '.host-screen')
      await input('select[aria-label="Color theme"]', 'day')
      await waitFor('document.documentElement.dataset.theme === "day"', 'Day theme did not apply')
      await capture('08-meeting-planner-narrow-day', '.host-screen')
    }
  }
  await click('.rail-brand')
  await waitFor('!!document.querySelector(".home")', 'Widget host did not return to Workspace')
  win.setContentSize(1440, 1000)
  const layouts = []
  for (const zoom of [1, 1.5, 2]) {
    win.webContents.setZoomFactor(zoom)
    for (const [index, [name, selector]] of widgets.entries()) {
      await open(name, selector)
      await pause(150)
      const dimensions = await run(`(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        const content = document.querySelector('.content');
        return { widget: ${JSON.stringify(name)}, zoom: ${zoom}, overflow: Math.max(node.scrollWidth - node.clientWidth, content.scrollWidth - content.clientWidth) };
      })()`)
      assert.ok(dimensions.overflow <= 2, `Scaled layout overflows: ${JSON.stringify(dimensions)}`)
      layouts.push(dimensions)
      if (zoom === 1) await capture(`day-${index + 1}-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`)
    }
  }
  win.webContents.setZoomFactor(1)
  const manage = async () => {
    await click('.settings-toggle')
    await waitFor('!!document.querySelector(".settings-list")', 'Manage tools did not open')
  }
  await manage()
  await click('[aria-label="Enable Text Compare"]')
  await click('.sidebar-home')
  assert.ok(await run(`![...document.querySelectorAll('.tool-card h3')].some(heading => heading.textContent === 'Text Compare')`), 'Hidden widget still appears on Workspace')
  await manage()
  await click('[aria-label="Enable Text Compare"]')
  await click('.sidebar-home')
  await open(...widgets[0])
  if (output) fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ widgets: widgets.map(([name]) => name), power, layouts, errors }, null, 2))
  assert.deepEqual(errors, [], 'Unexpected renderer errors')
  assert.equal(fs.readFileSync(fixture, 'utf8'), 'abc')
  console.log(`DESKTOP WIDGET SMOKE PASSED (${widgets.length} widgets, Power & Battery: ${power.status})`)
}

const timeout = setTimeout(() => { console.error('Widget smoke timed out'); app.exit(1) }, 60000)
app.whenReady().then(main).then(() => { clearTimeout(timeout); app.quit() })
  .catch(error => { console.error(error); app.exit(1) })
