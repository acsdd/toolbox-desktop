import { useState } from 'react'
import type { IntegrationStatus } from '@shared/types'
import type { ToolDefinition } from '../types'

function IntegrationTool() {
  const [status,setStatus]=useState<IntegrationStatus|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function check(){setBusy(true);setError('');try{setStatus(await window.api.integration.status())}catch{setStatus(null);setError('Could not check the local setup.')}finally{setBusy(false)}}
  const routerLabel = status?.router==='ready' ? `Ready · ${status.toolCount} MCP tools available` : status?.router==='mock' ? 'Mock mode · no live model or MCP bridge' : status?.router==='degraded' ? 'Running · MCP bridge is not ready' : status?.router==='invalid' ? 'Unexpected response on the Router port' : 'Not detected on the default port'
  return <div className="diagnostic-tool">
    <p className="diagnostic-intro">Check the local Qoder, Router, Toolbox MCP and AstrLink setup. This view does not read credentials or send model requests.</p>
    <button className="primary-button" disabled={busy} onClick={()=>void check()}>{busy?'Checking…':'Check local setup'}</button>
    {error && <p className="error-text" role="alert">{error}</p>}
    {status && <div className="diagnostic-list" aria-live="polite">
      <article className="diagnostic-row"><div><strong>Toolbox Router & MCP</strong><small>{routerLabel}</small></div></article>
      <article className="diagnostic-row"><div><strong>AstrLink gateway</strong><small>{status.gatewayReachable?'Port reachable · provider and sign-in not checked':'Not reachable on the default port'}</small></div></article>
      <p className="hint">Checked {new Date(status.checkedAt).toLocaleTimeString()} · default local ports 18787 and 7770</p>
    </div>}
    <h2>Connect Qoder</h2>
    <p>In Qoder, choose an OpenAI-compatible provider and use <strong>http://127.0.0.1:18787/v1</strong>, the Router API key, and a model offered by Router. Start AstrLink and Router in bridge mode first.</p>
    <p className="hint">A reachable gateway does not guarantee that its provider is authenticated or that a model request will succeed. Custom host or port settings are not checked here.</p>
  </div>
}
export const manifest:ToolDefinition={id:'integration',name:'Toolbox connections',description:'Check the local Router, MCP and AstrLink connection for Qoder.',icon:'gauge',accent:'#80b8ff',order:20,component:IntegrationTool}
