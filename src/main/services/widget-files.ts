import { createHash } from 'node:crypto'
import { lstat, open, opendir } from 'node:fs/promises'
import type { Stats } from 'node:fs'
import { extname, join } from 'node:path'
import type { InboxSnapshot } from '../../shared/widget-files'

export async function listInbox(
  folder: string,
  categorize: (extension: string) => string,
  limit = 2500
): Promise<InboxSnapshot> {
  const directory = await opendir(folder)
  const items: InboxSnapshot['items'] = []
  let visited = 0
  let skipped = 0
  let partial = false
  for await (const entry of directory) {
    if (visited >= limit) { partial = true; break }
    visited++
    if (!entry.isFile()) continue
    try {
      const info = await lstat(join(folder, entry.name))
      if (!info.isFile()) continue
      items.push({
        name: entry.name,
        size: info.size,
        modifiedAt: info.mtimeMs,
        category: categorize(extname(entry.name).slice(1).toLowerCase())
      })
    } catch {
      skipped++
    }
  }
  items.sort((a, b) => b.modifiedAt - a.modifiedAt || a.name.localeCompare(b.name))
  return { folder, items, readAt: Date.now(), partial, skipped }
}

export async function revealInboxEntry(folder: string, snapshot: InboxSnapshot, name: unknown): Promise<string> {
  const missing = 'This file is no longer in the current list. Refresh the inbox.'
  if (snapshot.folder !== folder || !snapshot.items.some(item => item.name === name)) throw new Error(missing)
  const target = join(folder, name as string)
  const info = await lstat(target).catch(() => null)
  if (!info?.isFile()) throw new Error(missing)
  return target
}

function sameFile(first: Stats, second: Stats) {
  return second.isFile() && first.dev === second.dev && first.ino === second.ino &&
    first.size === second.size && first.mtimeMs === second.mtimeMs && first.ctimeMs === second.ctimeMs
}

export async function hashSelectedFile(
  path: string,
  signal: AbortSignal,
  onProgress: (bytes: number, total: number) => void | Promise<void>
): Promise<string> {
  signal.throwIfAborted()
  const selected = await lstat(path)
  if (!selected.isFile()) throw new Error('Choose a regular file to verify.')
  const file = await open(path, 'r')
  try {
    const start = await file.stat()
    if (!sameFile(selected, start)) throw new Error('The file changed. Choose it again.')
    const digest = createHash('sha256')
    const buffer = Buffer.allocUnsafe(1024 * 1024)
    let bytes = 0
    while (bytes < start.size) {
      signal.throwIfAborted()
      const length = Math.min(buffer.length, start.size - bytes)
      const { bytesRead } = await file.read(buffer, 0, length, bytes)
      if (!bytesRead) break
      digest.update(buffer.subarray(0, bytesRead))
      bytes += bytesRead
      await onProgress(bytes, start.size)
    }
    signal.throwIfAborted()
    const finalPath = await lstat(path).catch(() => null)
    if (bytes !== start.size || !sameFile(start, await file.stat()) || !finalPath || !sameFile(start, finalPath)) {
      throw new Error('The file changed during verification. Calculate the digest again.')
    }
    signal.throwIfAborted()
    return digest.digest('hex')
  } finally {
    await file.close()
  }
}
