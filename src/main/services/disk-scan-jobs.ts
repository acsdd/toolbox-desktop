import { randomUUID } from 'node:crypto'
import { scanDisk } from './disk-explorer.ts'
import type { DiskScanUpdate } from '../../shared/types'

interface Job { owner: number; controller: AbortController; deliver(update: DiskScanUpdate): void; disposed: boolean }
/** One active job per invoking window; terminal jobs are immediately released. */
export class DiskScanJobs {
  private readonly jobs = new Map<string, Job>()
  get size() { return this.jobs.size }
  start(owner: number, path: unknown, deliver: (update: DiskScanUpdate) => void): { id: string } {
    if ([...this.jobs.values()].some(job => job.owner === owner)) throw new Error('A scan is already running in this window.')
    if (this.jobs.size >= 8) throw new Error('Too many scans are running. Wait for a scan to finish.')
    const id = randomUUID()
    const job: Job = { owner, controller: new AbortController(), deliver, disposed: false }
    this.jobs.set(id, job)
    setImmediate(() => { void this.run(id, path, job) })
    return { id }
  }
  private async run(id: string, path: unknown, job: Job) {
    if (job.disposed) return
    const send = (update: DiskScanUpdate) => { if (!job.disposed) job.deliver(update) }
    let terminal: DiskScanUpdate
    try {
      const result = await scanDisk(path, { signal: job.controller.signal, onProgress: progress => send({ id, status: 'running', progress }) })
      terminal = { id, status: result.cancelled ? 'cancelled' : result.truncated ? 'truncated' : 'completed', result }
    } catch (cause) { terminal = { id, status: 'failed', error: cause instanceof Error ? cause.message : String(cause) } }
    this.jobs.delete(id)
    send(terminal)
  }
  cancel(owner: number, id: unknown): void {
    if (typeof id !== 'string' || id.length > 64) throw new Error('Invalid scan job.')
    const job = this.jobs.get(id)
    if (!job) return
    if (job.owner !== owner) throw new Error('This scan does not belong to this window.')
    job.controller.abort()
  }
  disposeOwner(owner: number): void {
    for (const [id, job] of this.jobs) if (job.owner === owner) { job.disposed = true; job.controller.abort(); this.jobs.delete(id) }
  }
}
