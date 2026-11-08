import { Fragment, useEffect, useId, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { MarketCoin, MarketRange, MarketSeries, MarketStatus } from '@shared/types'
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
const RANGES: { days: MarketRange; label: string; name: string }[] = [
  { days: 30, label: '1M', name: '1 month' },
  { days: 90, label: '3M', name: '3 months' },
  { days: 180, label: '6M', name: '6 months' }
]
const RANGE_KEY = 'toolbox.markets.range'

function storedRange(): MarketRange {
  try {
    const value = Number(window.localStorage.getItem(RANGE_KEY))
    const match = RANGES.find((range) => range.days === value)
    return match ? match.days : 90
  } catch {
    return 90
  }
}

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

function formatDay(value: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
      new Date(value)
    )
  } catch {
    return ''
  }
}

function rangeName(days: MarketRange): string {
  return RANGES.find((range) => range.days === days)?.name ?? '3 months'
}

interface MarketChartProps {
  coin: MarketCoin
  range: MarketRange
  series: MarketSeries | null
  loading: boolean
  error: string | null
  onRange: (range: MarketRange) => void
  onRetry: () => void
  onClose: () => void
}

function MarketChart({
  coin,
  range,
  series,
  loading,
  error,
  onRange,
  onRetry,
  onClose
}: MarketChartProps) {
  const gradientId = `market-gradient-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const chart = useMemo(() => {
    if (!series || series.points.length < 2) return null

    const width = 640
    const height = 200
    const padX = 4
    const padTop = 12
    const padBottom = 6
    const span = series.high - series.low
    const margin = span > 0 ? span * 0.06 : Math.max(series.high * 0.02, 1)
    const min = series.low - margin
    const max = series.high + margin
    const scale = max - min || 1
    const x = (index: number) =>
      padX + (index / (series.points.length - 1)) * (width - padX * 2)
    const y = (price: number) =>
      padTop + (1 - (price - min) / scale) * (height - padTop - padBottom)
    const line = series.points
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(point.p).toFixed(2)}`
      )
      .join(' ')
    const baseline = height - padBottom
    const area = `${line} L${x(series.points.length - 1).toFixed(2)},${baseline} L${padX},${baseline} Z`
    const last = series.points[series.points.length - 1]

    return {
      width,
      height,
      line,
      area,
      baseline,
      lastX: x(series.points.length - 1),
      lastY: y(last.p)
    }
  }, [series])

  const tone = changeClass(series?.change ?? null)
  const firstDay = series ? formatDay(series.points[0].t) : ''
  const lastDay = series ? formatDay(series.points[series.points.length - 1].t) : ''

  return (
    <div className={`market-chart ${tone}`}>
      <div className="market-chart-head">
        <div className="market-chart-name">
          <strong>
            {coin.name} · {rangeName(range)}
          </strong>
          <span>
            {series ? `${firstDay} – ${lastDay} · ${coin.symbol}/USD` : `${coin.symbol}/USD`}
          </span>
        </div>

        <div className={`market-chart-change ${tone}`}>
          <strong>{loading ? '…' : changeLabel(series?.change ?? null)}</strong>
          <span>{RANGES.find((item) => item.days === range)?.label}</span>
        </div>

        <div className="market-range" role="group" aria-label="Chart range">
          {RANGES.map((item) => (
            <button
              key={item.days}
              type="button"
              className={range === item.days ? 'active' : ''}
              aria-pressed={range === item.days}
              onClick={() => onRange(item.days)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="icon-button market-chart-close"
          onClick={onClose}
          aria-label={`Close ${coin.name} chart`}
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      {error ? (
        <div className="market-chart-status">
          <span className="error-text">{error}</span>
          <button type="button" className="ghost-button small" onClick={onRetry}>
            <Icon name="refresh" size={13} />
            Try again
          </button>
        </div>
      ) : loading || !chart ? (
        <div className="market-chart-status">
          <span>Loading {rangeName(range)} of prices…</span>
        </div>
      ) : (
        <svg
          className="market-chart-svg"
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${coin.name} price over the past ${rangeName(range)}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              className="market-chart-grid"
              x1="0"
              x2={chart.width}
              y1={chart.baseline * ratio}
              y2={chart.baseline * ratio}
            />
          ))}

          <path className="market-chart-area" d={chart.area} fill={`url(#${gradientId})`} />
          <path className="market-chart-line" d={chart.line} />
          <circle className="market-chart-dot" cx={chart.lastX} cy={chart.lastY} r="2.6" />
        </svg>
      )}

      {series && !error && (
        <div className="market-chart-foot">
          <span>
            High {formatPrice(series.high)} · Low {formatPrice(series.low)}
          </span>
          <span>CoinGecko · cached {relativeTime(series.fetchedAt)}</span>
        </div>
      )}
    </div>
  )
}

function MarketsTool() {
  const [status, setStatus] = useState<MarketStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [chartCoin, setChartCoin] = useState<string | null>(null)
  const [chartRange, setChartRange] = useState<MarketRange>(storedRange)
  const [series, setSeries] = useState<MarketSeries | null>(null)
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [seriesError, setSeriesError] = useState<string | null>(null)
  const [seriesReload, setSeriesReload] = useState(0)

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

  useEffect(() => {
    if (!chartCoin) {
      setSeries(null)
      return
    }

    let alive = true
    setSeriesError(null)
    setSeriesLoading(true)

    window.api.markets
      .series(chartCoin, chartRange)
      .then((next) => {
        if (alive) setSeries(next)
      })
      .catch((cause) => {
        if (!alive) return
        setSeries(null)
        setSeriesError(errorMessage(cause))
      })
      .finally(() => {
        if (alive) setSeriesLoading(false)
      })

    return () => {
      alive = false
    }
  }, [chartCoin, chartRange, seriesReload])

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
      setChartCoin(null)
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

  const closeChart = () => {
    setChartCoin(null)
    setSeries(null)
    setSeriesError(null)
    setSeriesLoading(false)
  }

  const toggleChart = (id: string) => {
    if (chartCoin === id) {
      closeChart()
      return
    }
    setSeries(null)
    setSeriesError(null)
    setSeriesLoading(true)
    setChartCoin(id)
  }

  const changeRange = (next: MarketRange) => {
    if (next === chartRange) return
    setSeries(null)
    setSeriesError(null)
    setSeriesLoading(true)
    setChartRange(next)
    try {
      window.localStorage.setItem(RANGE_KEY, String(next))
    } catch {
      // Remembering the range is a nicety; ignore storage failures.
    }
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
          <span>{status.coins.length > 0 ? 'Price · 24h · Chart' : ''}</span>
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
              <Fragment key={coin.id}>
                <div className={`linked-row market-row ${chartCoin === coin.id ? 'active' : ''}`}>
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
                  <button
                    type="button"
                    className={`market-chart-toggle ${chartCoin === coin.id ? 'active' : ''}`}
                    onClick={() => toggleChart(coin.id)}
                    aria-expanded={chartCoin === coin.id}
                    aria-label={`${chartCoin === coin.id ? 'Hide' : 'Show'} ${coin.name} price chart`}
                    title={`${chartCoin === coin.id ? 'Hide' : 'Show'} 1, 3 or 6 month chart`}
                  >
                    <Icon name="chart" size={14} />
                    <span>{chartCoin === coin.id ? 'Hide' : 'Chart'}</span>
                  </button>
                </div>

                {chartCoin === coin.id && (
                  <MarketChart
                    coin={coin}
                    range={chartRange}
                    series={series}
                    loading={seriesLoading}
                    error={seriesError}
                    onRange={changeRange}
                    onRetry={() => setSeriesReload((value) => value + 1)}
                    onClose={closeChart}
                  />
                )}
              </Fragment>
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
          press refresh; no API key or account is involved. Open a chart for 1, 3 or 6 months of
          price history — each chart is cached for 30 minutes.
        </p>
      </div>

      <p className="hint">
        <Icon name="shield" size={13} /> Only the list of coin ids is stored on this PC. Charts
        request the selected coin id only; quotes are informational and may be slightly delayed.
      </p>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'markets',
  name: 'Crypto watch',
  description: 'A compact watchlist with 24-hour moves and 1–6 month price charts.',
  icon: 'chart',
  accent: '#22c55e',
  order: 4,
  page: 'connected',
  component: MarketsTool
}
