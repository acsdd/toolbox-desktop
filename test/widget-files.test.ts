import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, symlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { listInbox, revealInboxEntry, hashSelectedFile } from '../src/main/services/widget-files.ts'
import { categorize } from '../src/main/services/file-organizer.ts'
import { compareDigest } from '../src/shared/widget-files.ts'

test('lists direct files by modification time and rejects stale or unlisted reveal targets', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'widget-inbox-'))
  t.after(() => rm(folder, { recursive: true, force: true }))
  const report = join(folder, 'report.pdf')
  await writeFile(report, 'pdf')
  await utimes(report, new Date(0), new Date(0))
  await writeFile(join(folder, 'new.zip'), 'zip')
  await mkdir(join(folder, 'nested'))
  await writeFile(join(folder, 'nested', 'inner.txt'), 'hidden')
  await symlink(report, join(folder, 'alias.pdf'), 'file').catch(() => {})
  const inbox = await listInbox(folder, categorize)
  assert.deepEqual(inbox.items.map(({ name, category }) => [name, category]), [['new.zip', 'Archives'], ['report.pdf', 'Documents']])
  assert.equal(await revealInboxEntry(folder, inbox, 'report.pdf'), report)
  assert.equal((await listInbox(folder, categorize, 1)).partial, true)
  await assert.rejects(revealInboxEntry(folder, inbox, '../outside.txt'), /refresh/i)
  await rm(report)
  await assert.rejects(revealInboxEntry(folder, inbox, 'report.pdf'), /refresh/i)
})

test('streams a selected file, detects cancellation and changes, and validates digests', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'widget-digest-'))
  t.after(() => rm(folder, { recursive: true, force: true }))
  const file = join(folder, 'fixture.txt')
  await writeFile(file, 'abc')
  const progress: number[] = []
  const digest = await hashSelectedFile(file, new AbortController().signal, (bytes) => progress.push(bytes))
  assert.equal(digest, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  assert.equal(progress.at(-1), 3)
  assert.equal(compareDigest(digest, digest.toUpperCase()), 'match')
  assert.equal(compareDigest(digest, '0'.repeat(64)), 'mismatch')
  assert.equal(compareDigest(digest, 'invalid'), 'invalid')
  const abort = new AbortController()
  await assert.rejects(hashSelectedFile(file, abort.signal, () => abort.abort()), { name: 'AbortError' })
  const changed = hashSelectedFile(file, new AbortController().signal, () => {
    // External modification after the read begins must invalidate the digest.
    const future = new Date(Date.now() + 20_000)
    return utimes(file, future, future)
  })
  await assert.rejects(changed, /changed/i)
})
