import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ProcessInfo, SystemStats } from '@shared/types'
import { Icon } from '../../components/Icon'
import { formatBytes, formatUptime } from '../../lib/format'
import type { ToolDefinition } from '../types'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

interface StatTileProps {
  label: string
  value: string
  caption: string
  percent?: number
  accent: string
}

function StatTile({ label, value, caption, percent, accent }: StatTileProps) {
  return (
    <div className="stat-tile" style={{ '--accent': accent } as CSSProperties}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {typeof percent === 'number' && (
        <div className="meter">
          <span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        </div>
      )}
      <span className="stat-caption">{caption}</span>
    </div>
  )
}

function SystemTool() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      try {
        const next = await window.api.system.stats()
        if (!cancelled) {
          setStats(next)
          setError(null)
        }
      } catch (cause) {
        if (!cancelled) setError(errorMessage(cause))
      }
    }

    void tick()
    const timer = setInterval(() => void tick(), 2000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      try {
        const next = await window.api.system.processes()
        if (!cancelled) setProcesses(next)
      } catch {
        // Keep the previous snapshot when PowerShell hiccups.
      }
    }

    void tick()
    const timer = setInterval(() => void tick(), 4000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const memPercent = stats && stats.memTotal > 0 ? (stats.memUsed / stats.memTotal) * 100 : 0
  const diskUsedPercent =
    stats && stats.diskTotal > 0
      ? ((stats.diskTotal - stats.diskFree) / stats.diskTotal) * 100
      : 0

  return (
    <div className="system-tool">
      {error && <p className="error-text">{error}</p>}

      <div className="stat-grid">
        <StatTile
          label="CPU load"
          value={stats ? `${stats.cpuPercent.toFixed(1)}%` : '—'}
          percent={stats?.cpuPercent ?? 0}
          caption={stats ? `${stats.cores} logical cores` : 'Sampling…'}
          accent="#5b8cff"
        />
        <StatTile
          label="Memory"
          value={
            stats
              ? `${formatBytes(stats.memUsed)} / ${formatBytes(stats.memTotal)}`
              : '—'
          }
          percent={memPercent}
          caption={stats ? `${memPercent.toFixed(0)}% in use` : 'Sampling…'}
          accent="#22c39a"
        />
        <StatTile
          label="Disk"
          value={stats ? `${formatBytes(stats.diskFree)} free` : '—'}
          percent={diskUsedPercent}
          caption={
            stats
              ? `of ${formatBytes(stats.diskTotal)} on ${stats.diskName}`
              : 'Reading disk…'
          }
          accent="#f5a524"
        />
        <StatTile
          label="Uptime"
          value={stats ? formatUptime(stats.uptime) : '—'}
          caption="since last boot"
          accent="#ff6b81"
        />
      </div>

      <div className="system-meta">
        <span>
          Host <b>{stats?.hostname ?? '—'}</b>
        </span>
        <span>
          CPU <b>{stats?.cpuModel ?? '—'}</b>
        </span>
        <span>
          OS <b>{stats?.platform ?? '—'}</b>
        </span>
      </div>

      <div className="process-head">
        <span>Top processes by memory</span>
        <span className="muted-text">Updates every 4s</span>
      </div>

      {processes.length === 0 ? (
        <p className="hint">
          <Icon name="refresh" size={13} /> Collecting process list…
        </p>
      ) : (
        <div className="process-table">
          <div className="process-row head">
            <span>Process</span>
            <span>PID</span>
            <span>Memory</span>
            <span>CPU</span>
          </div>
          {processes.map((process) => (
            <div className="process-row" key={`${process.pid}-${process.name}`}>
              <span className="process-name" title={process.name}>
                {process.name}
              </span>
              <span>{process.pid}</span>
              <span>{process.memMb} MB</span>
              <span>{process.cpu === null ? '—' : `${process.cpu}%`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'system',
  name: 'System dashboard',
  description: 'Live CPU, memory, disk, uptime, and the heaviest processes on this PC — no admin rights needed.',
  icon: 'gauge',
  accent: '#ff6b81',
  order: 5,
  component: SystemTool
}
