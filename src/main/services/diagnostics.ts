import os from 'node:os'
import { lookup } from 'node:dns/promises'
import { connect } from 'node:net'
import { execFile } from 'node:child_process'
import type { DiagnosticCheck, DiagnosticResult, IncidentSnapshot } from '../../shared/types'

const TIMEOUT = 5000
function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}
function timed<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out')), TIMEOUT) })]).finally(() => clearTimeout(timer))
}
function tcp(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect({host, port})
    socket.setTimeout(TIMEOUT)
    socket.once('connect', () => { socket.destroy(); resolve() })
    socket.once('timeout', () => { socket.destroy(); reject(new Error('Timed out')) })
    socket.once('error', error => { socket.destroy(); reject(error) })
  })
}
export async function runDiagnostic(input: unknown): Promise<DiagnosticResult> {
  if (!input || typeof input !== 'object') throw new Error('Choose a check to run.')
  const data = input as Partial<DiagnosticCheck>
  const kind = data.kind
  if (!['dns', 'tcp', 'http'].includes(String(kind))) throw new Error('Unsupported check type.')
  if (typeof data.target !== 'string' || data.target.length > 2048) throw new Error('Enter a valid host or URL.')
  const target = clean(data.target, 2048)
  if (!target) throw new Error('Enter a host or URL.')
  const start = Date.now()
  try {
    let detail = ''
    if (kind === 'dns') {
      if (!/^[a-z0-9.-]+$/i.test(target) || target.length > 253) throw new Error('Enter a hostname without a protocol or path.')
      const result = await timed(lookup(target, { all: true }))
      if (!result.length) throw new Error('No addresses found.')
      detail = result.map(item => item.address).slice(0, 8).join(', ')
    } else if (kind === 'tcp') {
      if (!/^[a-z0-9.:-]+$/i.test(target) || target.length > 253) throw new Error('Enter a host without a protocol or path.')
      const port = Number(data.port)
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Enter a port from 1 to 65535.')
      await tcp(target, port); detail = `Port ${port} accepted a connection.`
    } else {
      const url = new URL(target)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP or HTTPS URL without credentials.')
      const response = await fetch(url, {method:'HEAD', redirect:'manual', signal:AbortSignal.timeout(TIMEOUT)})
      detail = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
      if (response.status >= 400) throw new Error(detail)
    }
    return {ok:true, detail, durationMs:Date.now()-start, checkedAt:Date.now()}
  } catch (error) {
    return {ok:false, detail:error instanceof Error ? error.message.slice(0, 240) : 'Check failed.', durationMs:Date.now()-start, checkedAt:Date.now()}
  }
}

const EVENT_SCRIPT = "try { $events = @(Get-WinEvent -FilterHashtable @{LogName='System';Level=1,2;StartTime=(Get-Date).AddHours(-1)} -MaxEvents 12 -ErrorAction Stop); ConvertTo-Json -InputObject @($events | Select-Object @{n='Time';e={$_.TimeCreated.ToString('o')}},Id,ProviderName,Message) -Compress -Depth 2 } catch { if ($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') { '[]' } else { throw } }"
export async function collectIncident(includeEvents: boolean): Promise<IncidentSnapshot> {
  const lines = [`Captured: ${new Date().toISOString()}`, `OS: ${os.type()} ${os.release()}`, `Uptime: ${Math.floor(os.uptime()/60)} minutes`, `Memory: ${Math.round((os.totalmem()-os.freemem())/1048576)} MiB used of ${Math.round(os.totalmem()/1048576)} MiB`]
  let eventStatus = 'Not included.'
  if (includeEvents) {
    if (process.platform !== 'win32') eventStatus = 'Windows events are available on Windows only.'
    else eventStatus = await new Promise(resolve => {
      execFile('powershell.exe', ['-NoProfile','-NonInteractive','-Command', EVENT_SCRIPT], {timeout:10000,maxBuffer:250000,windowsHide:true}, (error, stdout) => {
        if (error) { resolve('Unable to read the System event log. Check permissions and try again.'); return }
        try {
          const value: unknown = JSON.parse(stdout); const events = Array.isArray(value) ? value : [value]
          const text = events.slice(0,12).map((event: {Time?:unknown;Id?:unknown;ProviderName?:unknown;Message?:unknown}) => {
            const message = String(event.Message || '').replace(/\s+/g,' ').slice(0,350)
            return `${String(event.Time || 'Unknown time')} · Event ${String(event.Id || '?')} · ${String(event.ProviderName || 'Unknown')} · ${message}`
          }).join('\n')
          resolve(text || 'No recent System errors found.')
        } catch { resolve('Recent System errors could not be read.') }
      })
    })
  }
  return {summary:lines.join('\n'),events:eventStatus,createdAt:Date.now()}
}
