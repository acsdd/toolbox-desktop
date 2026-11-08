import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { MarketCoin, MarketStatus } from '../../shared/types'

const API_URL = 'https://api.coingecko.com/api/v3/coins/markets'
const MAX_COINS = 8
const REQUEST_TIMEOUT_MS = 15000
const USER_AGENT = 'Toolbox/0.9.0'
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
