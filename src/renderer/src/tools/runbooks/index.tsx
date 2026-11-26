import { useEffect, useState } from 'react'
import type { ToolDefinition } from '../types'
interface Runbook{id:string;title:string;steps:string}
const KEY='toolbox.runbooks.v1'
function read():Runbook[]{try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(value)?value.filter(item=>item&&typeof item.id==='string'&&typeof item.title==='string'&&typeof item.steps==='string').slice(0,100):[]}catch{return []}}
function Runbooks(){
 const [items,setItems]=useState<Runbook[]>(read),[title,setTitle]=useState(''),[steps,setSteps]=useState(''),[error,setError]=useState('')
 useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(items))}catch{setError('Could not save runbooks on this device.')}},[items])
 function add(){if(!title.trim()||!steps.trim()){setError('Enter a title and steps.');return}if(items.length>=100){setError('You can save up to 100 runbooks.');return}setItems(previous=>[...previous,{id:crypto.randomUUID(),title:title.trim(),steps:steps.trim()}]);setTitle('');setSteps('');setError('')}
 return <div className="diagnostic-tool"><p className="diagnostic-intro">Keep local checklists for repeat tasks. Commands written here are displayed as text and never run automatically.</p><div className="diagnostic-form"><label>Title<input maxLength={100} value={title} onChange={event=>setTitle(event.target.value)} /></label></div><label className="diagnostic-label">Steps<textarea maxLength={20000} rows={5} value={steps} onChange={event=>setSteps(event.target.value)} placeholder="Write one step per line." /></label><button className="primary-button" onClick={add}>Save runbook</button>{error&&<p className="error-text" role="alert">{error}</p>}<div className="diagnostic-list">{items.map(item=><article className="diagnostic-row" key={item.id}><div><strong>{item.title}</strong><p style={{whiteSpace:'pre-wrap'}}>{item.steps}</p></div><button className="ghost-button small" onClick={()=>setItems(previous=>previous.filter(value=>value.id!==item.id))}>Remove</button></article>)}</div></div>
}
export const manifest:ToolDefinition={id:'runbooks',name:'Personal runbooks',description:'Keep local checklists for recurring procedures.',icon:'notes',accent:'#a8cf83',order:27,component:Runbooks}
