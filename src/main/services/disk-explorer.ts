import fs from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { setImmediate } from 'node:timers/promises'
import type { DiskScan, DiskScanProgress } from '../../shared/types'

export interface DiskScanOptions { signal?: AbortSignal; maxEntries?: number; onProgress?: (progress: DiskScanProgress) => void }

/** Bounded read-only inspection. Directory handles close on cancellation. */
export async function scanDisk(value: unknown, options: DiskScanOptions = {}): Promise<DiskScan> {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw new Error('Choose a folder to inspect.')
  const root = resolve(value)
  const info = await fs.lstat(root).catch(() => null)
  if (!info?.isDirectory() || info.isSymbolicLink()) throw new Error('Choose an available folder, not a shortcut.')
  const limit = Number.isFinite(options.maxEntries) ? Math.max(1, Math.min(50000, Math.floor(options.maxEntries!))) : 50000
  const started = Date.now()
  let lastProgress = -Infinity
  let count = 0, skipped = 0, totalBytes = 0, truncated = false
  const groups = new Map<string, number>()
  const queue = [{ dir: root, group: '' }]
  const progress = () => {
    const now = Date.now()
    if (now - lastProgress >= 250) {
      lastProgress = now
      options.onProgress?.({ scannedEntries: count, totalBytes, skipped, elapsedMs: now - started })
    }
  }
  progress()
  while (queue.length && !truncated && !options.signal?.aborted) {
    const current = queue.pop()!
    try {
      const currentInfo = await fs.lstat(current.dir)
      if (currentInfo.isSymbolicLink() || !currentInfo.isDirectory()) { skipped++; continue }
      const directory = await fs.opendir(current.dir)
      for await (const entry of directory) {
        if (options.signal?.aborted) break
        if (count >= limit) { truncated = true; break }
        count++
        const full = join(current.dir, entry.name)
        try {
          const info = await fs.lstat(full)
          if (info.isSymbolicLink()) { skipped++ }
          else {
            const group = current.group || (info.isDirectory() ? entry.name : 'Files in this folder')
            if (info.isDirectory()) { if (!groups.has(group)) groups.set(group, 0); queue.push({ dir: full, group }) }
            else if (info.isFile()) { groups.set(group, (groups.get(group) ?? 0) + info.size); totalBytes += info.size }
          }
        } catch { skipped++ }
        progress()
        if (count % 64 === 0) await setImmediate()
      }
    } catch { skipped++ }
  }
  const entries = [...groups].map(([name, bytes]) => ({ name, bytes })).sort((a, b) => b.bytes - a.bytes)
  return { path: root, name: basename(root) || root, entries, totalBytes, skipped, truncated, cancelled: options.signal?.aborted ?? false, scannedEntries: count, elapsedMs: Date.now() - started, scannedAt: Date.now() }
}

export async function storageCapacity(value:unknown):Promise<{total:number;free:number}> {
  if(typeof value!=='string'||!value.trim()||value.length>2048)throw new Error('Choose a mounted folder or share.')
  const info=await fs.statfs(resolve(value))
  return {total:Number(info.blocks)*Number(info.bsize),free:Number(info.bavail)*Number(info.bsize)}
}
