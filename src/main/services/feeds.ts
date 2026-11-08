import { app, shell } from 'electron'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { XMLParser } from 'fast-xml-parser'
import type { FeedItem, FeedSource, FeedStatus } from '../../shared/types'

const MAX_FEEDS = 8
const MAX_ITEMS = 24
const MAX_BYTES = 2 * 1024 * 1024
const FETCH_TIMEOUT_MS = 12000
const USER_AGENT = 'Toolbox/0.9.0'

interface StoredFeed {
  id: string
  url: string
  title: string
}

interface StoredFeeds {
  version: 1
  feeds: StoredFeed[]
}

interface FeedState {
  feeds: FeedSource[]
  items: FeedItem[]
  checking: boolean
  lastCheck: number | null
  error: string | null
  loaded: boolean
  pending: Promise<FeedStatus> | null
  generation: number
}

const state: FeedState = {
  feeds: [],
  items: [],
  checking: false,
  lastCheck: null,
  error: null,
  loaded: false,
  pending: null,
  generation: 0
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  cdataPropName: '#cdata'
})

function feedsPath(): string {
  return join(app.getPath('userData'), 'feeds.json')
}

function status(): FeedStatus {
  return {
    feeds: state.feeds,
    items: state.items,
    checking: state.checking,
    lastCheck: state.lastCheck,
    error: state.error
  }
}

function isStoredFeed(value: unknown): value is StoredFeed {
  if (!value || typeof value !== 'object') return false
  const feed = value as Partial<StoredFeed>
  return (
    typeof feed.id === 'string' &&
    typeof feed.url === 'string' &&
    typeof feed.title === 'string'
  )
}

async function loadFeeds(): Promise<void> {
  if (state.loaded) return
  state.loaded = true

  try {
    const raw = await readFile(feedsPath(), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    const feeds = (parsed as StoredFeeds)?.feeds
    if (!Array.isArray(feeds)) return
    state.feeds = feeds.filter(isStoredFeed).slice(0, MAX_FEEDS).map((feed) => ({
      id: feed.id,
      url: feed.url,
      title: feed.title,
      error: null
    }))
  } catch {
    state.feeds = []
  }
}

async function persistFeeds(): Promise<void> {
  const target = feedsPath()
  await mkdir(dirname(target), { recursive: true })
  await writeFile(
    target,
    JSON.stringify(
      {
        version: 1,
        feeds: state.feeds.map(({ id, url, title }) => ({ id, url, title }))
      },
      null,
      2
    ),
    { encoding: 'utf8', mode: 0o600 }
  )
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

function validateFeedUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Enter a feed URL.')
  const raw = value.trim()
  if (!raw) throw new Error('Enter a feed URL.')
  if (raw.length > 2048) throw new Error('That feed URL is too long.')

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('That is not a valid URL.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Feeds must use an http or https URL.')
  }
  if (url.username || url.password) {
    throw new Error('Feed URLs cannot include a username or password.')
  }
  if (isPrivateHost(url.hostname)) {
    throw new Error('Local and private network addresses are not supported for feeds.')
  }
  return url.toString()
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const point = Number(code)
      return Number.isFinite(point) && point <= 0x10ffff ? String.fromCodePoint(point) : ''
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => {
      const point = Number.parseInt(code, 16)
      return Number.isFinite(point) && point <= 0x10ffff ? String.fromCodePoint(point) : ''
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
}

function cleanText(value: unknown): string {
  if (value == null) return ''
  const raw =
    typeof value === 'string'
      ? value
      : typeof value === 'number'
        ? String(value)
        : typeof value === 'object'
          ? cleanText(
              (value as Record<string, unknown>)['#text'] ??
                (value as Record<string, unknown>)['#cdata']
            )
          : ''
  if (!raw) return ''
  return decodeEntities(
    raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function linkHref(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const href = record['@_href']
    if (typeof href === 'string') return href.trim()
    const resource = Object.entries(record).find(([key]) => key.endsWith(':resource'))?.[1]
    if (typeof resource === 'string') return resource.trim()
    return cleanText(record['#text'])
  }
  return ''
}

function parseDate(value: unknown): string | null {
  if (!value) return null
  const raw = typeof value === 'string' ? value : cleanText(value)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

interface ParsedItem {
  title: string
  link: string
  publishedAt: string | null
  summary: string
}

interface ParsedFeed {
  title: string
  items: ParsedItem[]
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function normalizeItems(items: ParsedItem[], feed: FeedSource): FeedItem[] {
  return items
    .filter((item) => item.title || item.link)
    .slice(0, 40)
    .map((item) => {
      const title = item.title.slice(0, 300) || 'Untitled item'
      let link = item.link.slice(0, 2048)
      try {
        if (link) link = new URL(link, feed.url).toString()
      } catch {
        link = ''
      }
      const key = link || `${title}:${item.publishedAt ?? ''}`
      const id = createHash('sha1').update(`${feed.id}:${key}`).digest('hex')
      return {
        id,
        feedId: feed.id,
        feedTitle: feed.title,
        title,
        link,
        publishedAt: item.publishedAt,
        summary: item.summary.slice(0, 300)
      }
    })
}

function parseFeedDocument(xml: string, sourceUrl: string): ParsedFeed {
  if (!xml.trim()) throw new Error('The feed is empty.')
  const document = parser.parse(xml) as Record<string, unknown>

  const rss = document.rss as Record<string, unknown> | undefined
  if (rss?.channel) {
    const channel = rss.channel as Record<string, unknown>
    const items = asArray(channel.item as Record<string, unknown> | Record<string, unknown>[])
    return {
      title: cleanText(channel.title).slice(0, 120) || hostLabel(sourceUrl),
      items: items.map((item) => ({
        title: cleanText(item.title),
        link: linkHref(item.link),
        publishedAt: parseDate(item.pubDate ?? item['dc:date'] ?? item.published),
        summary: cleanText(
          item.description ?? item['content:encoded'] ?? item.summary
        )
      }))
    }
  }

  const atom = document.feed as Record<string, unknown> | undefined
  if (atom) {
    const entries = asArray(atom.entry as Record<string, unknown> | Record<string, unknown>[])
    return {
      title: cleanText(atom.title).slice(0, 120) || hostLabel(sourceUrl),
      items: entries.map((entry) => {
        const links = asArray(entry.link as unknown)
        const alternate =
          links.find(
            (link) =>
              link &&
              typeof link === 'object' &&
              (!(link as Record<string, unknown>)['@_rel'] ||
                (link as Record<string, unknown>)['@_rel'] === 'alternate')
          ) ?? links[0]
        return {
          title: cleanText(entry.title),
          link: linkHref(alternate),
          publishedAt: parseDate(entry.published ?? entry.updated),
          summary: cleanText(entry.summary ?? entry.content)
        }
      })
    }
  }

  const rdf = (document['rdf:RDF'] ?? document.RDF) as Record<string, unknown> | undefined
  if (rdf?.channel) {
    const channel = rdf.channel as Record<string, unknown>
    const items = asArray(rdf.item as Record<string, unknown> | Record<string, unknown>[])
    return {
      title: cleanText(channel.title).slice(0, 120) || hostLabel(sourceUrl),
      items: items.map((item) => ({
        title: cleanText(item.title),
        link: linkHref(item.link),
        publishedAt: parseDate(item['dc:date']),
        summary: cleanText(item.description)
      }))
    }
  }

  throw new Error('This URL does not look like an RSS or Atom feed.')
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.length
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {})
      throw new Error('That feed is larger than 2 MB.')
    }
    chunks.push(value)
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8')
}

async function fetchFeed(url: string): Promise<ParsedFeed> {
  let current = url

  for (let hop = 0; hop < 4; hop += 1) {
    let response: Response
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
        }
      })
    } catch (cause) {
      throw new Error(
        cause instanceof Error && cause.name === 'TimeoutError'
          ? 'The feed did not respond in time.'
          : 'Could not reach that feed.'
      )
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      await response.body?.cancel().catch(() => {})
      if (!location) throw new Error('The feed redirected without a destination.')
      current = validateFeedUrl(new URL(location, current).toString())
      continue
    }

    if (!response.ok) {
      throw new Error(`The feed returned HTTP ${response.status}.`)
    }

    const xml = await readLimitedText(response)
    return parseFeedDocument(xml, current)
  }

  throw new Error('The feed redirected too many times.')
}

function mergeItems(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>()
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
  unique.sort((left, right) => {
    const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : 0
    const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : 0
    return rightTime - leftTime
  })
  return unique.slice(0, MAX_ITEMS)
}

export async function initFeeds(): Promise<void> {
  await loadFeeds()
}

export function getFeedStatus(): FeedStatus {
  return status()
}

export async function addFeed(input: unknown): Promise<FeedStatus> {
  const url = validateFeedUrl(input)
  await loadFeeds()

  if (state.feeds.length >= MAX_FEEDS) {
    throw new Error(`You can follow up to ${MAX_FEEDS} feeds.`)
  }
  if (state.feeds.some((feed) => feed.url === url)) {
    throw new Error('That feed is already on your list.')
  }

  let parsed: ParsedFeed
  try {
    parsed = await fetchFeed(url)
  } catch (cause) {
    throw new Error(cause instanceof Error ? cause.message : String(cause))
  }

  const feed: FeedSource = {
    id: randomUUID(),
    url,
    title: parsed.title || hostLabel(url),
    error: null
  }

  state.generation += 1
  state.feeds = [...state.feeds, feed]
  state.items = mergeItems([
    ...state.items,
    ...normalizeItems(parsed.items, feed)
  ])
  state.lastCheck = Date.now()
  state.error = null
  await persistFeeds()
  return status()
}

export async function removeFeed(id: unknown): Promise<FeedStatus> {
  if (typeof id !== 'string') throw new Error('Invalid feed id.')
  state.generation += 1
  state.feeds = state.feeds.filter((feed) => feed.id !== id)
  state.items = state.items.filter((item) => item.feedId !== id)
  await persistFeeds()
  return status()
}

export async function refreshFeeds(): Promise<FeedStatus> {
  if (state.feeds.length === 0) return status()
  if (state.pending) return state.pending

  state.checking = true
  state.error = null
  const generation = state.generation

  const task = (async () => {
    const feeds = [...state.feeds]
    const results = await Promise.allSettled(feeds.map((feed) => fetchFeed(feed.url)))
    if (generation !== state.generation) return status()

    const nextItems: FeedItem[] = []
    const nextFeeds: FeedSource[] = feeds.map((feed, index) => {
      const result = results[index]
      if (result.status === 'fulfilled') {
        const parsed = result.value
        const updated: FeedSource = {
          ...feed,
          title: parsed.title || feed.title,
          error: null
        }
        nextItems.push(...normalizeItems(parsed.items, updated))
        return updated
      }
      nextItems.push(...state.items.filter((item) => item.feedId === feed.id))
      return {
        ...feed,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
      }
    })

    state.feeds = nextFeeds
    state.items = mergeItems(nextItems)
    state.lastCheck = Date.now()
    state.checking = false
    state.pending = null
    return status()
  })()

  state.pending = task
  try {
    return await task
  } finally {
    if (state.pending === task) {
      state.pending = null
      state.checking = false
    }
  }
}

export async function openFeedItem(url: unknown): Promise<void> {
  if (typeof url !== 'string') throw new Error('Invalid feed link.')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid feed link.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only web links can be opened.')
  }
  await shell.openExternal(parsed.toString())
}
