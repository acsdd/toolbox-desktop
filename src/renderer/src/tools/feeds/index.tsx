import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { FeedStatus } from '@shared/types'
import { Icon } from '../../components/Icon'
import { relativeTime } from '../../lib/format'
import type { ToolDefinition } from '../types'

const MAX_FEEDS = 8

const SUGGESTIONS = [
  { label: 'Hacker News', url: 'https://hnrss.org/frontpage' },
  { label: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { label: 'GitHub Blog', url: 'https://github.blog/feed/' },
  { label: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' }
]

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function checkedLabel(value: number | null): string {
  if (!value) return 'Not refreshed yet'
  try {
    return `Updated ${relativeTime(value)}`
  } catch {
    return 'Updated recently'
  }
}

function publishedLabel(value: string | null): string {
  if (!value) return ''
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? '' : relativeTime(timestamp)
}

function FeedsTool() {
  const [status, setStatus] = useState<FeedStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    window.api.feeds
      .status()
      .then(async (next) => {
        if (!alive) return
        setStatus(next.feeds.length > 0 ? { ...next, checking: true } : next)
        if (next.feeds.length > 0) {
          const refreshed = await window.api.feeds.refresh().catch(() => null)
          if (alive && refreshed) setStatus(refreshed)
        }
      })
      .catch((cause) => {
        if (alive) setLoadError(errorMessage(cause))
      })

    return () => {
      alive = false
    }
  }, [])

  const run = async (task: () => Promise<FeedStatus>) => {
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

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const target = url.trim()
    if (!target) return
    await run(async () => {
      const next = await window.api.feeds.add(target)
      setUrl('')
      return next
    })
  }

  const addSuggestion = async (target: string) => {
    if (busy) return
    setBusy(true)
    setFormError(null)
    try {
      setStatus(await window.api.feeds.add(target))
    } catch (cause) {
      setFormError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const openItem = async (link: string) => {
    if (!link) return
    try {
      await window.api.feeds.openItem(link)
    } catch (cause) {
      setFormError(errorMessage(cause))
    }
  }

  if (!status) {
    return (
      <div className="linked-tool feeds">
        {loadError ? (
          <p className="error-text">{loadError}</p>
        ) : (
          <p className="hint">
            <Icon name="refresh" size={13} /> Reading your feeds…
          </p>
        )}
      </div>
    )
  }

  const atLimit = status.feeds.length >= MAX_FEEDS
  const addedUrls = new Set(status.feeds.map((feed) => feed.url))

  return (
    <div className="linked-tool feeds">
      {status.feeds.length === 0 ? (
        <div className="linked-intro">
          <span className="linked-intro-icon">
            <Icon name="rss" size={28} />
          </span>
          <div>
            <p className="linked-eyebrow">Feeds · RSS / Atom</p>
            <h2>Headlines without the rabbit hole.</h2>
            <p>
              Follow a handful of sites and read their latest stories from one quiet list. No
              account, no API key, no feed reader service in the middle — Toolbox fetches the feeds
              directly from your PC.
            </p>
          </div>
        </div>
      ) : (
        <div className="linked-summary">
          <div className={`linked-count ${status.items.length > 0 ? 'has-unread' : ''}`}>
            <strong>{status.checking ? '…' : status.items.length}</strong>
            <span>stories</span>
          </div>

          <div className="linked-summary-copy">
            <p className="linked-eyebrow">
              <Icon name="rss" size={13} />
              {status.feeds.length} {status.feeds.length === 1 ? 'feed' : 'feeds'}
            </p>
            <strong>Your reading list</strong>
            <span>{status.checking ? 'Refreshing feeds…' : checkedLabel(status.lastCheck)}</span>
          </div>

          <div className="linked-actions">
            <button
              className="ghost-button small"
              onClick={() => void run(() => window.api.feeds.refresh())}
              disabled={busy}
            >
              <Icon name="refresh" size={13} />
              {busy ? 'Working…' : 'Refresh all'}
            </button>
          </div>
        </div>
      )}

      {(status.error || formError) && <p className="error-text">{status.error || formError}</p>}

      {status.feeds.length > 0 && (
        <div className="linked-feeds">
          {status.feeds.map((feed) => (
            <span
              className={`feed-chip ${feed.error ? 'error' : ''}`}
              key={feed.id}
              title={feed.error ? `${feed.url}\n${feed.error}` : feed.url}
            >
              <span>{feed.title}</span>
              <button
                onClick={() => void run(() => window.api.feeds.remove(feed.id))}
                aria-label={`Remove ${feed.title}`}
                title={`Remove ${feed.title}`}
                disabled={busy}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <form className="linked-form" onSubmit={(event) => void add(event)}>
        <label className="linked-field">
          <span>Feed URL</span>
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/feed.xml"
            spellCheck={false}
            disabled={busy || atLimit}
            required
          />
        </label>
        <button className="primary-button" type="submit" disabled={busy || atLimit}>
          {busy ? 'Fetching…' : 'Add feed'}
        </button>
      </form>

      {atLimit ? (
        <p className="hint">
          <Icon name="rss" size={13} /> You are following the maximum of {MAX_FEEDS} feeds. Remove
          one to add another.
        </p>
      ) : (
        <div className="linked-suggestions">
          <span>Quick add</span>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.url}
              className="chip-button"
              onClick={() => addSuggestion(suggestion.url)}
              disabled={busy || addedUrls.has(suggestion.url)}
              title={suggestion.url}
            >
              {addedUrls.has(suggestion.url) ? `${suggestion.label} ✓` : suggestion.label}
            </button>
          ))}
        </div>
      )}

      {status.feeds.length > 0 && (
        <section className="linked-panel">
          <div className="linked-panel-head">
            <span>Latest stories</span>
            <span>{status.items.length > 0 ? 'Newest first' : ''}</span>
          </div>

          {status.items.length === 0 ? (
            <div className="linked-empty">
              <Icon name="rss" size={22} />
              <span>
                {status.checking ? 'Fetching stories…' : 'No stories yet. Try refreshing.'}
              </span>
            </div>
          ) : (
            <div className="linked-list">
              {status.items.map((item) => (
                <div className="linked-row" key={item.id}>
                  <span className="linked-dot" aria-hidden="true" />
                  <button
                    className="linked-row-main"
                    onClick={() => void openItem(item.link)}
                    disabled={!item.link}
                    title={item.link || item.title}
                  >
                    <span className="linked-row-copy">
                      <strong>{item.title}</strong>
                      <span>{item.summary || item.feedTitle}</span>
                    </span>
                  </button>
                  <span className="linked-row-meta">
                    {publishedLabel(item.publishedAt) || item.feedTitle}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="linked-help">
        <strong>How feeds work here</strong>
        <p>
          RSS 2.0, Atom and RSS 1.0 are supported. A feed is fetched only when you add it or press
          refresh — there is no background polling. Local and private network addresses are blocked,
          and each feed is capped at 2 MB.
        </p>
      </div>

      <p className="hint">
        <Icon name="shield" size={13} /> Story links open in your default browser. Toolbox keeps only
        the feed list on this PC.
      </p>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'feeds',
  name: 'RSS reader',
  description: 'Follow sites and read their latest stories in one quiet list.',
  icon: 'rss',
  accent: '#f59e0b',
  order: 3,
  page: 'connected',
  component: FeedsTool
}
