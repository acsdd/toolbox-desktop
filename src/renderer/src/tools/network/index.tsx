import { useEffect, useState } from 'react'
import type { DiagnosticCheck, DiagnosticResult } from '@shared/types'
import type { ToolDefinition } from '../types'

type SavedCheck = DiagnosticCheck & { id: string; name: string; last?: DiagnosticResult; previous?: DiagnosticResult; lastGood?: DiagnosticResult }
const KEY = 'toolbox.network-checks'
function readChecks(): SavedCheck[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && ['dns','tcp','http'].includes(item.kind) && typeof item.target === 'string').slice(0,50) : [] } catch { return [] }
}
function NetworkTool() {
  const [checks,setChecks] = useState<SavedCheck[]>(readChecks)
  const [kind,setKind] = useState<DiagnosticCheck['kind']>('tcp')
  const [name,setName] = useState('')
  const [target,setTarget] = useState('')
  const [port,setPort] = useState('')
  const [busy,setBusy] = useState<string | null>(null)
  const [error,setError] = useState('')
  useEffect(() => { try { localStorage.setItem(KEY,JSON.stringify(checks)) } catch { setError('Could not save checks on this device.') } }, [checks])
  function save(next: SavedCheck[]) { setChecks(next) }
  function add() {
    if (!target.trim()) { setError('Enter a host or URL.'); return }
    const parsed = Number(port)
    if (kind === 'tcp' && (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535)) { setError('Enter a port between 1 and 65535.'); return }
    const item: SavedCheck = {id:crypto.randomUUID(), name:name.trim() || target.trim(), kind, target:target.trim(), ...(kind === 'tcp' ? {port:parsed} : {})}
    if (checks.length >= 50) { setError('You can save up to 50 checks.'); return }
    save([...checks,item]); setTarget(''); setName(''); setPort(''); setError('')
  }
  async function run(item: SavedCheck) {
    setBusy(item.id); setError('')
    try { const result = await window.api.diagnostics.run(item); setChecks(previous => previous.map(check=>check.id===item.id ? {...check,previous:check.last,last:result,lastGood:result.ok?result:check.lastGood} : check)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(null) }
  }
  return <div className="diagnostic-tool">
    <p className="diagnostic-intro">Save checks for services you choose. Tests run only when you click Run.</p>
    <div className="diagnostic-form">
      <label>Name <input value={name} maxLength={80} onChange={event=>setName(event.target.value)} placeholder="e.g. Navidrome" /></label>
      <label>Check <select value={kind} onChange={event=>setKind(event.target.value as DiagnosticCheck['kind'])}><option value="tcp">TCP port</option><option value="dns">DNS lookup</option><option value="http">Web endpoint</option></select></label>
      <label>Host or URL <input value={target} maxLength={2048} onChange={event=>setTarget(event.target.value)} placeholder={kind === 'http' ? 'http://nas-01:4533/' : 'nas-01'} /></label>
      {kind === 'tcp' && <label>Port <input type="number" min="1" max="65535" value={port} onChange={event=>setPort(event.target.value)} placeholder="4533" /></label>}
      <button className="primary-button" type="button" onClick={add}>Add check</button>
    </div>
    {error && <p className="error-text" role="alert">{error}</p>}
    {!checks.length && <div className="empty-state compact"><strong>No checks yet</strong><p>Add a service to check its status when you need it.</p></div>}
    <div className="diagnostic-list">{checks.map(item=><article className="diagnostic-row" key={item.id}>
      <div><strong>{item.name}</strong><small>{item.kind.toUpperCase()} · {item.target}{item.port ? `:${item.port}` : ''}</small>
        {item.last && <p role="status" className={item.last.ok ? 'diagnostic-ok' : 'error-text'}>{item.last.ok ? 'Available' : 'Needs attention'} · {item.last.detail} · {item.last.durationMs} ms · {new Date(item.last.checkedAt).toLocaleString()}{item.previous ? ` · previous: ${item.previous.ok ? 'available' : 'unavailable'}` : ''}{!item.last.ok && item.lastGood ? ` · last available: ${new Date(item.lastGood.checkedAt).toLocaleString()}` : ''}</p>}</div>
      <button className="ghost-button small" disabled={busy !== null} onClick={()=>void run(item)}>{busy === item.id ? 'Checking…' : 'Run'}</button>
      <button className="ghost-button small" aria-label={`Remove ${item.name}`} onClick={()=>save(checks.filter(check=>check.id!==item.id))}>Remove</button>
    </article>)}</div>
  </div>
}
export const manifest: ToolDefinition = { id:'network-checks', name:'Network & services', description:'Run saved DNS, port and web checks for the services you choose.', icon:'gauge', accent:'#55c8dd', order:21, component:NetworkTool }
