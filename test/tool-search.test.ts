import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankTools } from '../src/renderer/src/lib/tool-search.ts'

const visible = [
  { id: 'description', name: 'Inspector', description: 'Disk usage' },
  { id: 'substring', name: 'My Disk' },
  { id: 'prefix', name: 'Disk explorer' },
  { id: 'exact', name: 'Disk' },
  { id: 'stable', name: 'Disk capacity' }
]
test('ranks exact, prefix, substring and description matches stably', () => {
  assert.deepEqual(rankTools('  dIsK  ', visible).map(x => x.id), ['exact', 'prefix', 'stable', 'substring', 'description'])
})
test('empty query preserves supplied visible order and never discovers excluded IDs', () => {
  assert.deepEqual(rankTools('  ', visible), visible)
  assert.deepEqual(rankTools('vault', visible), [])
  assert.deepEqual(rankTools('not found', visible), [])
})
test('normalizes repeated whitespace in names and queries', () => {
  assert.equal(rankTools(' disk   explorer ', visible)[0]?.id, 'prefix')
})
