const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const index = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** index
  return `${value.toFixed(index === 0 ? 0 : 1)} ${BYTE_UNITS[index]}`
}

export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 60) return 'under a minute'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
