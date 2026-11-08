export interface ClipItem {
  id: string
  text: string
  at: number
}

export interface SystemStats {
  cpuPercent: number
  memUsed: number
  memTotal: number
  diskFree: number
  diskTotal: number
  diskName: string
  uptime: number
  hostname: string
  platform: string
  cpuModel: string
  cores: number
}

export interface ProcessInfo {
  name: string
  pid: number
  cpu: number | null
  memMb: number
}

export interface FileEntry {
  name: string
  size: number
  ext: string
  isDirectory: boolean
  category: string
}

export interface OrganizeCategory {
  name: string
  count: number
}

export interface OrganizeResult {
  moved: number
  skipped: number
  errors: string[]
  categories: OrganizeCategory[]
}

export interface VaultEntry {
  id: string
  name: string
  notes: string
  updatedAt: number
}

export interface VaultInput {
  name: string
  value: string
  notes?: string
}

export interface UserToolMeta {
  id: string
  name: string
  description: string
  icon: string
  accent: string
}

export interface UserToolError {
  folder: string
  message: string
}

export interface UserToolScan {
  tools: UserToolMeta[]
  errors: UserToolError[]
}

export interface InstallExampleResult {
  installed: boolean
  id: string
}

export interface WeatherCity {
  id: number
  name: string
  country: string
  region: string
  latitude: number
  longitude: number
  timezone: string
}

export interface WeatherSnapshot {
  temperature: number
  apparentTemperature: number
  humidity: number
  windSpeed: number
  weatherCode: number
  timezone: string
  observedAt: string
}

export interface MailMessageSummary {
  uid: number
  from: string
  subject: string
  date: string | null
  seen: boolean
}

export interface MailStatus {
  configured: boolean
  email: string
  host: string
  port: number
  connected: boolean
  checking: boolean
  unread: number
  lastCheck: number | null
  error: string | null
  notifications: boolean
  messages: MailMessageSummary[]
}

export interface MailSetup {
  email: string
  password: string
}

export interface GitHubThread {
  id: string
  title: string
  repo: string
  type: string
  reason: string
  updatedAt: string
  url: string
}

export interface GitHubStatus {
  configured: boolean
  login: string
  connected: boolean
  checking: boolean
  unread: number
  lastCheck: number | null
  error: string | null
  notifications: boolean
  threads: GitHubThread[]
}

export interface GitHubSetup {
  token: string
}

export interface FeedSource {
  id: string
  url: string
  title: string
  error: string | null
}

export interface FeedItem {
  id: string
  feedId: string
  feedTitle: string
  title: string
  link: string
  publishedAt: string | null
  summary: string
}

export interface FeedStatus {
  feeds: FeedSource[]
  items: FeedItem[]
  checking: boolean
  lastCheck: number | null
  error: string | null
}

export interface MarketCoin {
  id: string
  symbol: string
  name: string
  price: number
  change24h: number | null
  marketCap: number | null
}

export interface MarketStatus {
  watchlist: string[]
  coins: MarketCoin[]
  checking: boolean
  lastCheck: number | null
  error: string | null
}

export interface BartenderIngredient {
  id: number
  name: string
  category: string
}

export interface BartenderRecipeIngredient {
  id: number
  name: string
  amount: string
  have: boolean
}

export interface BartenderRecipe {
  id: number
  name: string
  instructions: string
  glassware: string
  imageUrl: string
  sourceUrl: string | null
  totalRequired: number
  matchedCount: number
  ingredients: BartenderRecipeIngredient[]
}

export interface BartenderStatus {
  ingredients: BartenderIngredient[]
  selectedIds: number[]
  recipes: BartenderRecipe[]
  loading: boolean
  matching: boolean
  lastLoaded: number | null
  lastMatch: number | null
  error: string | null
  matchError: string | null
}

export type ArtistWaveAction =
  | 'play'
  | 'next'
  | 'previous'
  | 'favorite'
  | 'save'
  | 'shuffle'
  | 'repeat'
  | 'seek'
  | 'volume'
  | 'track'
  | 'queuePlay'

export type ArtistWaveValue = number

export interface ArtistWaveQueueItem {
  title: string
  artist: string
  index: number
  source: 'smart' | 'library'
}

export interface ArtistWaveSnapshot {
  title: string
  artist: string
  cover: string
  source: string
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  favorite: boolean
  hasTrack: boolean
  shuffle: boolean
  repeat: string
  queueLength: number
  upNext: ArtistWaveQueueItem[]
}

export interface ArtistWaveStatus {
  open: boolean
  visible: boolean
  loading: boolean
  ready: boolean
  error: string | null
  mini: boolean
  snapshot: ArtistWaveSnapshot | null
}

export interface BackupConfig {
  disabled: string[]
  pinned: boolean
  cardSize: 'small' | 'medium' | 'large'
}

export interface BackupLocation {
  path: string
  label: string
  kind: 'google-drive' | 'onedrive' | 'dropbox' | 'local'
}

export interface BackupCreateInput {
  destination: string
  password: string
  config: BackupConfig
}

export interface BackupCreateResult {
  file: string
  fileName: string
  size: number
  createdAt: number
  secretCount: number
}

export interface BackupPreview {
  file: string
  fileName: string
  size: number
  createdAt: number
}

export interface BackupRestoreInput {
  file: string
  password: string
}

export interface BackupRestoreResult {
  file: string
  fileName: string
  createdAt: number
  appVersion: string
  secretCount: number
  config: BackupConfig
}

export interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string
  available: boolean
  url: string | null
  notes: string
  publishedAt: string | null
  checkedAt: number
}

export interface ToolboxApi {
  appWindow: {
    setCompact(compact: boolean, width?: number): Promise<void>
    setPlayerMini(active: boolean): Promise<void>
    setAlwaysOnTop(value: boolean): Promise<boolean>
  }
  clipboard: {
    list(): Promise<ClipItem[]>
    copy(text: string): Promise<void>
    clear(): Promise<void>
  }
  vault: {
    list(): Promise<VaultEntry[]>
    add(input: VaultInput): Promise<VaultEntry>
    copy(id: string): Promise<void>
    remove(id: string): Promise<void>
  }
  userTools: {
    list(): Promise<UserToolScan>
    code(id: string): Promise<string>
    openFolder(): Promise<void>
    installExample(): Promise<InstallExampleResult>
  }
  system: {
    stats(): Promise<SystemStats>
    processes(): Promise<ProcessInfo[]>
  }
  files: {
    pickFolder(): Promise<string | null>
    list(dir: string): Promise<FileEntry[]>
    organize(dir: string): Promise<OrganizeResult>
  }
  weather: {
    search(query: string): Promise<WeatherCity[]>
    current(city: WeatherCity): Promise<WeatherSnapshot>
  }
  mail: {
    status(): Promise<MailStatus>
    connect(input: MailSetup): Promise<MailStatus>
    disconnect(): Promise<MailStatus>
    check(): Promise<MailStatus>
    setNotifications(enabled: boolean): Promise<MailStatus>
    onUpdate(listener: (status: MailStatus) => void): () => void
  }
  github: {
    status(): Promise<GitHubStatus>
    connect(input: GitHubSetup): Promise<GitHubStatus>
    disconnect(): Promise<GitHubStatus>
    check(): Promise<GitHubStatus>
    setNotifications(enabled: boolean): Promise<GitHubStatus>
    markRead(id: string): Promise<GitHubStatus>
    markAllRead(): Promise<GitHubStatus>
    openThread(url: string): Promise<void>
    onUpdate(listener: (status: GitHubStatus) => void): () => void
  }
  feeds: {
    status(): Promise<FeedStatus>
    add(url: string): Promise<FeedStatus>
    remove(id: string): Promise<FeedStatus>
    refresh(): Promise<FeedStatus>
    openItem(url: string): Promise<void>
  }
  markets: {
    status(): Promise<MarketStatus>
    refresh(): Promise<MarketStatus>
    setWatchlist(ids: string[]): Promise<MarketStatus>
  }
  bartender: {
    status(): Promise<BartenderStatus>
    load(): Promise<BartenderStatus>
    match(ids: number[]): Promise<BartenderStatus>
    openSource(url: string): Promise<void>
  }
  artistwave: {
    status(): Promise<ArtistWaveStatus>
    attach(): Promise<ArtistWaveStatus>
    detach(): Promise<ArtistWaveStatus>
    setVisible(visible: boolean): Promise<ArtistWaveStatus>
    command(action: ArtistWaveAction, value?: ArtistWaveValue): Promise<ArtistWaveStatus>
    onUpdate(listener: (status: ArtistWaveStatus) => void): () => void
  }
  backup: {
    locations(): Promise<BackupLocation[]>
    pickFolder(): Promise<string | null>
    pickFile(): Promise<string | null>
    openFolder(path: string): Promise<void>
    list(destination: string): Promise<BackupPreview[]>
    create(input: BackupCreateInput): Promise<BackupCreateResult>
    restore(input: BackupRestoreInput): Promise<BackupRestoreResult>
  }
  updates: {
    version(): Promise<string>
    check(source: string): Promise<UpdateCheckResult>
    open(url: string): Promise<void>
  }
  platform: string
}
