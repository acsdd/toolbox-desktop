import type { ReactNode } from 'react'

export type IconName =
  | 'notes'
  | 'clipboard'
  | 'folder'
  | 'gauge'
  | 'key'
  | 'settings'
  | 'back'
  | 'plus'
  | 'trash'
  | 'copy'
  | 'refresh'
  | 'check'
  | 'warning'
  | 'close'
  | 'spark'
  | 'search'
  | 'mini'
  | 'expand'
  | 'pin'
  | 'shield'
  | 'download'
  | 'grid'
  | 'mail'
  | 'github'
  | 'rss'
  | 'chart'
  | 'music'
  | 'cocktail'
  | 'clock'
  | 'sun'
  | 'cloud'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'rocket'

const PATHS: Record<IconName, ReactNode> = {
  notes: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5.5" y="4" width="13" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 10h6M9 14h6" />
    </>
  ),
  folder: (
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h9A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z" />
  ),
  gauge: (
    <>
      <path d="M4 18a8 8 0 1 1 16 0" />
      <path d="M12 18l4.5-6.5" />
      <circle cx="12" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8-8M16 4l3 3M14 6l2 2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.09A1.7 1.7 0 0 0 10 3.05V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
    </>
  ),
  back: <path d="M15 18l-6-6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l.8 13h9.4l.8-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 9V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h4" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v4h-4" />
    </>
  ),
  check: <path d="M5 13l4 4L19 7" />,
  warning: (
    <>
      <path d="M12 3.5 2.8 19.5h18.4z" />
      <path d="M12 9v4.5M12 16.6v.1" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  mini: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="2.5" />
      <path d="M7 12h.01M12 12h.01M17 12h.01" />
    </>
  ),
  expand: (
    <>
      <path d="M15 3h6v6M9 21H3v-6" />
      <path d="M21 3l-7 7M3 21l7-7" />
    </>
  ),
  pin: (
    <>
      <path d="M9 3h6M10 3v6l-3 2.5V14h10v-2.5L14 9V3" />
      <path d="M12 14v7" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5.5c0 4.4-2.9 7.9-7 9.5-4.1-1.6-7-5.1-7-9.5V6z" />
      <path d="M9.4 12.1l1.9 1.9 3.4-3.7" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v11" />
      <path d="m7.5 10 4.5 4.5 4.5-4.5" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
    </>
  ),
  github: (
    <path
      transform="translate(4 4)"
      fill="currentColor"
      stroke="none"
      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
    />
  ),
  rss: (
    <>
      <circle cx="6" cy="18" r="1.7" fill="currentColor" stroke="none" />
      <path d="M4.5 11.5a8 8 0 0 1 8 8M4.5 5.5a14 14 0 0 1 14 14" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19V5M4 19h16" />
      <path d="M7.5 15.5l4-4 3 2.5 5.5-7" />
      <path d="M16.5 7H20v3.5" />
    </>
  ),
  music: (
    <>
      <path d="M9 17.5V6.2l10-1.9v11.2" />
      <circle cx="6.4" cy="17.6" r="2.6" />
      <circle cx="16.4" cy="15.5" r="2.6" />
      <path d="M9 9.2l10-1.9" />
    </>
  ),
  cocktail: (
    <>
      <path d="M4 4h16l-8 9z" />
      <path d="M12 13v6M8 20h8" />
      <path d="M15.5 2.6 13 5.1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.4 2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  cloud: (
    <path d="M7 18h10.2a3.8 3.8 0 0 0 .6-7.6A5.6 5.6 0 0 0 7.2 9.3 4.4 4.4 0 0 0 7 18z" />
  ),
  rain: (
    <>
      <path d="M7.5 15h9.7a3.4 3.4 0 0 0 .5-6.8 5 5 0 0 0-9.5-1A4 4 0 0 0 7.5 15z" />
      <path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5" />
    </>
  ),
  snow: (
    <>
      <path d="M7.5 14.5h9.7a3.4 3.4 0 0 0 .5-6.8 5 5 0 0 0-9.5-1A4 4 0 0 0 7.5 14.5z" />
      <circle cx="8.3" cy="18.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="20" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.7" cy="18.2" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  storm: (
    <>
      <path d="M7 14h10a3.6 3.6 0 0 0 .5-7.2 5.3 5.3 0 0 0-9.9-1A4.1 4.1 0 0 0 7 14z" />
      <path d="M12.4 15.2 10 19.2h2.3L11 22.5l4.3-5h-2.4l1.5-2.3" />
    </>
  ),
  rocket: (
    <>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </>
  )
}

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 18, className }: IconProps): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
