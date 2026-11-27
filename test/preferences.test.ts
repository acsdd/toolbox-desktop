import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as preferences from '../src/renderer/src/lib/preferences.ts'

test('uses the official release source when no custom source is saved', () => {
  assert.equal(preferences.resolveUpdateSource(null), 'acsdd/toolbox-desktop')
})

test('preserves a cleared release source instead of restoring the default', () => {
  assert.equal(preferences.resolveUpdateSource('   '), '')
})

test('keeps a cleared release source disabled after reload', async () => {
  const saved = new Map<string, string>()
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value)
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

  try {
    localStorage.setItem(preferences.UPDATE_SOURCE_KEY, '')

    const reloaded = await import('../src/renderer/src/lib/preferences.ts?reload=cleared-source')
    assert.notEqual(reloaded, preferences, 'The preferences module must be reinitialized')
    assert.equal(reloaded.readUpdateSource(), '')
    assert.equal(preferences.readUpdateSource(), '')
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('preserves a trimmed custom release source', () => {
  assert.equal(
    preferences.resolveUpdateSource('  https://example.com/toolbox-update.json  '),
    'https://example.com/toolbox-update.json'
  )
})
