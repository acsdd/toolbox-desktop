import { useEffect, useMemo, useState } from 'react'
import type { InboxSnapshot } from '@shared/widget-files'
import { formatBytes } from '../../lib/format'
import type { ToolDefinition } from '../types'
import '../utility-widgets.css'

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const day = 24 * 60 * 60 * 1000
const pageSize = 40

function DownloadsInbox() {
  const [snapshot, setSnapshot] = useState<InboxSnapshot | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [days, setDays] = useState(0)
  const [limit, setLimit] = useState(pageSize)

  useEffect(() => {
    let alive = true
    // Strict Mode runs effect setup twice in development. Only the live view reads.
    queueMicrotask(async () => {
      if (!alive) return
      try {
        const result = await window.api.downloadsInbox.refresh()
        if (alive) setSnapshot(result)
      } catch (cause) {
        if (alive) setError(String(cause))
      } finally {
        if (alive) setBusy(false)
      }
    })
    return () => { alive = false }
  }, [])

  const categories = useMemo(() => [...new Set(snapshot?.items.map(item => item.category))].sort(), [snapshot])
  const matches = useMemo(() => {
    if (!snapshot) return []
    const search = query.trim().toLocaleLowerCase()
    const cutoff = days ? snapshot.readAt - days * day : -Infinity
    return snapshot.items.filter(item => item.modifiedAt >= cutoff &&
      (!category || item.category === category) && item.name.toLocaleLowerCase().includes(search))
  }, [snapshot, query, category, days])

  async function read(pick: boolean) {
    setBusy(true)
    setError('')
    try {
      const result = await (pick ? window.api.downloadsInbox.pick() : window.api.downloadsInbox.refresh())
      if (result) {
        setSnapshot(result)
        setLimit(pageSize)
        if (!result.items.some(item => item.category === category)) setCategory('')
      }
    } catch (cause) {
      setSnapshot(null)
      setError(String(cause))
    } finally { setBusy(false) }
  }

  async function reveal(name: string) {
    setError('')
    try { await window.api.downloadsInbox.reveal(name) } catch (cause) { setError(String(cause)) }
  }

  return <div className="utility-widget" data-widget="downloads-inbox">
    <section className="utility-panel utility-panel-feature" aria-label="Inbox location">
      <strong className="utility-path">{snapshot?.folder ?? 'Downloads folder'}</strong>
      <div className="utility-actions">
        <button className="primary-button" type="button" disabled={busy} onClick={() => void read(true)}>Choose folder</button>
        <button className="ghost-button" type="button" disabled={busy} onClick={() => void read(false)}>Refresh</button>
      </div>
      {snapshot && <small className="utility-muted">Read {dateTime.format(snapshot.readAt)} · Most recently modified first</small>}
    </section>
    {error && <p className="utility-message" role="alert">{error}</p>}
    <section className="utility-panel" aria-label="Recent files" aria-busy={busy}>
      <div className="utility-filters">
        <label className="utility-field">File name<input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(pageSize) }} /></label>
        <label className="utility-field">Type<select value={category} onChange={event => { setCategory(event.target.value); setLimit(pageSize) }}><option value="">All types</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="utility-field">Modified<select value={days} onChange={event => { setDays(Number(event.target.value)); setLimit(pageSize) }}><option value={0}>Any time</option><option value={1}>Past 24 hours</option><option value={7}>Past 7 days</option><option value={30}>Past 30 days</option></select></label>
      </div>
      <p className="utility-muted" role="status">{busy ? 'Reading files…' : snapshot ? `${matches.length} ${matches.length === 1 ? 'file' : 'files'}${snapshot.partial ? ' in a partial list' : ''}${snapshot.skipped ? ` · ${snapshot.skipped} could not be read` : ''}` : 'Choose a folder or refresh to try again.'}</p>
      {!busy && snapshot && !matches.length && <p>No files match these filters.</p>}
      <ul className="utility-list">
        {matches.slice(0, limit).map(item => <li className="utility-row" key={item.name}>
          <div><strong>{item.name}</strong><small>{formatBytes(item.size)} · {item.category} · {dateTime.format(item.modifiedAt)}</small></div>
          <button className="ghost-button small" type="button" disabled={busy} aria-label={`Reveal ${item.name}`} onClick={() => void reveal(item.name)}>Reveal</button>
        </li>)}
      </ul>
      {matches.length > limit && <div className="utility-actions"><button className="ghost-button" type="button" onClick={() => setLimit(value => value + pageSize)}>Show more files</button></div>}
    </section>
  </div>
}

export const manifest: ToolDefinition = {
  id: 'downloads-inbox', name: 'Downloads Inbox', description: 'Find and reveal recently modified files in Downloads or another folder.',
  icon: 'download', accent: '#70bcef', order: 31, component: DownloadsInbox
}
