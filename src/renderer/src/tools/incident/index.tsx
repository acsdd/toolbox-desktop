import { useEffect, useState } from 'react'
import type { ToolDefinition } from '../types'

type Destination={id:string;name:string;email:string}
const DESTINATIONS='toolbox.incident-destinations.v1'
function readDestinations():Destination[]{try{const x=JSON.parse(localStorage.getItem(DESTINATIONS)||'[]');return Array.isArray(x)?x.filter(item=>item&&typeof item.id==='string'&&typeof item.name==='string'&&typeof item.email==='string').slice(0,100):[]}catch{return []}}
function IncidentTool() {
  const [recipient,setRecipient] = useState(() => localStorage.getItem('toolbox.incident-recipient') || '')
  const [destinations,setDestinations]=useState<Destination[]>(readDestinations)
  const [destinationName,setDestinationName]=useState('')
  const [subject,setSubject] = useState('Toolbox incident report')
  const [description,setDescription] = useState('')
  const [includeEvents,setIncludeEvents] = useState(false)
  const [report,setReport] = useState('')
  const [busy,setBusy] = useState(false)
  const [status,setStatus] = useState('')
  const [sender,setSender] = useState('')
  const [confirmSend,setConfirmSend] = useState(false)
  useEffect(() => { let active=true; const update=(value: {configured:boolean;email:string})=>{if(active)setSender(value.configured?value.email:'')};const unsubscribe=window.api.mail.onUpdate(update);window.api.mail.status().then(update).catch(()=>{});return()=>{active=false;unsubscribe()} }, [])
  function rememberDestination(){
    if(!destinationName.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim())){setStatus('Enter a site name and a valid support email.');return}
    if(destinations.length>=100){setStatus('You can save up to 100 support destinations.');return}
    const next=[...destinations,{id:crypto.randomUUID(),name:destinationName.trim().slice(0,100),email:recipient.trim()}];setDestinations(next)
    try{localStorage.setItem(DESTINATIONS,JSON.stringify(next));setDestinationName('');setStatus('Support destination saved on this device.')}catch{setStatus('Could not save the support destination.')}
  }
  function removeDestination(id:string){const next=destinations.filter(item=>item.id!==id);setDestinations(next);try{localStorage.setItem(DESTINATIONS,JSON.stringify(next))}catch{setStatus('Could not save the destination list.')}}
  async function collect() {
    setBusy(true);setStatus('')
    try {
      const snapshot=await window.api.diagnostics.incident(includeEvents)
      setConfirmSend(false);setReport([description.trim() ? `Description:\n${description.trim()}` : 'Description: Please describe the issue.', 'System summary:\n'+snapshot.summary, includeEvents ? 'Recent system errors:\n'+snapshot.events : ''].filter(Boolean).join('\n\n'))
      setStatus('Report ready. Review and remove anything you do not want to share.')
    } catch(cause) { setStatus(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  async function draft() {
    setBusy(true);setStatus('')
    try {
      await window.api.diagnostics.emailDraft({recipient,subject,body:report})
      try { localStorage.setItem('toolbox.incident-recipient',recipient.trim()) } catch {}
      setStatus('Email draft opened. Review it and send it from your email app.')
    } catch(cause) { setStatus(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  async function send() {
    if (!confirmSend) { setConfirmSend(true); return }
    setBusy(true);setStatus('')
    try { const result=await window.api.diagnostics.sendEmail({recipient,subject,body:report});setStatus(`Report accepted for delivery to ${result.recipient}.`);setConfirmSend(false);try{localStorage.setItem('toolbox.incident-recipient',recipient.trim())}catch{} }
    catch(cause) { setStatus(cause instanceof Error ? cause.message : String(cause));setConfirmSend(false) }
    finally { setBusy(false) }
  }
  return <div className="diagnostic-tool">
    <p className="diagnostic-intro">Prepare a report locally, review it, then open an email draft for the support address you choose.</p>
    {destinations.length>0 && <div className="diagnostic-form"><label>Saved support destination<select value="" onChange={event=>{const item=destinations.find(value=>value.id===event.target.value);if(item){setRecipient(item.email);setConfirmSend(false)}}}><option value="">Choose a saved destination</option>{destinations.map(item=><option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</select></label></div>}
    <div className="diagnostic-form">
      <label>Support email <input type="email" maxLength={254} value={recipient} onChange={event=>{setRecipient(event.target.value);setConfirmSend(false)}} placeholder="support@example.com" /></label>
      <label>Subject <input maxLength={150} value={subject} onChange={event=>{setSubject(event.target.value);setConfirmSend(false)}} /></label>
    </div>
    <div className="diagnostic-form"><label>Site name (optional)<input value={destinationName} maxLength={100} onChange={event=>setDestinationName(event.target.value)} placeholder="Save this address for later" /></label><button type="button" className="ghost-button" onClick={rememberDestination}>Save destination</button></div>
    {destinations.length>0 && <details><summary>Manage saved destinations</summary><div className="diagnostic-list">{destinations.map(item=><article className="diagnostic-row" key={item.id}><div><strong>{item.name}</strong><small>{item.email}</small></div><button type="button" className="ghost-button small" aria-label={`Remove ${item.name}`} onClick={()=>removeDestination(item.id)}>Remove</button></article>)}</div></details>}
    <label className="diagnostic-label">What happened? <textarea rows={4} value={description} onChange={event=>setDescription(event.target.value)} placeholder="Describe the problem and when it happened." /></label>
    <label className="diagnostic-check"><input type="checkbox" checked={includeEvents} onChange={event=>setIncludeEvents(event.target.checked)} /> Include recent Windows System errors</label>
    <p className="hint">System errors may contain computer names, usernames, or paths. Review the report before sharing.</p>
    <button type="button" className="ghost-button" disabled={busy} onClick={()=>void collect()}>{busy ? 'Working…' : 'Prepare report'}</button>
    {report && <><label className="diagnostic-label">Report preview <textarea rows={12} value={report} onChange={event=>{setReport(event.target.value);setConfirmSend(false)}} /></label><div className="tool-strip"><button type="button" className="ghost-button" disabled={busy} onClick={()=>void draft()}>Open email draft</button><button type="button" className="primary-button" disabled={busy||!sender} onClick={()=>void send()}>{busy?'Sending…':confirmSend?'Confirm and send':'Send via connected Gmail'}</button></div><p className="hint">{sender ? `Sender: ${sender}` : 'Connect Gmail in Gmail announcer to send directly, or use an email draft.'}</p>{confirmSend && <p className="diagnostic-status">Send the report above to {recipient} from {sender}? Click Confirm and send to proceed.</p>}</>}
    {status && <p role="status" className="diagnostic-status">{status}</p>}
  </div>
}
export const manifest: ToolDefinition = {id:'incident',name:'Incident report',description:'Prepare and review a local diagnostic report for a support email.',icon:'notes',accent:'#ef9a7e',order:22,component:IncidentTool}
