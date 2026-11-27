import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { KitFolder, KitLaunch, KitTarget, WorkspaceKit } from '@shared/workspace-kits'
import type { ShortcutItem } from '@shared/types'
import type { ToolDefinition } from '../types'
import '../utility-widgets.css'

type Draft = { id?: string; name: string; folders: KitFolder[]; shortcutIds: string[] }
const emptyDraft = (): Draft => ({ name: '', folders: [], shortcutIds: [] })

function WorkspaceKits() {
  const [kits, setKits] = useState<WorkspaceKit[]>([])
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [preview, setPreview] = useState<KitTarget[] | null>(null)
  const [launch, setLaunch] = useState<KitLaunch[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shortcutsError, setShortcutsError] = useState(false)
  const selected = kits.find(kit => kit.id === selectedId)

  useEffect(() => {
    let alive = true
    void window.api.workspaceKits.list().then(result => {
      if (!alive) return
      setKits(result)
      setSelectedId(result[0]?.id ?? '')
    }).catch(cause => { if (alive) setError(String(cause)) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!selected || draft) return
    let alive = true
    setPreview(null)
    void window.api.workspaceKits.inspect(selected.id).then(result => {
      if (alive) setPreview(result)
    }).catch(cause => { if (alive) setError(String(cause)) })
    return () => { alive = false }
  }, [selected, draft])

  useEffect(() => {
    if (!draft) return
    let alive = true
    const loadShortcuts = async () => {
      try {
        const result = await window.api.shortcuts.status()
        if (alive) { setShortcuts(result.items); setShortcutsError(false) }
      } catch { if (alive) setShortcutsError(true) }
    }
    void loadShortcuts()
    return () => { alive = false }
  }, [Boolean(draft)])

  function select(id: string) {
    setSelectedId(id)
    if (id !== selectedId) setPreview(null)
    setDraft(null)
    setLaunch(null)
    setConfirmDelete(false)
    setError('')
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try { await action() } catch (cause) { setError(String(cause)) }
    finally { setBusy(false) }
  }

  function pickFolder() {
    return run(async () => {
      const folder = await window.api.workspaceKits.pickFolder()
      if (folder) setDraft(current => current && !current.folders.some(item => item.path === folder.path)
        ? { ...current, folders: [...current.folders, folder] } : current)
    })
  }

  function save(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    void run(async () => {
      const kit = await window.api.workspaceKits.save({ id: draft.id, name: draft.name, folderIds: draft.folders.map(item => item.id), shortcutIds: draft.shortcutIds })
      setKits(current => draft.id ? current.map(item => item.id === kit.id ? kit : item) : [...current, kit])
      select(kit.id)
    })
  }

  function remove() {
    if (!selected) return
    return run(async () => {
      await window.api.workspaceKits.remove(selected.id)
      const remaining = kits.filter(item => item.id !== selected.id)
      setKits(remaining)
      select(remaining[0]?.id ?? '')
    })
  }

  function open() {
    if (!selected) return
    return run(async () => setLaunch(await window.api.workspaceKits.open(selected.id)))
  }

  const targetCount = (draft?.folders.length ?? 0) + (draft?.shortcutIds.length ?? 0)
  const availableShortcuts = shortcuts.filter(item => item.enabled || draft?.shortcutIds.includes(item.id))
  const removedShortcutIds = draft?.shortcutIds.filter(id => !shortcuts.some(item => item.id === id)) ?? []
  function toggleShortcut(id: string, checked: boolean) {
    setDraft(current => current && { ...current, shortcutIds: checked ? [...current.shortcutIds, id] : current.shortcutIds.filter(item => item !== id) })
  }

  return <div className="utility-widget" data-widget="workspace-kits">
    {error && <p className="utility-message" role="alert">{error}</p>}
    <div className="utility-two-columns">
      <section className="utility-panel utility-panel-feature" aria-label="Saved kits" aria-busy={loading}>
        <div className="utility-actions"><button className="primary-button" type="button" disabled={loading || busy} onClick={() => { setError(''); setDraft(emptyDraft()); setLaunch(null); setConfirmDelete(false) }}>New kit</button></div>
        {loading && <p className="utility-muted">Loading workspace kits…</p>}
        {!loading && !kits.length && <p className="utility-muted">Create a kit for folders and shortcuts you open together.</p>}
        {kits.map(kit => <button type="button" className="utility-kit-button" key={kit.id} disabled={busy} aria-pressed={kit.id === selectedId} onClick={() => select(kit.id)}>{kit.name}</button>)}
      </section>
      {draft ? <form className="utility-panel" aria-label={draft.id ? 'Edit workspace kit' : 'Create workspace kit'} onSubmit={save}>
        <label className="utility-field">Kit name<input required maxLength={80} value={draft.name} onChange={event => setDraft(current => current && { ...current, name: event.target.value })} /></label>
        <h3>Folders</h3>
        <ul className="utility-list">
          {draft.folders.map(folder => <li className="utility-row" key={folder.id}>
            <div>{folder.path}</div>
            <button className="ghost-button small" type="button" disabled={busy} aria-label={`Remove ${folder.path}`} onClick={() => setDraft(current => current && { ...current, folders: current.folders.filter(item => item.id !== folder.id) })}>Remove</button>
          </li>)}
        </ul>
        <div className="utility-actions"><button className="ghost-button" type="button" disabled={busy || targetCount >= 12} onClick={() => void pickFolder()}>Add folder</button></div>
        <h3>AI launchpad shortcuts</h3>
        {shortcutsError && <p className="utility-muted">Could not load AI launchpad shortcuts.</p>}
        {!shortcutsError && !availableShortcuts.length && <p className="utility-muted">Enable a shortcut in AI launchpad to find it here.</p>}
        {(availableShortcuts.length > 0 || removedShortcutIds.length > 0) && <div className="utility-choice-list">
          {availableShortcuts.map(item => <label className="utility-check" key={item.id}>
            <input type="checkbox" disabled={busy || (!draft.shortcutIds.includes(item.id) && (!item.enabled || targetCount >= 12))} checked={draft.shortcutIds.includes(item.id)} onChange={event => toggleShortcut(item.id, event.target.checked)} />
            {item.name}{!item.enabled && ' (disabled)'}
          </label>)}
          {removedShortcutIds.map(id => <label className="utility-check" key={id}><input type="checkbox" disabled={busy} checked onChange={() => toggleShortcut(id, false)} />{id} (unavailable)</label>)}
        </div>}
        <div className="utility-actions">
          <button className="primary-button" type="submit" disabled={busy || !draft.name.trim() || !targetCount}>Save kit</button>
          <button className="ghost-button" type="button" disabled={busy} onClick={() => setDraft(null)}>Cancel</button>
        </div>
      </form> : selected && <section className="utility-panel" aria-label="Kit preview">
        <h2>{selected.name}</h2>
        {!preview && <p className="utility-muted">Checking targets…</p>}
        <ul className="utility-list">
          {(launch ?? preview)?.map((item, index) => <li className="utility-row" key={index}>
            <div><strong>{item.label}</strong>{item.issue ? <small>{item.issue}</small> : 'opened' in item ? <small>Opened</small> : null}</div>
          </li>)}
        </ul>
        {launch && <p className="utility-muted" role="status">Opened {launch.filter(item => item.opened).length} of {launch.length} items.</p>}
        {confirmDelete ? <div className="utility-actions">
          <button className="ghost-button" type="button" disabled={busy} onClick={() => void remove()}>Delete this kit</button>
          <button className="ghost-button" type="button" onClick={() => setConfirmDelete(false)}>Keep kit</button>
        </div> : <div className="utility-actions">
          <button className="primary-button" type="button" disabled={busy || !preview?.some(item => !item.issue)} onClick={() => void open()}>Open kit</button>
          <button className="ghost-button" type="button" disabled={busy} onClick={() => { setDraft(selected); setLaunch(null); setError('') }}>Edit kit</button>
          <button className="ghost-button" type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete kit</button>
        </div>}
      </section>}
    </div>
  </div>
}

export const manifest: ToolDefinition = {
  id: 'workspace-kits', name: 'Workspace Kits', description: 'Save a group of folders and AI launchpad shortcuts and open them together.',
  icon: 'grid', accent: '#a79cff', order: 34, component: WorkspaceKits
}
