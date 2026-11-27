import type { BackupConfig } from '@shared/types'

export const DISABLED_KEY = 'toolbox.disabled'
export const LEGACY_ENABLED_KEY = 'toolbox.enabled'
export const COMPACT_KEY = 'toolbox.compact'
export const PINNED_KEY = 'toolbox.onTop'
export const BACKUP_DIR_KEY = 'toolbox.backupDir'
export const CARD_SIZE_KEY = 'toolbox.cardSize'
export const HOME_PAGE_KEY = 'toolbox.homePage'
export const WEATHER_CITY_KEY = 'toolbox.weatherCity'
export const UPDATE_SOURCE_KEY = 'toolbox.updateSource'
export const DEFAULT_UPDATE_SOURCE = 'acsdd/toolbox-desktop'
export const CONFIG_RESTORED_EVENT = 'toolbox:config-restored'

export type CardSize = 'small' | 'medium' | 'large'
export type HomePage = 'workspace' | 'connected'

export function readCardSize(): CardSize {
  const value = localStorage.getItem(CARD_SIZE_KEY)
  return value === 'small' || value === 'large' ? value : 'medium'
}

export function readHomePage(): HomePage {
  return localStorage.getItem(HOME_PAGE_KEY) === 'connected' ? 'connected' : 'workspace'
}

export function resolveUpdateSource(saved: string | null): string {
  return saved === null ? DEFAULT_UPDATE_SOURCE : saved.trim()
}

export function readUpdateSource(): string {
  return resolveUpdateSource(localStorage.getItem(UPDATE_SOURCE_KEY))
}

export function readBackupConfig(): BackupConfig {
  let disabled: string[] = []
  try {
    const raw = localStorage.getItem(DISABLED_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) {
      disabled = parsed.filter((id): id is string => typeof id === 'string')
    }
  } catch {
    // A malformed value means there is no saved layout.
  }

  return {
    disabled,
    pinned: localStorage.getItem(PINNED_KEY) === '1',
    cardSize: readCardSize()
  }
}

export function applyBackupConfig(config: BackupConfig): void {
  localStorage.setItem(DISABLED_KEY, JSON.stringify(config.disabled))
  localStorage.setItem(PINNED_KEY, config.pinned ? '1' : '0')
  localStorage.setItem(CARD_SIZE_KEY, config.cardSize)
  window.dispatchEvent(new Event(CONFIG_RESTORED_EVENT))
}
