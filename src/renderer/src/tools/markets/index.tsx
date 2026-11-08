import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { MarketStatus } from '@shared/types'
import { Icon } from '../../components/Icon'
import { relativeTime } from '../../lib/format'
import type { ToolDefinition } from '../types'

const MAX_COINS = 8
const POPULAR = [
  { id: 'bitcoin', label: 'Bitcoin' },
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'solana', label: 'Solana' },
  { id: 'cardano', label: 'Cardano' },
  { id: 'dogecoin', label: 'Dogecoin' },
  { id: 'chainlink', label: 'Chainlink' }
]

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function checkedLabel(value: number | null): string {
  if (!value) return 'Not refreshed yet'
  return `Updated ${relativeTime(value)}`
}

function parseIds(value: string): string[] {
  const ids = value
    .split(/[\s,]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  return [...new Set(ids)]
}

function formatPrice(value: number): string {
  const digits = value >= 1 ? 2 : value >= 0.01 ? 4 : 6
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: digits
    }).format(value)
  } catch {
    return `$${value}`
  }
}

function formatCap(value: number | null): string {
  if (value === null) return ''
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value)
  } catch {
    return ''
  }
}

function changeLabel(value: number | null): string {
  if (value === null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function changeClass(value: number | null): string {
  if (value === null || Math.abs(value) < 0.005) return 'flat'
  return value > 0 ? 'up' : 'down'
}

function MarketsTool() {
  const [status, setStatus] = useState<MarketStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    window.api.markets
      .status()
      .then(async (next) => {
        if (!alive) return
        setStatus({ ...next, checking: true })
        setInput(next.watchlist.join(', '))
        const refreshed = await window.api.markets.refresh().catch(() => null)
        if (alive && refreshed) setStatus(refreshed)
      })
      .catch((cause) => {
        if (alive) setLoadError(errorMessage(cause))
      })

    return () => {
      alive = false
    }
  }, [])

  const run = async (task: () => Promise<MarketStatus>) => {
    setBusy(true)
    setFormError(null)
    try {
      setStatus(await task())
    } catch (cause) {
      setFormError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const ids = parseIds(input)
    if (ids.length === 0) {
      setFormError('Add at least one CoinGecko id, for example bitcoin or ethereum.')
      return
    }
    if (ids.length > MAX_COINS) {
      setFormError(`Watch up to ${MAX_COINS} coins at a time.`)
      return
    }
    await run(async () => {
      const next = await window.api.markets.setWatchlist(ids)
      setInput(next.watchlist.join(', '))
      return next
    })
  }

  const togglePopular = (id: string) => {
    const ids = parseIds(input)
    if (ids.includes(id)) {
      setInput(ids.filter((entry) => entry !== id).join(', '))
      return
    }
    if (ids.length >= MAX_COINS) {
      setFormError(`Watch up to ${MAX_COINS} coins at a time.`)
      return
    }
    setFormError(null)
    setInput([...ids, id].join(', '))
  }

  if (!status) {
    return (
      <div className="linked-tool markets">
        {loadError ? (
          <p className="error-text">{loadError}</p>
        ) : (
          <p className="hint">
            <Icon name="refresh" size={13} /> Reading your watchlist…
          </p>
        )}
      </div>
    )
  }

  const draft = parseIds(input)

  return (
    <div className="linked-tool markets">
      <div className="linked-summary">
        <div className={`linked-count ${status.coins.length > 0 ? 'has-unread' : ''}`}>
          <strong>{status.checking ? '…' : status.coins.length}</strong>
          <span>coins</span>
        </div>

        <div className="linked-summary-copy">
          <p className="linked-eyebrow">
            <Icon name="chart" size={13} />
            Markets · CoinGecko · USD
          </p>
          <strong>{status.checking ? 'Fetching prices…' : 'Crypto watchlist'}</strong>
          <span>{checkedLabel(status.lastCheck)}</span>
        </div>

        <div className="linked-actions">
          <button
            className="ghost-button small"
            onClick={() => void run(() => window.api.markets.refresh())}
            disabled={busy}
          >
            <Icon name="refresh" size={13} />
            {busy ? 'Working…' : 'Refresh prices'}
          </button>
        </div>
      </div>

      {(status.error || formError) && <p className="error-text">{status.error || formError}</p>}

      <form className="linked-form" onSubmit={(event) => void save(event)}>
        <label className="linked-field">
          <span>CoinGecko ids, separated by commas</span>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="bitcoin, ethereum, solana"
            spellCheck={false}
            disabled={busy}
            required
          />
        </label>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save watchlist'}
        </button>
      </form>

      <div className="linked-suggestions">
        <span>Popular</span>
        {POPULAR.map((coin) => (
          <button
            key={coin.id}
            className={`chip-button ${draft.includes(coin.id) ? 'active' : ''}`}
            onClick={() => togglePopular(coin.id)}
            disabled={busy}
            aria-pressed={draft.includes(coin.id)}
            title={`${coin.label} · ${coin.id}`}
          >
            {coin.label}
          </button>
        ))}
      </div>

      <section className="linked-panel">
        <div className="linked-panel-head">
          <span>Watchlist</span>
          <span>{status.coins.length > 0 ? '24h change' : ''}</span>
        </div>

        {status.coins.length === 0 ? (
          <div className="linked-empty">
            <Icon name="chart" size={22} />
            <span>
              {status.checking
                ? 'Fetching prices…'
                : 'No prices yet. Save the watchlist, then refresh.'}
            </span>
          </div>
        ) : (
          <div className="linked-list">
            {status.coins.map((coin) => (
              <div className="linked-row market-row" key={coin.id}>
                <span className="market-symbol">{coin.symbol}</span>
                <span className="market-name">
                  <strong>{coin.name}</strong>
                  <span>
                    {coin.id}
                    {coin.marketCap !== null ? ` · ${formatCap(coin.marketCap)} cap` : ''}
                  </span>
                </span>
                <span className="market-price">{formatPrice(coin.price)}</span>
                <span
                  className={`market-change ${changeClass(coin.change24h)}`}
                  title="Change over the last 24 hours"
                >
                  {changeLabel(coin.change24h)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="linked-help">
        <strong>About this watchlist</strong>
        <p>
          Prices come from the public CoinGecko API in US dollars. Use CoinGecko coin ids such as{' '}
          <code>bitcoin</code>, <code>ethereum</code>, <code>solana</code> or{' '}
          <code>avalanche-2</code>. Up to {MAX_COINS} coins are refreshed when you open this tool or
          press refresh; no API key or account is involved.
        </p>
      </div>

      <p className="hint">
        <Icon name="shield" size={13} /> Only the list of coin ids is stored on this PC. Quotes are
        informational and may be slightly delayed.
      </p>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'markets',
  name: 'Crypto watch',
  description: 'A compact watchlist of crypto prices and 24-hour moves.',
  icon: 'chart',
  accent: '#22c55e',
  order: 4,
  page: 'connected',
  component: MarketsTool
}
