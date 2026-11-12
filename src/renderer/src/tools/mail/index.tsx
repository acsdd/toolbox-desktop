import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { MailStatus } from '@shared/types'
import { Icon } from '../../components/Icon'
import type { ToolDefinition } from '../types'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function timeLabel(value: number | null): string {
  if (!value) return 'Not checked yet'
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    }).format(value)
  } catch {
    return new Date(value).toLocaleTimeString()
  }
}

function messageDate(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const today = new Date().toDateString() === date.toDateString()
  try {
    return new Intl.DateTimeFormat(undefined, {
      ...(today
        ? { hour: '2-digit', minute: '2-digit' }
        : { month: 'short', day: 'numeric' })
    }).format(date)
  } catch {
    return date.toLocaleDateString()
  }
}

function MailTool() {
  const [status, setStatus] = useState<MailStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let alive = true

    window.api.mail
      .status()
      .then((next) => {
        if (alive) setStatus(next)
      })
      .catch((cause) => {
        if (alive) setLoadError(errorMessage(cause))
      })

    const unsubscribe = window.api.mail.onUpdate((next) => {
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
      const next = await window.api.mail.connect({ email, password })
      setStatus(next)
      setPassword('')
    } catch (cause) {
      setFormError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const check = async () => {
    setBusy(true)
    setFormError(null)
    try {
      setStatus(await window.api.mail.check())
    } catch (cause) {
      setFormError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    setFormError(null)
    try {
      setStatus(await window.api.mail.disconnect())
      setConfirming(false)
    } catch (cause) {
      setFormError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const toggleNotifications = async () => {
    if (!status) return
    setBusy(true)
    setFormError(null)
    try {
      setStatus(await window.api.mail.setNotifications(!status.notifications))
    } catch (cause) {
      setFormError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  if (!status) {
    return (
      <div className="mail-tool">
        {loadError ? (
          <p className="error-text">{loadError}</p>
        ) : (
          <p className="hint">
            <Icon name="refresh" size={13} /> Reading Gmail status…
          </p>
        )}
      </div>
    )
  }

  if (!status.configured) {
    return (
      <div className="mail-tool">
        <div className="mail-intro">
          <span className="mail-intro-icon">
            <Icon name="mail" size={30} />
          </span>
          <div>
            <p className="mail-eyebrow">Gmail · IMAP</p>
            <h2>Know when mail arrives.</h2>
            <p>
              Toolbox checks your inbox every two minutes and can raise a Windows notification for
              new unread mail. Your App Password is encrypted on this PC and sent to Gmail over
              TLS only to sign in for read-only IMAP access.
            </p>
          </div>
        </div>

        <form className="mail-form" onSubmit={(event) => void connect(event)}>
          <label className="mail-field">
            <span>Gmail address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@gmail.com"
              autoComplete="username"
              spellCheck={false}
              required
            />
          </label>

          <label className="mail-field">
            <span>App Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="16-character App Password"
              autoComplete="current-password"
              spellCheck={false}
              required
            />
          </label>

          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Connecting to Gmail…' : 'Connect Gmail'}
          </button>
        </form>

        {(formError || status.error) && <p className="error-text">{formError || status.error}</p>}

        <div className="mail-help">
          <strong>How to create an App Password</strong>
          <ol>
            <li>Enable IMAP in Gmail → Settings → Forwarding and POP/IMAP.</li>
            <li>Turn on 2-Step Verification in your Google Account.</li>
            <li>
              Open <code>myaccount.google.com/apppasswords</code>, create a password named
              “Toolbox”, and paste it above. Spaces in the password are ignored.
            </li>
          </ol>
          <p>
            Toolbox reads Gmail over IMAP using a read-only INBOX connection. Only message headers
            (sender, subject, date) are fetched — message bodies stay in your inbox.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mail-tool">
      <div className="mail-summary">
        <div className={`mail-count ${status.unread > 0 ? 'has-unread' : ''}`}>
          <strong>{status.checking ? '…' : status.unread}</strong>
          <span>unread</span>
        </div>

        <div className="mail-summary-copy">
          <p className="mail-eyebrow">
            <Icon name="mail" size={13} />
            {status.email}
          </p>
          <strong>{status.connected ? 'Inbox connected' : 'Inbox needs attention'}</strong>
          <span>
            {status.checking
              ? 'Checking Gmail…'
              : status.lastCheck
                ? `Last checked at ${timeLabel(status.lastCheck)}`
                : 'Waiting for the first check'}
          </span>
        </div>

        <div className="mail-actions">
          <button className="ghost-button small" onClick={() => void check()} disabled={busy}>
            <Icon name="refresh" size={13} />
            {busy ? 'Working…' : 'Check now'}
          </button>
          {confirming ? (
            <>
              <button
                className="ghost-button small danger"
                onClick={() => void disconnect()}
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

      <div className="mail-toggle-row">
        <div>
          <strong>Desktop alerts</strong>
          <span>Show a Windows notification when new unread mail arrives.</span>
        </div>
        <button
          role="switch"
          aria-checked={status.notifications}
          aria-label="Desktop mail alerts"
          className={`switch ${status.notifications ? 'on' : ''}`}
          onClick={() => void toggleNotifications()}
          disabled={busy}
        >
          <span className="switch-knob" />
        </button>
      </div>

      <section className="mail-inbox">
        <div className="mail-inbox-head">
          <span>Latest in your inbox</span>
          <span>{status.messages.length > 0 ? 'Newest first' : ''}</span>
        </div>

        {status.messages.length === 0 ? (
          <div className="mail-empty">
            <Icon name="mail" size={22} />
            <span>No messages in this inbox.</span>
          </div>
        ) : (
          <div className="mail-messages">
            {status.messages.map((message) => (
              <div className={`mail-message ${message.seen ? '' : 'unread'}`} key={message.uid}>
                <span className="mail-dot" aria-hidden="true" />
                <div className="mail-message-copy">
                  <strong>{message.from}</strong>
                  <span>{message.subject}</span>
                </div>
                <span className="mail-message-date">{messageDate(message.date)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="hint">
        <Icon name="shield" size={13} /> The App Password is stored with Windows encryption and is
        never shown again. Toolbox only reads headers from your INBOX every two minutes while the
        app is running.
      </p>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'gmail',
  name: 'Gmail announcer',
  description: 'Unread Gmail at a glance, with a desktop alert when new mail arrives.',
  icon: 'mail',
  accent: '#ea4335',
  order: 1,
  page: 'connected',
  component: MailTool
}
