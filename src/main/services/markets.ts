import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  MarketCoin,
  MarketRange,
  MarketSeries,
  MarketSeriesPoint,
  MarketStatus
} from '../../shared/types'
import { USER_AGENT } from '../version'

const API_URL = 'https://api.coingecko.com/api/v3/coins/markets'
const SERIES_URL = 'https://api.coingecko.com/api/v3/coins'
const MAX_COINS = 8
const REQUEST_TIMEOUT_MS = 15000
const SERIES_TTL_MS = 30 * 60 * 1000
const SERIES_MAX_POINTS = 240
const SERIES_MAX_CACHE = 48
const SERIES_RANGES: MarketRange[] = [30, 90, 180]
const DEFAULT_IDS = ['bitcoin', 'ethereum', 'solana']

interface StoredMarkets {
  version: 1
  ids: string[]
}

interface MarketState {
  watchlist: string[]
  coins: MarketCoin[]
  checking: boolean
  lastCheck: number | null
  error: string | null
  loaded: boolean
  pending: Promise<MarketStatus> | null
  generation: number
}

const state: MarketState = {
  watchlist: [...DEFAULT_IDS],
  coins: [],
  checking: false,
  lastCheck: null,
  error: null,
  loaded: false,
  pending: null,
  generation: 0
}

function marketsPath(): string {
  return join(app.getPath('userData'), 'markets.json')
}

function status(): MarketStatus {
  return {
    watchlist: state.watchlist,
    coins: state.coins,
    checking: state.checking,
    lastCheck: state.lastCheck,
    error: state.error
  }
}

function validateIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Choose at least one coin id.')
  const ids = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => /^[a-z0-9][a-z0-9-]{0,39}$/.test(entry))

  const unique = [...new Set(ids)]
  if (unique.length === 0) throw new Error('Choose at least one coin id.')
  if (unique.length > MAX_COINS) throw new Error(`Watch up to ${MAX_COINS} coins at a time.`)
  return unique
}

async function loadWatchlist(): Promise<void> {
  if (state.loaded) return
  state.loaded = true

  try {
    const raw = await readFile(marketsPath(), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    const ids = (parsed as StoredMarkets)?.ids
    if (!Array.isArray(ids)) return
    const valid = ids
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => /^[a-z0-9][a-z0-9-]{0,39}$/.test(entry))
      .slice(0, MAX_COINS)
    if (valid.length > 0) state.watchlist = [...new Set(valid)]
  } catch {
    // Defaults are already in place.
  }
}

async function persistWatchlist(): Promise<void> {
  const target = marketsPath()
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify({ version: 1, ids: state.watchlist }, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  })
}

interface RawCoin {
  id?: string
  symbol?: string
  name?: string
  current_price?: number
  price_change_percentage_24h?: number | null
  market_cap?: number | null
}

async function fetchMarkets(ids: string[]): Promise<{ coins: MarketCoin[]; missing: string[] }> {
  const url = new URL(API_URL)
  url.searchParams.set('vs_currency', 'usd')
  url.searchParams.set('ids', ids.join(','))
  url.searchParams.set('order', 'market_cap_desc')
  url.searchParams.set('per_page', String(MAX_COINS))
  url.searchParams.set('page', '1')
  url.searchParams.set('sparkline', 'false')
  url.searchParams.set('price_change_percentage', '24h')

  let response: Response
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
    })
  } catch (cause) {
    throw new Error(
      cause instanceof Error && cause.name === 'TimeoutError'
        ? 'CoinGecko did not respond in time. Try again.'
        : 'Could not reach CoinGecko. Check your internet connection.'
    )
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('CoinGecko rate limit reached. Wait a minute, then refresh.')
    }
    throw new Error(`CoinGecko returned HTTP ${response.status}.`)
  }

  const data: unknown = await response.json()
  if (!Array.isArray(data)) throw new Error('CoinGecko returned an unexpected response.')

  const found = new Map<string, MarketCoin>()
  for (const entry of data as RawCoin[]) {
    if (typeof entry.id !== 'string' || typeof entry.current_price !== 'number') continue
    found.set(entry.id, {
      id: entry.id,
      symbol: (entry.symbol ?? entry.id).toUpperCase(),
      name: entry.name ?? entry.id,
      price: entry.current_price,
      change24h:
        typeof entry.price_change_percentage_24h === 'number'
          ? entry.price_change_percentage_24h
          : null,
      marketCap: typeof entry.market_cap === 'number' ? entry.market_cap : null
    })
  }

  const coins = ids.map((id) => found.get(id)).filter((coin): coin is MarketCoin => Boolean(coin))
  const missing = ids.filter((id) => !found.has(id))
  return { coins, missing }
}

export async function initMarkets(): Promise<void> {
  await loadWatchlist()
}

export function getMarketStatus(): MarketStatus {
  return status()
}

export async function refreshMarkets(): Promise<MarketStatus> {
  await loadWatchlist()
  if (state.pending) return state.pending

  const generation = state.generation
  const ids = [...state.watchlist]
  state.checking = true
  state.error = null

  const task = (async () => {
    try {
      const { coins, missing } = await fetchMarkets(ids)
      if (generation !== state.generation) return status()
      state.coins = coins
      state.lastCheck = Date.now()
      state.error =
        missing.length > 0
          ? `CoinGecko did not recognize: ${missing.join(', ')}. Use CoinGecko ids such as bitcoin or ethereum.`
          : null
    } catch (cause) {
      if (generation !== state.generation) return status()
      state.error = cause instanceof Error ? cause.message : String(cause)
    } finally {
      if (generation === state.generation) {
        state.checking = false
        state.pending = null
      }
    }
    return status()
  })()

  state.pending = task
  return task
}

export async function setMarketWatchlist(input: unknown): Promise<MarketStatus> {
  const ids = validateIds(input)
  await loadWatchlist()

  state.generation += 1
  state.pending = null
  state.checking = false
  state.watchlist = ids
  state.coins = []
  state.error = null
  await persistWatchlist()
  return refreshMarkets()
}

interface CachedSeries {
  series: MarketSeries
  expires: number
}

const seriesCache = new Map<string, CachedSeries>()
const seriesPending = new Map<string, Promise<MarketSeries>>()

function validateSeriesArgs(id: unknown, days: unknown): { id: string; days: MarketRange } {
  const coinId = typeof id === 'string' ? id.trim().toLowerCase() : ''
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(coinId)) {
    throw new Error('Use a CoinGecko coin id such as bitcoin or ethereum.')
  }
  if (typeof days !== 'number' || !SERIES_RANGES.includes(days as MarketRange)) {
    throw new Error('Choose a 1, 3 or 6 month range.')
  }
  return { id: coinId, days: days as MarketRange }
}

function downsample(points: MarketSeriesPoint[]): MarketSeriesPoint[] {
  if (points.length <= SERIES_MAX_POINTS) return points

  const sampled: MarketSeriesPoint[] = []
  const step = (points.length - 1) / (SERIES_MAX_POINTS - 1)
  for (let index = 0; index < SERIES_MAX_POINTS; index += 1) {
    sampled.push(points[Math.round(index * step)])
  }
  sampled[sampled.length - 1] = points[points.length - 1]
  return sampled
}

function pruneSeriesCache(now: number): void {
  for (const [key, entry] of seriesCache) {
    if (entry.expires <= now) seriesCache.delete(key)
  }
  while (seriesCache.size > SERIES_MAX_CACHE) {
    const oldest = seriesCache.keys().next().value
    if (typeof oldest !== 'string') break
    seriesCache.delete(oldest)
  }
}

async function fetchSeries(id: string, days: MarketRange): Promise<MarketSeries> {
  const url = new URL(`${SERIES_URL}/${encodeURIComponent(id)}/market_chart`)
  url.searchParams.set('vs_currency', 'usd')
  url.searchParams.set('days', String(days))

  let response: Response
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
    })
  } catch (cause) {
    throw new Error(
      cause instanceof Error && cause.name === 'TimeoutError'
        ? 'CoinGecko did not respond in time. Try again.'
        : 'Could not reach CoinGecko. Check your internet connection.'
    )
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('CoinGecko rate limit reached. Wait a minute, then try again.')
    }
    if (response.status === 404) {
      throw new Error('CoinGecko did not recognize that coin id.')
    }
    throw new Error(`CoinGecko returned HTTP ${response.status}.`)
  }

  const data: unknown = await response.json()
  const raw = (data as { prices?: unknown })?.prices
  if (!Array.isArray(raw)) throw new Error('CoinGecko returned an unexpected response.')

  const points: MarketSeriesPoint[] = []
  for (const entry of raw) {
    if (!Array.isArray(entry)) continue
    const [t, p] = entry
    if (typeof t !== 'number' || typeof p !== 'number' || !Number.isFinite(p)) continue
    points.push({ t, p })
  }
  if (points.length < 2) {
    throw new Error('CoinGecko returned no usable price history for this coin.')
  }
  points.sort((a, b) => a.t - b.t)

  const first = points[0].p
  const last = points[points.length - 1].p
  let high = points[0].p
  let low = points[0].p
  for (const point of points) {
    if (point.p > high) high = point.p
    if (point.p < low) low = point.p
  }

  return {
    id,
    days,
    points: downsample(points),
    change: first > 0 ? ((last - first) / first) * 100 : null,
    high,
    low,
    fetchedAt: Date.now()
  }
}

export async function getMarketSeries(id: unknown, days: unknown): Promise<MarketSeries> {
  const args = validateSeriesArgs(id, days)
  const key = `${args.id}:${args.days}`
  const now = Date.now()

  const cached = seriesCache.get(key)
  if (cached && cached.expires > now) return cached.series
  if (cached) seriesCache.delete(key)

  const pending = seriesPending.get(key)
  if (pending) return pending

  const task = (async () => {
    try {
      const series = await fetchSeries(args.id, args.days)
      const savedAt = Date.now()
      seriesCache.set(key, { series, expires: savedAt + SERIES_TTL_MS })
      pruneSeriesCache(savedAt)
      return series
    } finally {
      seriesPending.delete(key)
    }
  })()

  seriesPending.set(key, task)
  return task
}
