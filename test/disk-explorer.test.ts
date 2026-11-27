import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir, readdir, readFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanDisk } from '../src/main/services/disk-explorer.ts'

async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'toolbox-scan-test-'))
  try { await mkdir(join(root, 'nested')); await writeFile(join(root, 'a'), 'abc'); await writeFile(join(root, 'nested', 'b'), '12345'); await run(root) }
  finally { await rm(root, { recursive: true, force: true }) }
}
test('reports known byte sizes without changing the scanned files', () => fixture(async root => {
  const before = await readdir(root)
  const updates: number[] = []
  const result = await scanDisk(root, { onProgress: p => updates.push(p.scannedEntries) })
  assert.equal(result.totalBytes, 8)
  assert.equal(result.scannedEntries, 3)
  assert.equal(result.cancelled, false)
  assert.ok(updates.length >= 1)
  assert.deepEqual(await readdir(root), before)
  assert.equal(await readFile(join(root, 'a'), 'utf8'), 'abc')
  assert.equal(await readFile(join(root, 'nested', 'b'), 'utf8'), '12345')
}))
test('already cancelled scan settles with no entries and does not replace a complete result', () => fixture(async root => {
  const result = await scanDisk(root, { signal: AbortSignal.abort() })
  assert.equal(result.cancelled, true)
  assert.equal(result.scannedEntries, 0)
}))
test('cancels from first progress callback within one enumeration batch', () => fixture(async root => {
  const controller = new AbortController()
  const result = await scanDisk(root, { signal: controller.signal, onProgress: () => controller.abort() })
  assert.equal(result.cancelled, true)
  assert.ok(result.scannedEntries <= 1)
}))
test('small cap is exact and cannot increase the production ceiling', () => fixture(async root => {
  const result = await scanDisk(root, { maxEntries: 1 })
  assert.equal(result.scannedEntries, 1)
  assert.equal(result.truncated, true)
}))
test('skips directory links instead of traversing targets', () => fixture(async root => {
  await symlink(join(root, 'nested'), join(root, 'linked'), 'junction')
  const result = await scanDisk(root)
  assert.equal(result.totalBytes, 8)
  assert.equal(result.skipped, 1)
}))
test('inaccessible directory enumeration is counted as skipped', () => fixture(async root => {
  const fs = await import('node:fs/promises')
  const { mock } = await import('node:test')
  // Windows ACLs are environment dependent: simulate just the failing read.
  const original = fs.default.opendir
  const mocked = mock.method(fs.default, 'opendir', async (...args: Parameters<typeof original>) => {
    if (args[0] === join(root, 'nested')) throw new Error('EACCES')
    return original(...args)
  })
  try { const result = await scanDisk(root); assert.equal(result.skipped, 1); assert.equal(result.totalBytes, 3) }
  finally { mocked.mock.restore() }
}))
