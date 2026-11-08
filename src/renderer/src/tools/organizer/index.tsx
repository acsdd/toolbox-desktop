import { useMemo, useState } from 'react'
import type { FileEntry, OrganizeResult } from '@shared/types'
import { Icon } from '../../components/Icon'
import { formatBytes } from '../../lib/format'
import type { ToolDefinition } from '../types'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function OrganizerTool() {
  const [folder, setFolder] = useState<string | null>(null)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<OrganizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const files = useMemo(() => entries.filter((entry) => !entry.isDirectory), [entries])
  const folderCount = entries.length - files.length

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const file of files) counts.set(file.category, (counts.get(file.category) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [files])

  const loadFolder = async (target: string) => {
    setBusy(true)
    setError(null)
    try {
      setEntries(await window.api.files.list(target))
    } catch (cause) {
      setEntries([])
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const chooseFolder = async () => {
    setBusy(true)
    setError(null)
    try {
      const chosen = await window.api.files.pickFolder()
      if (!chosen) return
      setFolder(chosen)
      setResult(null)
      setConfirming(false)
      setEntries(await window.api.files.list(chosen))
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const organize = async () => {
    if (!folder) return
    setBusy(true)
    setError(null)
    try {
      const summary = await window.api.files.organize(folder)
      setResult(summary)
      setConfirming(false)
      setEntries(await window.api.files.list(folder))
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="organizer-tool">
      <div className="tool-strip">
        <button className="primary-button" onClick={() => void chooseFolder()} disabled={busy}>
          <Icon name="folder" size={16} />
          {folder ? 'Choose another folder' : 'Choose folder'}
        </button>
        {folder && (
          <button
            className="icon-button"
            onClick={() => void loadFolder(folder)}
            disabled={busy}
            title="Refresh file list"
            aria-label="Refresh file list"
          >
            <Icon name="refresh" size={16} />
          </button>
        )}
        {folder && (
          <span className="path-chip" title={folder}>
            {folder}
          </span>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {!folder ? (
        <div className="empty-state compact">
          <Icon name="folder" size={26} />
          <strong>Pick a folder to tame</strong>
          <p>
            Files are sorted into type subfolders — Images, Documents, Video, Archives, and more.
            Existing files are never overwritten; name clashes get a numbered suffix.
          </p>
          <button className="ghost-button" onClick={() => void chooseFolder()} disabled={busy}>
            Choose folder
          </button>
        </div>
      ) : (
        <>
          {result && (
            <div className={`result-banner ${result.errors.length > 0 ? 'warn' : ''}`}>
              Moved <strong>{result.moved}</strong> files into{' '}
              <strong>{result.categories.length}</strong> folders · {result.skipped} folders left
              untouched.
              {result.errors.length > 0 && (
                <ul>
                  {result.errors.slice(0, 3).map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                  {result.errors.length > 3 && <li>…and {result.errors.length - 3} more errors.</li>}
                </ul>
              )}
            </div>
          )}

          <div className="organizer-summary">
            <span>
              <strong>{files.length}</strong> files
            </span>
            <span>
              <strong>{folderCount}</strong> folders untouched
            </span>
            {categoryCounts.map(([name, count]) => (
              <span className="cat-chip" key={name}>
                {name}
                <b>{count}</b>
              </span>
            ))}
          </div>

          <div className="file-table">
            <div className="file-row head">
              <span>Name</span>
              <span>Type</span>
              <span>Size</span>
            </div>
            {entries.slice(0, 200).map((entry) => (
              <div
                key={entry.name}
                className={`file-row ${entry.isDirectory ? 'is-folder' : ''}`}
              >
                <span className="file-name" title={entry.name}>
                  {entry.name}
                </span>
                <span>{entry.isDirectory ? 'Folder' : entry.category}</span>
                <span>{entry.isDirectory ? '—' : formatBytes(entry.size)}</span>
              </div>
            ))}
          </div>

          {entries.length > 200 && (
            <p className="hint">Showing the first 200 of {entries.length} entries.</p>
          )}

          <div className="action-bar">
            {confirming ? (
              <>
                <span>
                  Move {files.length} files into category subfolders inside this folder? This cannot
                  be undone automatically.
                </span>
                <button className="ghost-button" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
                <button
                  className="primary-button danger-button"
                  onClick={() => void organize()}
                  disabled={busy || files.length === 0}
                >
                  Move files
                </button>
              </>
            ) : (
              <button
                className="primary-button"
                onClick={() => setConfirming(true)}
                disabled={busy || files.length === 0}
              >
                <Icon name="check" size={16} />
                Organize by type
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'organizer',
  name: 'File organizer',
  description: 'Tidy a messy folder in one pass: sort files into type subfolders without overwriting anything.',
  icon: 'folder',
  accent: '#f5a524',
  order: 4,
  component: OrganizerTool
}
