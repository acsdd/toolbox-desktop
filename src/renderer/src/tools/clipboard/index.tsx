import { useEffect, useMemo, useState } from 'react'
import type { ClipItem } from '@shared/types'
import { Icon } from '../../components/Icon'
import { relativeTime } from '../../lib/format'
import type { ToolDefinition } from '../types'

function ClipboardTool() {
  const [items, setItems] = useState<ClipItem[]>([])
  const [query, setQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        const next = await window.api.clipboard.list()
        if (!cancelled) {
          setItems(next)
          setError(null)
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      }
    }

    void refresh()
    const timer = setInterval(() => void refresh(), 1500)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!copiedId) return
    const timer = setTimeout(() => setCopiedId(null), 1400)
    return () => clearTimeout(timer)
  }, [copiedId])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) => item.text.toLowerCase().includes(needle))
  }, [items, query])

  const copyItem = async (item: ClipItem) => {
    try {
      await window.api.clipboard.copy(item.text)
      setCopiedId(item.id)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const clearHistory = async () => {
    try {
      await window.api.clipboard.clear()
      setItems([])
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <div className="clipboard-tool">
      <div className="tool-strip">
        <div className="search-box">
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter clipboard history"
            spellCheck={false}
          />
        </div>
        <button className="ghost-button" disabled={items.length === 0} onClick={clearHistory}>
          <Icon name="trash" size={15} />
          Clear history
        </button>
      </div>

      <p className="hint">
        Text copied anywhere on Windows appears here. History lives in memory only and clears when
        the app quits. Copies made from the API vault are deliberately excluded.
      </p>

      {error && <p className="error-text">{error}</p>}

      {filtered.length === 0 ? (
        <div className="empty-state compact">
          <Icon name="clipboard" size={24} />
          <strong>{items.length === 0 ? 'Nothing captured yet' : 'No matches'}</strong>
          <p>
            {items.length === 0
              ? 'Copy some text in any Windows app and it will show up here within a second.'
              : 'Try a different search term.'}
          </p>
        </div>
      ) : (
        <div className="clip-list">
          {filtered.map((item) => (
            <button key={item.id} className="clip-item" onClick={() => void copyItem(item)}>
              <span className="clip-text">{item.text}</span>
              <span className="clip-meta">
                <span>{relativeTime(item.at)}</span>
                <span className={`clip-copy ${copiedId === item.id ? 'copied' : ''}`}>
                  {copiedId === item.id ? (
                    <>
                      <Icon name="check" size={14} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Icon name="copy" size={14} />
                      Copy
                    </>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'clipboard',
  name: 'Clipboard history',
  description: 'Search and re-copy anything you copied recently. Captured locally, kept in memory.',
  icon: 'clipboard',
  accent: '#22c39a',
  order: 3,
  component: ClipboardTool
}
