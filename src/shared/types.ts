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

export type MarketRange = 30 | 90 | 180

export interface MarketSeriesPoint {
  t: number
  p: number
}

export interface MarketSeries {
  id: string
  days: MarketRange
  points: MarketSeriesPoint[]
  change: number | null
  high: number
  low: number
  fetchedAt: number
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

export type ShortcutGroup = 'assistant' | 'local' | 'developer' | 'custom'

export interface ShortcutItem {
  id: string
  name: string
  hint: string
  url: string
  group: ShortcutGroup
  enabled: boolean
  installed: boolean
  custom: boolean
}

export interface ShortcutStatus {
  items: ShortcutItem[]
}

export interface ShortcutInput {
  name: string
  url: string
}

// ---------------------------------------------------------------------
// Model Farm — local model discovery, fit scoring and Ollama installs.
// ---------------------------------------------------------------------

export type ModelFarmScenario = 'now' | 'total'
export type ModelFarmVerdict = 'green' | 'yellow' | 'red'
export type ModelFarmFormat = 'gguf' | 'safetensors'
export type ModelFarmTask =
  | 'text-generation'
  | 'text-to-image'
  | 'text-to-speech'
  | 'image-to-text'
  | 'image-to-image'
  | 'text-to-video'
  | 'any-to-any'
  | 'automatic-speech-recognition'

export type ModelFarmGradeAxis = 'memory' | 'gpu' | 'compute' | 'storage'
export type ModelFarmGradeLetter = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'

export interface ModelFarmInstalledModel {
  name: string
  sizeBytes: number
  modifiedAt: string | null
}

export interface ModelFarmGpu {
  name: string
  vramBytes: number
}

export interface ModelFarmOllama {
  installed: boolean
  url: string
  models: ModelFarmInstalledModel[]
  error: string | null
}

export interface ModelFarmMachine {
  totalRamBytes: number
  availableRamBytes: number
  cores: number
  gpus: ModelFarmGpu[]
  freeDiskBytes: number | null
  gpuProbe: 'ok' | 'unknown'
  ollama: ModelFarmOllama
  detectedAt: number
}

export interface ModelFarmAxisRating {
  axis: ModelFarmGradeAxis
  label: string
  score: number | null
  detail: string
}

export interface ModelFarmMachineGrade {
  scenario: ModelFarmScenario
  score: number
  label: string
  axes: ModelFarmAxisRating[]
  weakest: ModelFarmAxisRating | null
}

export interface ModelFarmModel {
  id: string
  task: ModelFarmTask
  label: string
  author: string
  formats: ModelFarmFormat[]
  paramsBillions: number | null
  quantLabel: string | null
  fileBytes: number | null
  runtimeRamBytes: number
  downloads: number
  likes: number
  license: string | null
  tags: string[]
  hfUrl: string
}

export interface ModelFarmAxisFit extends ModelFarmAxisRating {
  model: number
  headroom: number | null
  fit: number | null
  modelDetail: string
}

export interface ModelFarmBottleneck {
  axis: ModelFarmGradeAxis
  label: string
  kind: 'machine' | 'model'
  message: string
  advice: string
}

export interface ModelFarmSetupGrade {
  scenario: ModelFarmScenario
  score: number
  letter: ModelFarmGradeLetter
  label: string
  machineScore: number
  modelScore: number
  axes: ModelFarmAxisFit[]
  bottleneck: ModelFarmBottleneck
}

export interface ModelFarmScoredModel extends ModelFarmModel {
  verdict: ModelFarmVerdict
  fitsNow: boolean
  fitsTotal: boolean
  reason: string
  hints: string[]
  grade: ModelFarmSetupGrade
  /** Installed local name, or null when the runtime does not serve it. */
  installed: string | null
}

export interface ModelFarmGroup {
  task: ModelFarmTask
  label: string
  icon: string
  models: ModelFarmScoredModel[]
}

export interface ModelFarmScoreResult {
  machine: ModelFarmMachine
  machineGrade: ModelFarmMachineGrade
  scenario: ModelFarmScenario
  groups: ModelFarmGroup[]
  total: number
  fetchedAt: number | null
  error: string | null
}

export interface ModelFarmStatus {
  machine: ModelFarmMachine
  machineGrade: ModelFarmMachineGrade
}

export interface ModelFarmCatalogResult {
  models: ModelFarmModel[]
  fetchedAt: number | null
  error: string | null
}

export interface ModelFarmScoreInput {
  scenario: ModelFarmScenario
  search?: string
  minParams?: number | null
  maxParams?: number | null
  onlyReachable?: boolean
}

export interface ModelFarmPrefs {
  scenario: ModelFarmScenario
  taskFilter: string
  minParams: number | null
  maxParams: number | null
  showReds: boolean
}

export type ModelFarmPrefsInput = Partial<ModelFarmPrefs>

export interface ModelFarmQuant {
  quant: string | null
  filename: string
  sizeBytes: number
}

export interface ModelFarmQuantsResult {
  repo: string
  quants: ModelFarmQuant[]
  error: string | null
}

export type ModelFarmDownloadStatus = 'downloading' | 'done' | 'error'

export interface ModelFarmDownload {
  id: string
  repo: string
  model: string
  reference: string
  quant: string | null
  status: ModelFarmDownloadStatus
  output: string
  error: string | null
}

export interface ModelFarmInstallInput {
  repo: string
  quant?: string | null
  numGpu?: number | null
}

export interface ModelFarmInstallResult {
  ok: boolean
  repo: string
  model: string
  reference: string
  status: ModelFarmDownloadStatus
  output: string
  error: string | null
}

export interface ModelFarmRemoveInput {
  model?: string
  repo?: string
}

export interface ModelFarmRemoveResult {
  ok: boolean
  removed: string | null
  message: string
  output: string
}

export interface DiagnosticCheck { kind: 'dns' | 'tcp' | 'http'; target: string; port?: number }
export interface DiagnosticResult { ok: boolean; detail: string; durationMs: number; checkedAt: number }
export interface IncidentSnapshot { summary: string; events: string; createdAt: number }

export interface ProjectStatus { name:string; path:string; branch:string; changes:number | null; ahead:number | null; behind:number | null; remoteUrl:string; error:string }

export interface ToolboxReminder { id:string; name:string; dueAt:number; repeat:'none' | 'daily' | 'weekly'; done:boolean }

export interface DiskScan {path:string;name:string;entries:{name:string;bytes:number}[];totalBytes:number;skipped:number;truncated:boolean;scannedAt:number}

export interface ServiceSnapshot {takenAt:number;services:{name:string;status:string;startType:string}[]}

export interface AiEndpointResult {ok:boolean;models:string[];durationMs:number;error:string}

export interface ToolboxApi {
  aiMonitor: { check(input:{kind:'ollama'|'lmstudio';url:string}): Promise<AiEndpointResult> }
  configuration: { services(names:string): Promise<ServiceSnapshot> }
  diskExplorer: { pickFolder(): Promise<string | null>; scan(path:string): Promise<DiskScan>; capacity(path:string): Promise<{total:number;free:number}> }
  reminders: { list(): Promise<ToolboxReminder[]>; add(input: {name:string;dueAt:number;repeat:ToolboxReminder['repeat']}): Promise<ToolboxReminder[]>; remove(id:string): Promise<ToolboxReminder[]> }
  projects: { pickFolder(): Promise<string | null>; list(path:string): Promise<ProjectStatus[]>; fetch(path:string): Promise<void> }
  diagnostics: { run(input: DiagnosticCheck): Promise<DiagnosticResult>; incident(includeEvents: boolean): Promise<IncidentSnapshot>; emailDraft(input: {recipient: string; subject: string; body: string}): Promise<void>; sendEmail(input: {recipient: string; subject: string; body: string}): Promise<{recipient:string}> }
  appWindow: {
    setCompact(compact: boolean, width?: number): Promise<void>
    setPlayerMini(active: boolean, width?: number): Promise<void>
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
    series(id: string, days: MarketRange): Promise<MarketSeries>
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
    setMini(active: boolean): Promise<ArtistWaveStatus>
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
    verify(input: BackupRestoreInput): Promise<{fileName:string;secretCount:number;createdAt:number}>
  }
  updates: {
    version(): Promise<string>
    check(source: string): Promise<UpdateCheckResult>
    open(url: string): Promise<void>
  }
  shortcuts: {
    status(): Promise<ShortcutStatus>
    toggle(id: string, enabled: boolean): Promise<ShortcutStatus>
    add(input: ShortcutInput): Promise<ShortcutStatus>
    remove(id: string): Promise<ShortcutStatus>
    rescan(): Promise<ShortcutStatus>
    open(id: string): Promise<'app' | 'link'>
  }
  modelFarm: {
    status(forceDetect?: boolean): Promise<ModelFarmStatus>
    catalog(forceRefresh?: boolean): Promise<ModelFarmCatalogResult>
    score(input: ModelFarmScoreInput): Promise<ModelFarmScoreResult>
    search(query: string, scenario?: ModelFarmScenario): Promise<ModelFarmScoreResult>
    quants(repo: string): Promise<ModelFarmQuantsResult>
    prefs(): Promise<ModelFarmPrefs>
    setPrefs(input: ModelFarmPrefsInput): Promise<ModelFarmPrefs>
    install(input: ModelFarmInstallInput): Promise<ModelFarmInstallResult>
    remove(input: ModelFarmRemoveInput): Promise<ModelFarmRemoveResult>
    downloads(): Promise<ModelFarmDownload[]>
    onProgress(listener: (downloads: ModelFarmDownload[]) => void): () => void
    refresh(): Promise<ModelFarmStatus>
  }
  platform: string
}
