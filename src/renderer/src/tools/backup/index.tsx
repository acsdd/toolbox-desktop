import { useCallback, useEffect, useState } from 'react'
import type { BackupLocation, BackupPreview } from '@shared/types'
import { Icon } from '../../components/Icon'
import { formatBytes } from '../../lib/format'
import { BACKUP_DIR_KEY, applyBackupConfig, readBackupConfig } from '../../lib/preferences'
import type { ToolDefinition } from '../types'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function fileNameOf(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

function formatDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(timestamp)
  } catch {
    return new Date(timestamp).toLocaleString()
  }
}

function BackupTool() {
  const [locations, setLocations] = useState<BackupLocation[]>([])
  const [destination, setDestination] = useState(
    () => localStorage.getItem(BACKUP_DIR_KEY) ?? ''
  )
  const [backups, setBackups] = useState<BackupPreview[]>([])
  const [secretCount, setSecretCount] = useState<number | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState<'create' | 'restore' | 'folder' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [restoreFile, setRestoreFile] = useState<string | null>(null)
  const [restorePassword, setRestorePassword] = useState('')
  const [confirmRestore, setConfirmRestore] = useState(false)

  const refresh = useCallback(async (directory: string) => {
    if (!directory) {
      setBackups([])
      return
    }
    try {
      setBackups(await window.api.backup.list(directory))
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const [found, secrets] = await Promise.all([
          window.api.backup.locations(),
          window.api.vault.list()
        ])
        if (cancelled) return
        setLocations(found)
        setSecretCount(secrets.length)

        if (!localStorage.getItem(BACKUP_DIR_KEY) && found[0]) {
          setDestination(found[0].path)
          localStorage.setItem(BACKUP_DIR_KEY, found[0].path)
        }
      } catch (cause) {
        if (!cancelled) setError(errorMessage(cause))
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void refresh(destination)
  }, [destination, refresh])

  const selectDestination = (path: string) => {
    setDestination(path)
    localStorage.setItem(BACKUP_DIR_KEY, path)
    setRestoreFile(null)
    setRestorePassword('')
    setConfirmRestore(false)
  }

  const chooseFolder = async () => {
    setBusy('folder')
    setError(null)
    try {
      const picked = await window.api.backup.pickFolder()
      if (picked) selectDestination(picked)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(null)
    }
  }

  const openFolder = async () => {
    try {
      await window.api.backup.openFolder(destination)
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  const createBackup = async () => {
    if (!destination) {
      setError('Choose a backup folder first.')
      return
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for the backup password.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setBusy('create')
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.backup.create({
        destination,
        password,
        config: readBackupConfig()
      })
      setPassword('')
      setConfirmPassword('')
      setNotice(
        `Encrypted backup saved: ${result.fileName} · ${formatBytes(result.size)} · ${result.secretCount} ${
          result.secretCount === 1 ? 'secret' : 'secrets'
        }.`
      )
      await refresh(destination)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(null)
    }
  }

  const chooseRestoreFile = async () => {
    setBusy('folder')
    setError(null)
    try {
      const picked = await window.api.backup.pickFile()
      if (picked) selectRestoreFile(picked)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(null)
    }
  }

  const selectRestoreFile = (file: string) => {
    setRestoreFile(file)
    setRestorePassword('')
    setConfirmRestore(false)
    setError(null)
  }

  const cancelRestore = () => {
    setRestoreFile(null)
    setRestorePassword('')
    setConfirmRestore(false)
    setError(null)
  }

  const restoreBackup = async () => {
    if (!restoreFile) return
    if (!restorePassword) {
      setError('Enter the backup password.')
      return
    }
    if (!confirmRestore) {
      setConfirmRestore(true)
      return
    }

    setBusy('restore')
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.backup.restore({
        file: restoreFile,
        password: restorePassword
      })
      applyBackupConfig(result.config)
      setSecretCount(result.secretCount)
      setRestoreFile(null)
      setRestorePassword('')
      setConfirmRestore(false)
      setNotice(
        `Restored ${result.secretCount} ${
          result.secretCount === 1 ? 'secret' : 'secrets'
        } and your tool layout from ${result.fileName}.`
      )
      await refresh(destination)
    } catch (cause) {
      setConfirmRestore(false)
      setError(errorMessage(cause))
    } finally {
      setBusy(null)
    }
  }

  const disabled = busy !== null || !destination
  const passwordReady = password.length >= 8 && password === confirmPassword

  return (
    <div className="backup-tool">
      <div className="tool-strip">
        <span className="backup-badge">
          <Icon name="shield" size={13} />
          AES-256-GCM · scrypt
        </span>
        <span className="vault-count">
          {secretCount === null
            ? 'Checking vault…'
            : `${secretCount} ${secretCount === 1 ? 'secret' : 'secrets'} ready to back up`}
        </span>
      </div>

      <p className="hint">
        The `.tbx` file contains your API vault and tool layout, encrypted on this PC before it is
        written. Point the folder at Google Drive, OneDrive, or Dropbox to sync it to your account.
      </p>

      {error && <p className="error-text">{error}</p>}
      {notice && <div className="result-banner">{notice}</div>}

      <section className="backup-panel">
        <div className="backup-panel-head">
          <div>
            <h2>Backup folder</h2>
            <p>Pick where new backups are written. Sync clients keep the encrypted file in step.</p>
          </div>
          <button
            className="ghost-button small"
            onClick={() => void openFolder()}
            disabled={!destination}
          >
            <Icon name="folder" size={14} />
            Open folder
          </button>
        </div>

        {locations.length > 0 && (
          <div className="backup-locations">
            {locations.map((location) => (
              <button
                key={location.path}
                className={`location-chip ${destination === location.path ? 'active' : ''}`}
                onClick={() => selectDestination(location.path)}
                title={location.path}
              >
                <Icon name={location.kind === 'local' ? 'folder' : 'shield'} size={14} />
                {location.label}
              </button>
            ))}
          </div>
        )}

        <div className="backup-path-row">
          <span className="path-chip" title={destination || undefined}>
            {destination || 'No folder selected'}
          </span>
          <button
            className="ghost-button small"
            onClick={() => void chooseFolder()}
            disabled={busy !== null}
          >
            Choose folder…
          </button>
        </div>

        {locations.length <= 1 && (
          <p className="hint">
            No synced drive folder was detected. Install Google Drive, OneDrive, or Dropbox for
            desktop, or pick any folder that your drive client already syncs.
          </p>
        )}
      </section>

      <section className="backup-panel">
        <div className="backup-panel-head">
          <div>
            <h2>Create backup</h2>
            <p>
              Use at least 8 characters. The password is never stored — without it the file cannot
              be opened, even on this PC.
            </p>
          </div>
        </div>

        <div className="backup-fields">
          <label>
            Backup password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              spellCheck={false}
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat the password"
              autoComplete="new-password"
              spellCheck={false}
            />
          </label>
        </div>

        <div className="backup-actions">
          <span className="backup-includes">
            <Icon name="key" size={14} />
            {secretCount ?? 0} vault {secretCount === 1 ? 'secret' : 'secrets'} + tool layout
          </span>
          <button
            className="primary-button"
            onClick={() => void createBackup()}
            disabled={disabled || !passwordReady}
          >
            {busy === 'create' ? 'Encrypting…' : 'Create encrypted backup'}
          </button>
        </div>
      </section>

      <section className="backup-panel">
        <div className="backup-panel-head">
          <div>
            <h2>Restore</h2>
            <p>
              Restoring replaces every secret and resets the tool layout on this PC. The backup file
              stays untouched.
            </p>
          </div>
          <button
            className="ghost-button small"
            onClick={() => void chooseRestoreFile()}
            disabled={busy !== null}
          >
            <Icon name="search" size={14} />
            Choose file…
          </button>
        </div>

        {backups.length === 0 ? (
          <p className="hint">No backups in this folder yet.</p>
        ) : (
          <div className="backup-list">
            {backups.map((item) => (
              <div
                className={`backup-row ${restoreFile === item.file ? 'selected' : ''}`}
                key={item.file}
              >
                <span className="backup-row-icon">
                  <Icon name="shield" size={17} />
                </span>
                <div className="backup-row-copy">
                  <strong>{item.fileName}</strong>
                  <span>
                    {formatDate(item.createdAt)} · {formatBytes(item.size)}
                  </span>
                </div>
                <button
                  className="ghost-button small"
                  onClick={() => selectRestoreFile(item.file)}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}

        {restoreFile && (
          <div className="backup-restore-panel">
            <div className="backup-restore-file">
              <Icon name="shield" size={17} />
              <div>
                <strong>{fileNameOf(restoreFile)}</strong>
                <span>{restoreFile}</span>
              </div>
              <button
                className="icon-button"
                onClick={cancelRestore}
                title="Cancel restore"
                aria-label="Cancel restore"
              >
                <Icon name="close" size={15} />
              </button>
            </div>

            <label>
              Backup password
              <input
                type="password"
                value={restorePassword}
                onChange={(event) => {
                  setRestorePassword(event.target.value)
                  setConfirmRestore(false)
                }}
                placeholder="Password used when the backup was made"
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            {confirmRestore && (
              <div className="result-banner warn">
                This replaces all vault secrets and resets the tool layout on this PC. It cannot be
                undone — a copy of the current vault is kept locally as <code>vault.json.bak</code>.
              </div>
            )}

            <div className="form-actions">
              <button className="ghost-button" onClick={cancelRestore}>
                Cancel
              </button>
              <button
                className={`primary-button ${confirmRestore ? 'danger-button' : ''}`}
                onClick={() => void restoreBackup()}
                disabled={busy !== null || !restorePassword}
              >
                {busy === 'restore'
                  ? 'Restoring…'
                  : confirmRestore
                    ? 'Replace vault and layout'
                    : 'Restore this backup'}
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="backup-note">
        <Icon name="shield" size={16} />
        <p>
          <strong>Portable by design:</strong> secrets are re-encrypted with this PC's Windows DPAPI
          key on restore, so backups move between machines. Only your password can open the file.
        </p>
      </div>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'backup',
  name: 'Encrypted backup',
  description: 'Back up your API vault and tool layout to a synced drive as one encrypted file.',
  icon: 'shield',
  accent: '#38bdf8',
  order: 6,
  component: BackupTool
}
