import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { GitHubStatus } from '@shared/types'
import { Icon } from '../../components/Icon'
import { relativeTime } from '../../lib/format'
import type { ToolDefinition } from '../types'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function checkedLabel(value: number | null): string {
  if (!value) return 'Waiting for the first check'
  try {
    return `Last checked at ${new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    }).format(value)}`
  } catch {
    return `Last checked at ${new Date(value).toLocaleTimeString()}`
  }
}

function updatedLabel(value: string): string {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? '' : relativeTime(timestamp)
}

function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    assign: 'assigned',
    author: 'your thread',
    comment: 'comment',
    ci_activity: 'CI activity',
    invitation: 'invitation',
    manual: 'subscribed',
    mention: 'mention',
    review_requested: 'review requested',
    security_alert: 'security alert',
    state_change: 'state change',
    subscribed: 'watching',
    team_mention: 'team mention'
  }
  return map[reason] ?? reason.replace(/_/g, ' ')
}

function GitHubTool() {
  const [status, setStatus] = useState<GitHubStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let alive = true

    window.api.github
      .status()
      .then((next) => {
        if (alive) setStatus(next)
      })
      .catch((cause) => {
        if (alive) setLoadError(errorMessage(cause))
      })

    const unsubscribe = window.api.github.onUpdate((next) => {
      if (alive) setStatus(next)
    })

    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  const connect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      setStatus(await window.api.github.connect({ token }))
      setToken('')
    } catch (cause) {
      setFormError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const run = async (task: () => Promise<GitHubStatus>) => {
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

  const openThread = async (url: string) => {
    try {
      await window.api.github.openThread(url)
    } catch (cause) {
      setFormError(errorMessage(cause))
    }
  }

  if (!status) {
    return (
      <div className="linked-tool github">
        {loadError ? (
          <p className="error-text">{loadError}</p>
        ) : (
          <p className="hint">
            <Icon name="refresh" size={13} /> Reading GitHub status…
          </p>
        )}
      </div>
    )
  }

  if (!status.configured) {
    return (
      <div className="linked-tool github">
        <div className="linked-intro">
          <span className="linked-intro-icon">
            <Icon name="github" size={28} />
          </span>
          <div>
            <p className="linked-eyebrow">GitHub · REST API</p>
            <h2>Your notifications, one click away.</h2>
            <p>
              Follow pull requests, issues, reviews and mentions without opening a browser. Toolbox
              checks your GitHub notifications every three minutes and can raise a Windows alert
              when something new arrives.
            </p>
          </div>
        </div>

        <form className="linked-form" onSubmit={(event) => void connect(event)}>
          <label className="linked-field">
            <span>Personal access token</span>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="ghp_… or github_pat_…"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>

          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Checking token…' : 'Connect GitHub'}
          </button>
        </form>

        {(formError || status.error) && <p className="error-text">{formError || status.error}</p>}

        <div className="linked-help">
          <strong>How to create a token</strong>
          <ol>
            <li>
              Open <code>github.com/settings/tokens</code>.
            </li>
            <li>
              Create a <strong>classic</strong> token with the <code>notifications</code> scope, or a
              fine-grained token with Notifications read access.
            </li>
            <li>Paste the token above. It is encrypted with Windows DPAPI on this PC.</li>
          </ol>
          <p>
            Toolbox reads your notification list and can mark threads as read when you ask. It never
            sees repository contents and the token is never returned to the window after saving.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="linked-tool github">
      <div className="linked-summary">
        <div className={`linked-count ${status.unread > 0 ? 'has-unread' : ''}`}>
          <strong>{status.checking ? '…' : status.unread}</strong>
          <span>unread</span>
        </div>

        <div className="linked-summary-copy">
          <p className="linked-eyebrow">
            <Icon name="github" size={13} />@{status.login}
          </p>
          <strong>{status.connected ? 'GitHub connected' : 'GitHub needs attention'}</strong>
          <span>{status.checking ? 'Checking GitHub…' : checkedLabel(status.lastCheck)}</span>
        </div>

        <div className="linked-actions">
          <button
            className="ghost-button small"
            onClick={() => void run(() => window.api.github.check())}
            disabled={busy}
          >
            <Icon name="refresh" size={13} />
            {busy ? 'Working…' : 'Check now'}
          </button>
          {status.unread > 0 && (
            <button
              className="ghost-button small"
              onClick={() => void run(() => window.api.github.markAllRead())}
              disabled={busy}
            >
              Mark all read
            </button>
          )}
          {confirming ? (
            <>
              <button
                className="ghost-button small danger"
                onClick={() =>
                  void run(async () => {
                    const next = await window.api.github.disconnect()
                    setConfirming(false)
                    return next
                  })
                }
                disabled={busy}
              >
                Confirm disconnect
              </button>
              <button
                className="ghost-button small"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </>
          ) : (
            <button className="ghost-button small" onClick={() => setConfirming(true)}>
              Disconnect
            </button>
          )}
        </div>
      </div>

      {(status.error || formError) && <p className="error-text">{status.error || formError}</p>}

      <div className="linked-toggle-row">
        <div>
          <strong>Desktop alerts</strong>
          <span>Show a Windows notification when a new GitHub thread arrives.</span>
        </div>
        <button
          role="switch"
          aria-checked={status.notifications}
          aria-label="Desktop GitHub alerts"
          className={`switch ${status.notifications ? 'on' : ''}`}
          onClick={() => void run(() => window.api.github.setNotifications(!status.notifications))}
          disabled={busy}
        >
          <span className="switch-knob" />
        </button>
      </div>

      <section className="linked-panel">
        <div className="linked-panel-head">
          <span>Notifications</span>
          <span>{status.threads.length > 0 ? 'Newest first' : ''}</span>
        </div>

        {status.threads.length === 0 ? (
          <div className="linked-empty">
            <Icon name="github" size={22} />
            <span>Nothing waiting. You are all caught up.</span>
          </div>
        ) : (
          <div className="linked-list">
            {status.threads.map((thread) => (
              <div className="linked-row" key={thread.id}>
                <span className="linked-dot" aria-hidden="true" />
                <button
                  className="linked-row-main"
                  onClick={() => void openThread(thread.url)}
                  title={`Open ${thread.title} on GitHub`}
                >
                  <span className="linked-row-copy">
                    <strong>{thread.title}</strong>
                    <span>
                      {thread.repo} · {thread.type} · {reasonLabel(thread.reason)}
                    </span>
                  </span>
                </button>
                <span className="linked-row-meta">{updatedLabel(thread.updatedAt)}</span>
                <button
                  className="linked-row-button"
                  onClick={() =>
                    void run(() => window.api.github.markRead(thread.id))
                  }
                  disabled={busy}
                  aria-label={`Mark ${thread.title} as read`}
                >
                  Done
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="hint">
        <Icon name="shield" size={13} /> The token is stored with Windows encryption and is never
        shown again. Click a notification to open it on GitHub, or mark it done to remove it from
        this list.
      </p>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'github',
  name: 'GitHub notifier',
  description: 'Pull requests, reviews and mentions from GitHub, with desktop alerts.',
  icon: 'github',
  accent: '#a78bfa',
  order: 2,
  page: 'connected',
  component: GitHubTool
}
