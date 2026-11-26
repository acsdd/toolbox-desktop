import { runDiagnostic } from './diagnostics'
import type { IntegrationStatus } from '../../shared/types'

/** Read-only probes of the local test setup; never access AstrLink's private data. */
export async function integrationStatus(): Promise<IntegrationStatus> {
  const gateway = runDiagnostic({kind:'tcp',target:'127.0.0.1',port:7770})
  let router: IntegrationStatus['router'] = 'unavailable'
  let toolCount: number | null = null
  try {
    const response = await fetch('http://127.0.0.1:18787/health', {redirect:'error',signal:AbortSignal.timeout(3000)})
    if (!response.ok || !response.body) throw new Error('Unavailable')
    router='invalid'
    const reader=response.body.getReader(); const chunks:Uint8Array[]=[]; let size=0
    for (;;) { const part=await reader.read(); if(part.done)break; size+=part.value.length; if(size>16384){await reader.cancel();throw new Error('Oversized health response')} chunks.push(part.value) }
    const data:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!data || typeof data !== 'object') router='invalid'
    else {
      const status=data as {service?:unknown;mode?:unknown;ok?:unknown;mcp?:{ready?:unknown;toolCount?:unknown}}
      if (status.service !== 'toolbox-router' || !['mock','bridge'].includes(String(status.mode))) router='invalid'
      else if(status.mode==='mock') router='mock'
      else {
        if(Number.isSafeInteger(status.mcp?.toolCount) && Number(status.mcp?.toolCount)>=0) toolCount=Number(status.mcp?.toolCount)
        router=status.ok===true && status.mcp?.ready===true && toolCount!==null && toolCount>0 ? 'ready' : 'degraded'
      }
    }
  } catch { /* Unavailable is distinct from a reported unhealthy bridge. */ }
  return {gatewayReachable:(await gateway).ok,router,toolCount,checkedAt:Date.now()}
}
