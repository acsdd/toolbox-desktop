import { useState } from 'react'
import type { DiskScan } from '@shared/types'
import { formatBytes } from '../../lib/format'
import type { ToolDefinition } from '../types'
const KEY='toolbox.disk-explorer.last'
function loadPrevious():DiskScan|null{try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return x&&typeof x.path==='string'&&typeof x.totalBytes==='number'?x:null}catch{return null}}
function DiskExplorer(){
 const [result,setResult]=useState<DiskScan|null>(null),[previous,setPrevious]=useState<DiskScan|null>(loadPrevious),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function scan(path:string){setBusy(true);setError('');try{const next=await window.api.diskExplorer.scan(path);setResult(next);if(!next.truncated&&next.skipped===0){try{localStorage.setItem(KEY,JSON.stringify(next))}catch{}}}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}finally{setBusy(false)}}
 async function choose(){try{const path=await window.api.diskExplorer.pickFolder();if(path){setPrevious(loadPrevious());await scan(path)}}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}}
 const same=result&&previous&&result.path===previous.path&&!result.truncated&&!result.skipped
 return <div className="diagnostic-tool"><p className="diagnostic-intro">See which folders use space. Scanning reads file sizes and does not move or delete files.</p><div className="tool-strip"><button className="primary-button" disabled={busy} onClick={()=>void choose()}>{busy?'Scanning…':'Choose folder'}</button>{result&&<button className="ghost-button" disabled={busy} onClick={()=>{setPrevious(loadPrevious());void scan(result.path)}}>Scan again</button>}</div>{error&&<p className="error-text" role="alert">{error}</p>}{result&&<><strong>{result.path} · {formatBytes(result.totalBytes)}</strong>{same&&<p className="hint">Change since previous scan: {result.totalBytes>=previous.totalBytes?'+':'−'}{formatBytes(Math.abs(result.totalBytes-previous.totalBytes))}</p>}{(result.truncated||result.skipped>0)&&<p className="hint">Partial results: {result.truncated?'scan reached the 50,000 item limit. ':''}{result.skipped?`${result.skipped} entries were inaccessible or skipped.`:''}</p>}<div className="diagnostic-list">{result.entries.map(item=><article className="diagnostic-row" key={item.name}><div><strong>{item.name}</strong></div><span>{formatBytes(item.bytes)}</span></article>)}</div></>}</div>
}
export const manifest:ToolDefinition={id:'disk-explorer',name:'Disk space explorer',description:'Inspect folder sizes and compare scans without deleting files.',icon:'folder',accent:'#f5a524',order:25,component:DiskExplorer}
