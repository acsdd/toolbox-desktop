import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DiskScanJobs } from '../src/main/services/disk-scan-jobs.ts'

test('scopes ownership, cancellation and terminal events and releases settled jobs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'toolbox-jobs-test-'))
  try {
    await writeFile(join(root, 'a'), '123')
    const jobs = new DiskScanJobs()
    const events: any[] = []
    const first = jobs.start(1, root, update => events.push(update))
    assert.throws(() => jobs.cancel(2, first.id), /belong/)
    assert.throws(() => jobs.start(1, root, () => {}), /already/)
    jobs.cancel(1, first.id)
    await new Promise<void>(resolve => { const poll = () => jobs.size ? setTimeout(poll, 5) : resolve(); poll() })
    assert.equal(events.at(-1).status, 'cancelled')
    const count = events.length
    await new Promise<void>(resolve => jobs.start(1, root, update => { if (update.status !== 'running') { assert.equal(update.status, 'completed'); resolve() } }))
    assert.equal(events.length, count)
    assert.equal(jobs.size, 0)
  } finally { await rm(root, { recursive: true, force: true }) }
})
test('owner disposal cancels work and suppresses further delivery', async () => {
  const jobs = new DiskScanJobs()
  let count = 0
  jobs.start(4, 'invalid missing folder', () => count++)
  jobs.disposeOwner(4)
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(jobs.size, 0)
  assert.equal(count, 0)
})
