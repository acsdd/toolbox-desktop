import { useEffect, useRef, useState } from 'react'
import type { FormEvent, MouseEvent as ReactMouseEvent } from 'react'
import type { VaultEntry } from '@shared/types'
import { Icon } from '../../components/Icon'
import { relativeTime } from '../../lib/format'
import type { ToolDefinition } from '../types'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function VaultTool() {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const load = async () => {
    try {
      setEntries(await window.api.vault.list())
      setError(null)
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!copiedId) return
    const timer = setTimeout(() => setCopiedId(null), 1600)
    return () => clearTimeout(timer)
  }, [copiedId])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3200)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!menu) return

    const close = () => setMenu(null)
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      close()
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)

    const focusTimer = setTimeout(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('.vault-menu-item')?.focus()
    }, 0)

    return () => {
      clearTimeout(focusTimer)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
    }
  }, [menu])

  const resetForm = () => {
    setName('')
    setValue('')
    setNotes('')
  }

  const addSecret = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim() || !value) return

    setBusy(true)
    setError(null)
    try {
      await window.api.vault.add({ name, value, notes })
      resetForm()
      setFormOpen(false)
      setNotice('Secret saved and encrypted.')
      await load()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const copySecret = async (id: string, label?: string) => {
    try {
      await window.api.vault.copy(id)
      setCopiedId(id)
      setError(null)
      if (label) setNotice(`Copied "${label}" to the clipboard.`)
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  const openSecretMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (entries.length === 0) {
      setNotice('Add a secret first, then right-click to pick one by name.')
      return
    }

    const width = 290
    const height = Math.min(entries.length * 48 + 64, 380)
    const x = Math.min(Math.max(10, event.clientX), Math.max(10, window.innerWidth - width - 10))
    const y = Math.min(Math.max(10, event.clientY), Math.max(10, window.innerHeight - height - 10))

    setError(null)
    setMenu({ x, y })
  }

  const removeSecret = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      await window.api.vault.remove(id)
      setConfirmId(null)
      setNotice('Secret deleted.')
      await load()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="vault-tool" onContextMenu={openSecretMenu}>
      <div className="tool-strip">
        <button
          className="primary-button"
          onClick={() => {
            setFormOpen((open) => !open)
            setError(null)
          }}
        >
          <Icon name={formOpen ? 'close' : 'plus'} size={16} />
          {formOpen ? 'Cancel' : 'Add secret'}
        </button>
        <span className="vault-count">
          {entries.length} {entries.length === 1 ? 'secret' : 'secrets'} stored
        </span>
        <span className="vault-badge">
          <Icon name="key" size={13} />
          Windows DPAPI encrypted
        </span>
      </div>

      <p className="hint">
        Values are encrypted for your Windows account and are never displayed again. Copying from
        the vault is excluded from clipboard history. The vault file is local to this PC.
        Right-click anywhere in this panel to pick a secret by name.
      </p>

      {error && <p className="error-text">{error}</p>}
      {notice && <div className="result-banner">{notice}</div>}

      {formOpen && (
        <form className="vault-form" onSubmit={(event) => void addSecret(event)}>
          <div className="field-row">
            <label>
              Name
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. OpenAI API key"
                maxLength={80}
                spellCheck={false}
              />
            </label>
            <label>
              Notes (optional)
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Project or environment"
                maxLength={500}
                spellCheck={false}
              />
            </label>
          </div>

          <label>
            Secret value
            <input
              type="password"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Paste the key or token"
              autoComplete="new-password"
              spellCheck={false}
            />
          </label>

          <div className="form-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setFormOpen(false)
                resetForm()
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={busy || !name.trim() || !value}
            >
              Save secret
            </button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <div className="empty-state compact">
          <Icon name="key" size={26} />
          <strong>Your vault is empty</strong>
          <p>
            Add API keys, tokens, or connection strings. They are encrypted at rest with Windows
            DPAPI and copied on demand.
          </p>
          {!formOpen && (
            <button className="ghost-button" onClick={() => setFormOpen(true)}>
              Add your first secret
            </button>
          )}
        </div>
      ) : (
        <div className="vault-list">
          {entries.map((entry) => (
            <div className="vault-row" key={entry.id}>
              <span className="vault-key">
                <Icon name="key" size={17} />
              </span>

              <div className="vault-copy">
                <strong>{entry.name}</strong>
                <span>
                  {entry.notes || 'No notes'} · updated {relativeTime(entry.updatedAt)}
                </span>
              </div>

              <div className="vault-actions">
                {confirmId === entry.id ? (
                  <>
                    <span className="confirm-text">Delete this secret?</span>
                    <button
                      className="ghost-button small"
                      onClick={() => void removeSecret(entry.id)}
                      disabled={busy}
                    >
                      Yes, delete
                    </button>
                    <button className="ghost-button small" onClick={() => setConfirmId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="ghost-button small"
                      onClick={() => void copySecret(entry.id)}
                    >
                      {copiedId === entry.id ? (
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
                    </button>
                    <button
                      className="icon-button danger"
                      title="Delete secret"
                      aria-label={`Delete ${entry.name}`}
                      onClick={() => setConfirmId(entry.id)}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {menu && (
        <div
          ref={menuRef}
          className="vault-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          aria-label="Copy a secret"
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          <div className="vault-menu-head">
            <span>Copy a secret</span>
            <kbd>Esc</kbd>
          </div>
          <div className="vault-menu-list">
            {entries.map((entry) => (
              <button
                key={entry.id}
                className="vault-menu-item"
                role="menuitem"
                onClick={() => {
                  setMenu(null)
                  void copySecret(entry.id, entry.name)
                }}
              >
                <Icon name="key" size={14} />
                <span className="vault-menu-copy">
                  <strong>{entry.name}</strong>
                  {entry.notes && <span>{entry.notes}</span>}
                </span>
                <Icon name="copy" size={13} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'vault',
  name: 'API vault',
  description: 'Keep API keys and tokens encrypted on this PC. Copy on demand, never shown in the UI.',
  icon: 'key',
  accent: '#a78bfa',
  order: 2,
  component: VaultTool
}
