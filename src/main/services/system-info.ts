import os from 'node:os'
import { statfs } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import type { ProcessInfo, SystemStats } from '../../shared/types'

interface CpuSample {
  idle: number
  total: number
}

function totalTicks(times: os.CpuInfo['times']): number {
  return times.user + times.nice + times.sys + times.idle + times.irq
}

let previous: CpuSample[] = os.cpus().map((cpu) => ({
  idle: cpu.times.idle,
  total: totalTicks(cpu.times)
}))

function sampleCpuPercent(): number {
  const current = os.cpus()
  let idleDelta = 0
  let totalDelta = 0

  current.forEach((cpu, index) => {
    const before = previous[index]
    if (!before) return
    const now = { idle: cpu.times.idle, total: totalTicks(cpu.times) }
    idleDelta += now.idle - before.idle
    totalDelta += now.total - before.total
  })

  previous = current.map((cpu) => ({ idle: cpu.times.idle, total: totalTicks(cpu.times) }))

  if (totalDelta <= 0) return 0
  const used = (1 - idleDelta / totalDelta) * 100
  return Math.min(100, Math.max(0, used))
}

export async function getSystemStats(): Promise<SystemStats> {
  const drive = process.env.SystemDrive || 'C:'
  let diskTotal = 0
  let diskFree = 0

  try {
    const stats = await statfs(`${drive}\\`)
    diskTotal = stats.bsize * stats.blocks
    diskFree = stats.bsize * stats.bavail
  } catch {
    // Disk info is best-effort; other stats still render.
  }

  const totalMem = os.totalmem()

  return {
    cpuPercent: Math.round(sampleCpuPercent() * 10) / 10,
    memUsed: totalMem - os.freemem(),
    memTotal: totalMem,
    diskFree,
    diskTotal,
    diskName: drive,
    uptime: os.uptime(),
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.release()}`,
    cpuModel: os.cpus()[0]?.model.trim() ?? 'Unknown CPU',
    cores: os.cpus().length
  }
}

let processCache: { at: number; data: ProcessInfo[] } = { at: 0, data: [] }
let previousProcesses: { at: number; cpuByPid: Map<number, number> } | null = null

const PROCESS_SCRIPT =
  "Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 Name,Id,CPU,@{n='MemMB';e={[math]::Round($_.WorkingSet64/1MB)}} | ConvertTo-Json -Compress"

export async function getProcesses(): Promise<ProcessInfo[]> {
  if (Date.now() - processCache.at < 2000) return processCache.data

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', PROCESS_SCRIPT],
        { timeout: 6000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
        (error, output) => (error ? reject(error) : resolve(output))
      )
    })

    const parsed: unknown = JSON.parse(stdout || '[]')
    const rows = (Array.isArray(parsed) ? parsed : [parsed]) as Array<Record<string, unknown>>

    const now = Date.now()
    const elapsedSeconds = previousProcesses ? (now - previousProcesses.at) / 1000 : 0
    const cores = os.cpus().length
    const cpuByPid = new Map<number, number>()

    const data: ProcessInfo[] = rows
      .map((row) => {
        const pid = Number(row.Id ?? 0)
        const totalCpu = typeof row.CPU === 'number' ? row.CPU : null
        if (totalCpu !== null) cpuByPid.set(pid, totalCpu)

        let cpuPercent: number | null = null
        if (totalCpu !== null && previousProcesses && elapsedSeconds > 0) {
          const before = previousProcesses.cpuByPid.get(pid)
          if (typeof before === 'number') {
            const delta = totalCpu - before
            if (delta >= 0) {
              cpuPercent = Math.round((delta / (elapsedSeconds * cores)) * 1000) / 10
            }
          }
        }

        return {
          name: String(row.Name ?? 'unknown'),
          pid,
          cpu: cpuPercent,
          memMb: Number(row.MemMB ?? 0)
        }
      })
      .filter((row) => row.pid > 0)

    previousProcesses = { at: now, cpuByPid }
    processCache = { at: now, data }
    return data
  } catch {
    return processCache.data
  }
}
