import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { ShortcutItem, ShortcutStatus } from '@shared/types'
import { Icon } from '../../components/Icon'
import type { ToolDefinition } from '../types'

const PRESET_GROUPS = [
  { id: 'assistant', title: 'AI assistants' },
  { id: 'local', title: 'Local AI' },
  { id: 'developer', title: 'Developer tools' }
] as const

const NOTICE_MS = 4000

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function hostOf(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.host || parsed.hostname
  } catch {
    return url
  }
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function LaunchpadTool() {
  const [status, setStatus] = useState<ShortcutStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [manage, setManage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  useEffect(() => {
    let alive = true
    window.api.shortcuts
      .status()
      .then((next) => {
        if (alive) setStatus(next)
      })
      .catch((cause) => {
        if (alive) setLoadError(errorMessage(cause))
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const items = status?.items ?? []
  const enabled = useMemo(() => items.filter((item) => item.enabled), [items])
  const custom = useMemo(() => items.filter((item) => item.custom), [items])
  const installed = useMemo(
    () => enabled.filter((item) => item.installed).length,
    [enabled]
  )

  const run = async (task: () => Promise<ShortcutStatus>) => {
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

  const launch = async (item: ShortcutItem) => {
    setBusy(true)
    setFormError(null)
    try {
      const used = await window.api.shortcuts.open(item.id)
      setNotice(
        used === 'app'
          ? `Opened ${item.name}.`
          : `Opened ${hostOf(item.url)} in your default browser.`
      )
    } catch (cause) {
      setFormError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (item: ShortcutItem) =>
    void run(() => window.api.shortcuts.toggle(item.id, !item.enabled))

  const remove = (item: ShortcutItem) =>
    void run(() => window.api.shortcuts.remove(item.id))

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void run(async () => {
      const next = await window.api.shortcuts.add({ name, url })
      setName('')
      setUrl('')
      return next
    })
  }

  const rescan = async () => {
    setScanning(true)
    setFormError(null)
    try {
      setStatus(await window.api.shortcuts.rescan())
    } catch (cause) {
      setFormError(errorMessage(cause))
    } finally {
      setScanning(false)
    }
  }

  if (loadError) {
    return (
      <div className="launchpad">
        <p className="error-text">{loadError}</p>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="launchpad">
        <p className="hint">
          <Icon name="refresh" size={13} /> Reading your shortcuts…
        </p>
      </div>
    )
  }

  return (
    <div className="launchpad">
      <div className="tool-strip launchpad-strip">
        <div className="launchpad-summary">
          <strong>
            {enabled.length} shortcut{enabled.length === 1 ? '' : 's'}
            {installed > 0 ? ` · ${installed} app${installed === 1 ? '' : 's'} detected` : ''}
          </strong>
          <span>Click a tile to launch the desktop app or open the site.</span>
        </div>
        <button
          className={`ghost-button ${manage ? 'active' : ''}`}
          onClick={() => setManage((value) => !value)}
          aria-expanded={manage}
        >
          <Icon name={manage ? 'check' : 'settings'} size={15} />
          {manage ? 'Done' : 'Choose shortcuts'}
        </button>
      </div>

      {(formError || notice) && (
        <div className={`launchpad-notice ${formError ? 'warn' : ''}`}>
          <Icon name={formError ? 'warning' : 'check'} size={14} />
          <span>{formError || notice}</span>
        </div>
      )}

      {enabled.length === 0 ? (
        <div className="empty-state compact">
          <Icon name="rocket" size={26} />
          <strong>No shortcuts on the launchpad</strong>
          <p>Turn on a few presets or add your own link, then they appear here as one-click tiles.</p>
          <button className="ghost-button" onClick={() => setManage(true)}>
            Choose shortcuts
          </button>
        </div>
      ) : (
        <div className="launchpad-grid">
          {enabled.map((item) => (
            <button
              key={item.id}
              className="launchpad-tile"
              onClick={() => void launch(item)}
              disabled={busy}
              title={`${item.name} · ${item.url}`}
            >
              <span className={`launchpad-mark group-${item.group}`}>
                {initials(item.name)}
              </span>
              <span className="launchpad-copy">
                <strong>
                  {item.name}
                  {item.installed && <span className="launchpad-badge">App</span>}
                  {item.custom && <span className="launchpad-badge custom">Link</span>}
                </strong>
                <span>{hostOf(item.url)}</span>
              </span>
              <span className="launchpad-go" aria-hidden="true">
                <Icon name="back" size={15} />
              </span>
            </button>
          ))}
        </div>
      )}

      {manage && (
        <div className="launchpad-manage">
          <div className="launchpad-manage-head">
            <div className="launchpad-manage-copy">
              <strong>Preset shortcuts</strong>
              <span>
                Turn off what you do not use. A green App badge means the desktop client was found
                in your Start Menu.
              </span>
            </div>
            <button
              className="ghost-button small"
              onClick={() => void rescan()}
              disabled={busy || scanning}
            >
              <Icon name="refresh" size={13} />
              {scanning ? 'Scanning…' : 'Rescan apps'}
            </button>
          </div>

          {PRESET_GROUPS.map((group) => {
            const groupItems = items.filter((item) => item.group === group.id)
            const on = groupItems.filter((item) => item.enabled).length
            return (
              <section className="launchpad-group" key={group.id}>
                <div className="launchpad-group-head">
                  <span>{group.title}</span>
                  <span>
                    {on}/{groupItems.length} on
                  </span>
                </div>
                <div className="launchpad-rows">
                  {groupItems.map((item) => (
                    <div className="launchpad-row" key={item.id}>
                      <div className="launchpad-row-copy">
                        <strong>
                          {item.name}
                          {item.installed && <span className="launchpad-badge">App</span>}
                        </strong>
                        <span>{item.hint}</span>
                      </div>
                      <button
                        role="switch"
                        aria-checked={item.enabled}
                        aria-label={`Show ${item.name}`}
                        className={`switch ${item.enabled ? 'on' : ''}`}
                        onClick={() => toggle(item)}
                        disabled={busy}
                      >
                        <span className="switch-knob" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}

          <section className="launchpad-group">
            <div className="launchpad-group-head">
              <span>Your links</span>
              <span>{custom.length} added</span>
            </div>

            {custom.length > 0 && (
              <div className="launchpad-rows">
                {custom.map((item) => (
                  <div className="launchpad-row" key={item.id}>
                    <div className="launchpad-row-copy">
                      <strong>{item.name}</strong>
                      <span>{item.url}</span>
                    </div>
                    <button
                      className="icon-button danger launchpad-remove"
                      onClick={() => void remove(item)}
                      disabled={busy}
                      title={`Remove ${item.name}`}
                      aria-label={`Remove ${item.name}`}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form className="launchpad-add" onSubmit={add}>
              <label className="launchpad-field">
                <span>Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="My workspace"
                  maxLength={48}
                  disabled={busy}
                  required
                />
              </label>
              <label className="launchpad-field">
                <span>Link</span>
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com"
                  spellCheck={false}
                  maxLength={500}
                  disabled={busy}
                  required
                />
              </label>
              <button className="primary-button" type="submit" disabled={busy}>
                <Icon name="plus" size={15} />
                Add
              </button>
            </form>
            <p className="hint">
              http is allowed for local servers, for example http://localhost:3000. Links are
              stored as plain text in your Toolbox data folder.
            </p>
          </section>
        </div>
      )}

      <div className="linked-help">
        <strong>How launching works</strong>
        <p>
          Toolbox checks both Start Menu folders for the desktop clients you already installed and
          launches them directly. Everything else opens in your default browser. Only the names and
          links you add are stored on this PC — no account, no telemetry.
        </p>
      </div>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'launchpad',
  name: 'AI launchpad',
  description: 'One-click tiles for AI apps, local models, GitHub, Copilot and your own links.',
  icon: 'rocket',
  accent: '#8b5cf6',
  order: 8,
  component: LaunchpadTool
}
