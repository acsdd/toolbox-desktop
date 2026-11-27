import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createWorkspaceKits } from '../src/main/services/workspace-kits.ts'

test('persists selected targets, rejects unauthorized paths, and opens remaining items after a failure', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'workspace-kits-'))
  t.after(() => rm(folder, { recursive: true, force: true }))
  const store = join(folder, 'kits.json')
  const opened: string[] = []
  let enabled = true
  const dependencies = {
    shortcuts: async () => [{ id: 'editor', name: 'Editor', enabled }, { id: 'docs', name: 'Docs', enabled: true }],
    openFolder: async (path: string) => { opened.push(path) },
    openShortcut: async (id: string) => { if (id === 'editor') throw new Error('Unavailable'); opened.push(id) }
  }
  const kits = createWorkspaceKits(store, dependencies)
  await assert.rejects(kits.save({ name: 'Work', folderIds: [folder], shortcutIds: [] }), /select/i)
  const target = await kits.addPickedFolder(folder)
  const saved = await kits.save({ name: 'Work', folderIds: [target.id], shortcutIds: ['editor', 'docs'] })
  const reopened = createWorkspaceKits(store, dependencies)
  assert.deepEqual((await reopened.list())[0], saved)
  const result = await reopened.open(saved.id)
  assert.deepEqual(opened, [folder, 'docs'])
  assert.equal(result.filter((item) => item.opened).length, 2)
  enabled = false
  const preview = await reopened.inspect(saved.id)
  assert.equal(preview.find((item) => item.label === 'Editor')?.issue, 'Disabled in AI launchpad')
  await reopened.remove(saved.id)
  assert.deepEqual(JSON.parse(await readFile(store, 'utf8')).kits, [])
})

test('serializes concurrent saves and preserves unsupported stored data', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'workspace-kit-saves-'))
  t.after(() => rm(folder, { recursive: true, force: true }))
  const store = join(folder, 'kits.json')
  const kits = createWorkspaceKits(store, {
    shortcuts: async () => [{ id: 'docs', name: 'Docs', enabled: true }],
    openFolder: async () => {},
    openShortcut: async () => {}
  })
  await Promise.all(['First', 'Second'].map(name => kits.save({ name, folderIds: [], shortcutIds: ['docs'] })))
  assert.deepEqual((await kits.list()).map(kit => kit.name), ['First', 'Second'])
  await writeFile(store, 'null')
  await assert.rejects(kits.list(), /unsupported format/)
  await assert.rejects(kits.save({ name: 'Third', folderIds: [], shortcutIds: ['docs'] }), /unsupported format/)
  assert.equal(await readFile(store, 'utf8'), 'null')
})
