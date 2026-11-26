import { shell } from 'electron'
import { publicFetch } from './public-fetch'
import type { UpdateCheckResult } from '../../shared/types'
import { APP_VERSION } from '../version'

const MAX_BYTES = 512 * 1024
const TIMEOUT_MS = 15000
const MAX_NOTES = 1500
const GITHUB_API = 'https://api.github.com'
const REPO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/

interface UpdateSource {
  url: string
  github: boolean
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true
  }
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true
  if (/^(fc|fd|fe8|fe9|fea|feb)/.test(host)) return true

  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) return false
  const [a, b] = match.slice(1).map(Number)
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

function assertPublicHttps(raw: string, label: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`That ${label} is not a valid URL.`)
  }
  if (url.protocol !== 'https:') {
    throw new Error(`Update checks need an https URL for the ${label}.`)
  }
  if (url.username || url.password) {
    throw new Error(`The ${label} cannot include a username or password.`)
  }
  if (isPrivateHost(url.hostname)) {
    throw new Error('Local and private network addresses are not supported for update checks.')
  }
  return url.toString()
}

function normalizeSource(value: unknown): UpdateSource {
  if (typeof value !== 'string') throw new Error('Enter a release source.')
  const raw = value.trim()
  if (!raw) throw new Error('Enter a release source.')
  if (raw.length > 500) throw new Error('That release source is too long.')

  if (REPO_PATTERN.test(raw)) {
    return { url: `${GITHUB_API}/repos/${raw}/releases/latest`, github: true }
  }

  if (!/^https?:\/\//i.test(raw)) {
    throw new Error('Use a GitHub repository like owner/repo, or an https URL to an update manifest.')
  }

  const normalized = assertPublicHttps(raw, 'release source')
  const url = new URL(normalized)
  if (url.hostname === 'github.com') {
    const [owner, repo] = url.pathname.split('/').filter(Boolean)
    if (!owner || !repo || !REPO_PATTERN.test(`${owner}/${repo}`)) {
      throw new Error('That GitHub address does not point to a repository.')
    }
    return { url: `${GITHUB_API}/repos/${owner}/${repo}/releases/latest`, github: true }
  }

  return {
    url: normalized,
    github: url.hostname === 'api.github.com' && /\/releases\/latest\/?$/.test(url.pathname)
  }
}

interface ParsedVersion {
  core: number[]
  pre: (number | string)[]
}

function parseVersion(value: string): ParsedVersion | null {
  const match = value.trim().match(/^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/)
  if (!match) return null
  return {
    core: match[1].split('.').map((part) => Number.parseInt(part, 10)),
    pre: match[2]
      ? match[2].split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part))
      : []
  }
}

function compareVersions(left: string, right: string): number {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) return 0

  const length = Math.max(a.core.length, b.core.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (a.core[index] ?? 0) - (b.core[index] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }

  if (a.pre.length === 0 && b.pre.length === 0) return 0
  if (a.pre.length === 0) return 1
  if (b.pre.length === 0) return -1

  const preLength = Math.max(a.pre.length, b.pre.length)
  for (let index = 0; index < preLength; index += 1) {
    const first = a.pre[index]
    const second = b.pre[index]
    if (first === undefined) return -1
    if (second === undefined) return 1
    if (first === second) continue
    if (typeof first === 'number' && typeof second === 'number') {
      return first > second ? 1 : -1
    }
    if (typeof first === 'number') return -1
    if (typeof second === 'number') return 1
    return first > second ? 1 : -1
  }
  return 0
}

function trimNotes(value: unknown): string {
  if (typeof value !== 'string') return ''
  const clean = value.replace(/\r\n/g, '\n').trim()
  return clean.length > MAX_NOTES ? `${clean.slice(0, MAX_NOTES)}…` : clean
}

async function fetchDocument(url: string): Promise<{ payload: Record<string, unknown>; finalUrl: string }> {
  let response: Response | undefined
  let current = assertPublicHttps(url, 'release source')
  for (let hop=0; hop<5; hop++) {
    try {
      response = await publicFetch(current, { headers: { accept: 'application/vnd.github+json, application/json', 'user-agent': `Toolbox/${APP_VERSION}` }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : ''
      if (name === 'TimeoutError' || name === 'AbortError') throw new Error('The update check timed out. Try again in a moment.')
      throw new Error('Could not reach the update server or the address is not public.')
    }
    if (response.status < 300 || response.status >= 400) break
    const location = response.headers.get('location')
    await response.body?.cancel().catch(() => {})
    if (!location) throw new Error('The update server redirected without a destination.')
    current = assertPublicHttps(new URL(location, current).toString(), 'update redirect')
    response = undefined
  }
  if (!response) throw new Error('The update server redirected too many times.')

  if (response.status === 404) {
    throw new Error('No published releases were found for that source yet.')
  }
  if (response.status === 403 || response.status === 429) {
    throw new Error('The release server is limiting checks right now. Try again later.')
  }
  if (!response.ok) {
    throw new Error(`The update check failed (HTTP ${response.status}).`)
  }

  const finalUrl = current
  const declared = Number(response.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    throw new Error('The update response is too large to inspect.')
  }
  const chunks: Buffer[] = []
  let size = 0
  const reader = response.body?.getReader()
  if (reader) {
    while (true) {
      const {done, value} = await reader.read()
      if (done) break
      if (!value) continue
      size += value.length
      if (size > MAX_BYTES) { await reader.cancel().catch(() => {}); throw new Error('The update response is too large to inspect.') }
      chunks.push(Buffer.from(value))
    }
  }
  const text = Buffer.concat(chunks).toString('utf8')

  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('The update source did not return valid JSON.')
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The update source returned an unexpected document.')
  }

  return { payload: payload as Record<string, unknown>, finalUrl }
}

export function getAppVersion(): string {
  return APP_VERSION
}

export async function checkForUpdate(source: unknown): Promise<UpdateCheckResult> {
  const target = normalizeSource(source)
  const { payload } = await fetchDocument(target.url)
  const currentVersion = APP_VERSION

  if (typeof payload.tag_name === 'string') {
    const latestVersion = payload.tag_name.trim()
    const pageUrl =
      typeof payload.html_url === 'string' && payload.html_url.trim()
        ? assertPublicHttps(payload.html_url, 'release page')
        : null
    return {
      currentVersion,
      latestVersion,
      available: compareVersions(latestVersion, currentVersion) > 0,
      url: pageUrl,
      notes: trimNotes(payload.body),
      publishedAt: typeof payload.published_at === 'string' ? payload.published_at : null,
      checkedAt: Date.now()
    }
  }

  const latestVersion = typeof payload.version === 'string' ? payload.version.trim() : ''
  if (!latestVersion) {
    throw new Error('The update source is missing a "version" field.')
  }
  const available = compareVersions(latestVersion, currentVersion) > 0
  const link =
    typeof payload.url === 'string' && payload.url.trim()
      ? assertPublicHttps(payload.url, 'download link')
      : null
  if (available && !link) {
    throw new Error('The update source does not include a download link for the new version.')
  }

  return {
    currentVersion,
    latestVersion,
    available,
    url: link,
    notes: trimNotes(payload.notes),
    publishedAt: typeof payload.publishedAt === 'string' ? payload.publishedAt : null,
    checkedAt: Date.now()
  }
}

export async function openUpdatePage(value: unknown): Promise<void> {
  if (typeof value !== 'string') throw new Error('That update link is not valid.')
  await shell.openExternal(assertPublicHttps(value, 'update link'))
}
