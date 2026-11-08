import { app, BrowserWindow, safeStorage, shell } from 'electron'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { GitHubSetup, GitHubStatus, GitHubThread } from '../../shared/types'
import { showDesktopNotification } from './notify'
import { USER_AGENT } from '../version'

const API_ROOT = 'https://api.github.com'
const POLL_MS = 3 * 60 * 1000
const REQUEST_TIMEOUT_MS = 15000
const MAX_THREADS = 50

interface StoredGitHub {
  version: 1
  login: string
  secret: string
  notifications: boolean
}

interface GitHubState {
  account: StoredGitHub | null
  token: string | null
  loaded: boolean
  connected: boolean
  checking: boolean
  unread: number
  lastCheck: number | null
  error: string | null
  threads: GitHubThread[]
  knownIds: Set<string>
  baselineDone: boolean
  timer: NodeJS.Timeout | null
  pending: Promise<GitHubStatus> | null
  generation: number
}

const state: GitHubState = {
  account: null,
  token: null,
  loaded: false,
  connected: false,
  checking: false,
  unread: 0,
  lastCheck: null,
  error: null,
  threads: [],
  knownIds: new Set(),
  baselineDone: false,
  timer: null,
  pending: null,
  generation: 0
}

function accountPath(): string {
  return join(app.getPath('userData'), 'github.json')
}

function isStoredAccount(value: unknown): value is StoredGitHub {
  if (!value || typeof value !== 'object') return false
  const account = value as Partial<StoredGitHub>
  return (
    account.version === 1 &&
    typeof account.login === 'string' &&
    typeof account.secret === 'string' &&
    typeof account.notifications === 'boolean'
  )
}

function status(): GitHubStatus {
  return {
    configured: Boolean(state.account),
    login: state.account?.login ?? '',
    connected: state.connected,
    checking: state.checking,
    unread: state.unread,
    lastCheck: state.lastCheck,
    error: state.error,
    notifications: state.account?.notifications ?? true,
    threads: state.threads
  }
}

function broadcast(): void {
  const payload = status()
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('github:update', payload)
  }
}

async function persistAccount(account: StoredGitHub | null = state.account): Promise<void> {
  if (!account) return
  const target = accountPath()
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(account, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  })
}

async function loadAccount(): Promise<void> {
  if (state.loaded) return
  state.loaded = true

  try {
    const raw = await readFile(accountPath(), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredAccount(parsed)) return
    if (!(await safeStorage.isAsyncEncryptionAvailable())) return

    const decrypted = await safeStorage.decryptStringAsync(Buffer.from(parsed.secret, 'base64'))
    state.account = parsed
    state.token = decrypted.result

    if (decrypted.shouldReEncrypt) {
      parsed.secret = (await safeStorage.encryptStringAsync(decrypted.result)).toString('base64')
      await persistAccount()
    }
  } catch {
    state.account = null
    state.token = null
  }
}

function validateToken(input: unknown): string {
  if (!input || typeof input !== 'object') throw new Error('Enter a GitHub personal access token.')
  const setup = input as Partial<GitHubSetup>
  const token = typeof setup.token === 'string' ? setup.token.trim() : ''
  if (!/^[A-Za-z0-9_]{20,255}$/.test(token)) {
    throw new Error(
      'That does not look like a GitHub token. Create a fine-grained token with Notifications read access, or a classic token with the notifications scope.'
    )
  }
  return token
}

interface ApiError extends Error {
  status?: number
  detail?: string
}

function apiHeaders(token: string, json = false): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': USER_AGENT,
    ...(json ? { 'Content-Type': 'application/json' } : {})
  }
}

async function apiFetch(
  path: string,
  token: string,
  init: { method?: string; body?: string } = {}
): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...init,
      headers: apiHeaders(token, Boolean(init.body)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (cause) {
    const error = new Error(
      cause instanceof Error && cause.name === 'TimeoutError'
        ? 'GitHub did not respond in time. Check your connection and try again.'
        : 'Could not reach GitHub. Check your internet connection.'
    ) as ApiError
    throw error
  }

  if (!response.ok) {
    let detail = ''
    try {
      const body = (await response.json()) as { message?: string }
      detail = typeof body.message === 'string' ? body.message : ''
    } catch {
      detail = ''
    }
    const error = new Error(detail || `GitHub returned HTTP ${response.status}.`) as ApiError
    error.status = response.status
    error.detail = detail
    throw error
  }
  return response
}

function friendlyError(cause: unknown): string {
  const error = cause as ApiError
  const message = error instanceof Error ? error.message : String(cause)
  if (error.status === 401) {
    return 'GitHub rejected the token. Make sure it has not expired and includes Notifications access.'
  }
  if (error.status === 403 && /rate limit/i.test(message)) {
    return 'The GitHub API rate limit was reached. Try again in a few minutes.'
  }
  if (error.status === 403) {
    return 'GitHub refused access. Check that the token has Notifications read access.'
  }
  if (error.status === 404) {
    return 'GitHub could not find the notifications endpoint.'
  }
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|timeout|network/i.test(message)) {
    return 'Could not reach GitHub. Check your internet connection and try again.'
  }
  return message
}

interface RawThread {
  id?: string
  reason?: string
  updated_at?: string
  subject?: { title?: string; type?: string; url?: string | null }
  repository?: { full_name?: string; html_url?: string }
}

function threadUrl(raw: RawThread): string {
  const repo = raw.repository?.html_url
  if (raw.subject?.type === 'Release' && repo) return `${repo}/releases`
  const api = raw.subject?.url
  if (api?.startsWith(`${API_ROOT}/repos/`)) {
    return api.replace(API_ROOT, 'https://github.com')
  }
  return repo ?? 'https://github.com/notifications'
}

function mapThread(raw: RawThread): GitHubThread | null {
  const id = typeof raw.id === 'string' ? raw.id : ''
  if (!/^\d+$/.test(id)) return null
  return {
    id,
    title: raw.subject?.title?.trim() || '(untitled)',
    repo: raw.repository?.full_name ?? 'GitHub',
    type: raw.subject?.type ?? 'Thread',
    reason: raw.reason ?? 'subscribed',
    updatedAt: raw.updated_at ?? '',
    url: threadUrl(raw)
  }
}

async function fetchThreads(token: string): Promise<GitHubThread[]> {
  const response = await apiFetch(`/notifications?all=false&per_page=${MAX_THREADS}`, token)
  const data: unknown = await response.json()
  if (!Array.isArray(data)) throw new Error('GitHub returned an unexpected notifications response.')
  return data
    .map((entry) => mapThread(entry as RawThread))
    .filter((entry): entry is GitHubThread => entry !== null)
}

async function fetchLogin(token: string): Promise<string> {
  const response = await apiFetch('/user', token)
  const data = (await response.json()) as { login?: string }
  if (!data.login) throw new Error('GitHub did not return an account name for this token.')
  return data.login
}

function notifyNewThreads(threads: GitHubThread[]): void {
  if (threads.length === 0) return
  if (!state.account?.notifications) return

  const title =
    threads.length === 1 ? 'New GitHub notification' : `${threads.length} new GitHub notifications`
  const body =
    threads.length === 1
      ? `${threads[0].repo} — ${threads[0].title}`
      : `${threads[0].repo} — ${threads[0].title} (and ${threads.length - 1} more)`
  showDesktopNotification(title, body)
}

async function runCheck(reason: 'startup' | 'timer' | 'manual'): Promise<GitHubStatus> {
  const token = state.token
  if (!token) return status()
  if (state.pending) return state.pending

  const generation = state.generation
  state.checking = true
  state.error = null
  broadcast()

  const task = (async () => {
    try {
      const threads = await fetchThreads(token)
      if (generation !== state.generation) return status()

      const baseline = state.baselineDone
      const fresh = threads.filter((thread) => !state.knownIds.has(thread.id))

      state.threads = threads
      state.unread = threads.length
      state.knownIds = new Set(threads.map((thread) => thread.id))
      state.lastCheck = Date.now()
      state.connected = true
      state.error = null
      state.baselineDone = true

      if (reason === 'timer' && baseline) notifyNewThreads(fresh)
    } catch (cause) {
      if (generation !== state.generation) return status()
      state.connected = false
      state.error = friendlyError(cause)
    } finally {
      if (generation === state.generation) {
        state.checking = false
        state.pending = null
        broadcast()
      }
    }
    return status()
  })()

  state.pending = task
  return task
}

function startPolling(): void {
  stopPolling()
  state.timer = setInterval(() => void runCheck('timer'), POLL_MS)
}

function stopPolling(): void {
  if (state.timer) {
    clearInterval(state.timer)
    state.timer = null
  }
}

export async function initGitHub(): Promise<void> {
  await loadAccount()
  if (!state.account || !state.token) return
  startPolling()
  void runCheck('startup')
}

export function getGitHubStatus(): GitHubStatus {
  return status()
}

export async function connectGitHub(input: unknown): Promise<GitHubStatus> {
  const token = validateToken(input)

  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error('Windows encryption is unavailable, so the GitHub token cannot be stored safely.')
  }

  state.loaded = true
  stopPolling()
  state.generation += 1
  state.pending = null
  state.checking = true
  state.error = null
  state.connected = false
  broadcast()

  try {
    const login = await fetchLogin(token)
    const threads = await fetchThreads(token)
    const secret = (await safeStorage.encryptStringAsync(token)).toString('base64')

    const nextAccount: StoredGitHub = {
      version: 1,
      login,
      secret,
      notifications: true
    }
    await persistAccount(nextAccount)

    state.account = nextAccount
    state.token = token
    state.threads = threads
    state.unread = threads.length
    state.knownIds = new Set(threads.map((thread) => thread.id))
    state.baselineDone = true
    state.lastCheck = Date.now()
    state.connected = true
    state.error = null
    startPolling()
    broadcast()
    return status()
  } catch (cause) {
    const message = friendlyError(cause)
    state.connected = false
    state.error = message
    if (state.account) startPolling()
    throw new Error(message)
  } finally {
    state.checking = false
    broadcast()
  }
}

export async function disconnectGitHub(): Promise<GitHubStatus> {
  stopPolling()
  state.generation += 1
  state.pending = null
  state.account = null
  state.token = null
  state.connected = false
  state.checking = false
  state.unread = 0
  state.lastCheck = null
  state.error = null
  state.threads = []
  state.knownIds = new Set()
  state.baselineDone = false
  await rm(accountPath(), { force: true }).catch(() => {})
  broadcast()
  return status()
}

export async function checkGitHub(): Promise<GitHubStatus> {
  return runCheck('manual')
}

export async function setGitHubNotifications(enabled: unknown): Promise<GitHubStatus> {
  if (!state.account) return status()
  state.account.notifications = enabled === true
  await persistAccount().catch(() => {})
  broadcast()
  return status()
}

export async function markGitHubThreadRead(id: unknown): Promise<GitHubStatus> {
  const threadId = typeof id === 'string' ? id : ''
  if (!/^\d+$/.test(threadId)) throw new Error('Invalid GitHub notification id.')
  if (!state.token) return status()

  try {
    await apiFetch(`/notifications/threads/${threadId}`, state.token, { method: 'PATCH' })
  } catch (cause) {
    throw new Error(friendlyError(cause))
  }

  state.threads = state.threads.filter((thread) => thread.id !== threadId)
  state.knownIds.delete(threadId)
  state.unread = state.threads.length
  broadcast()
  return status()
}

export async function markAllGitHubRead(): Promise<GitHubStatus> {
  if (!state.token) return status()

  try {
    await apiFetch('/notifications', state.token, {
      method: 'PUT',
      body: JSON.stringify({ last_read_at: new Date().toISOString() })
    })
  } catch (cause) {
    throw new Error(friendlyError(cause))
  }

  state.threads = []
  state.unread = 0
  state.knownIds = new Set()
  state.baselineDone = true
  broadcast()
  return status()
}

export async function openGitHubThread(url: unknown): Promise<void> {
  if (typeof url !== 'string') throw new Error('Invalid GitHub link.')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid GitHub link.')
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') {
    throw new Error('Only github.com links can be opened.')
  }
  await shell.openExternal(parsed.toString())
}

export function stopGitHub(): void {
  stopPolling()
}
