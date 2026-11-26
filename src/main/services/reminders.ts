import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { showDesktopNotification } from './notify'
import type { ToolboxReminder } from '../../shared/types'
let items:ToolboxReminder[]=[]
let loaded:Promise<void> | null=null
let ticker:ReturnType<typeof setInterval> | null=null
let writeQueue:Promise<void>=Promise.resolve()
function file(){return join(app.getPath('userData'),'reminders.json')}
function persist(){const snapshot=JSON.stringify({version:1,items});writeQueue=writeQueue.catch(()=>{}).then(async()=>{await mkdir(dirname(file()),{recursive:true});await writeFile(file(),snapshot,{encoding:'utf8',mode:0o600})});return writeQueue}
function valid(item:unknown):item is ToolboxReminder {if(!item||typeof item!=='object')return false;const x=item as Partial<ToolboxReminder>;return typeof x.id==='string'&&typeof x.name==='string'&&typeof x.dueAt==='number'&&Number.isFinite(x.dueAt)&&['none','daily','weekly'].includes(String(x.repeat))&&typeof x.done==='boolean'}
async function load(){if(!loaded)loaded=(async()=>{try{const parsed:unknown=JSON.parse(await readFile(file(),'utf8'));if(parsed&&typeof parsed==='object'&&Array.isArray((parsed as {items?:unknown}).items))items=((parsed as {items:unknown[]}).items).filter(valid).slice(0,100)}catch{}})();await loaded}
async function check(){await load();const now=Date.now();let changed=false;for(const item of items){if(item.done||item.dueAt>now)continue;showDesktopNotification('Toolbox reminder',item.name);changed=true;if(item.repeat==='none')item.done=true;else{const next=new Date(item.dueAt),days=item.repeat==='daily'?1:7;do{next.setDate(next.getDate()+days)}while(next.getTime()<=now);item.dueAt=next.getTime()}}if(changed)await persist()}
export async function initReminders(){await load();await check();if(!ticker)ticker=setInterval(()=>{void check().catch(()=>{})},10000)}
export async function listReminders(){await load();return items.map(item=>({...item})).sort((a,b)=>a.dueAt-b.dueAt)}
export async function addReminder(input:unknown){await load();if(!input||typeof input!=='object')throw new Error('Enter a reminder.');const value=input as Partial<ToolboxReminder>;const name=typeof value.name==='string'?value.name.trim().slice(0,100):'';const dueAt=Number(value.dueAt);if(!name||!Number.isFinite(dueAt)||dueAt<=Date.now()||dueAt>Date.now()+366*86400000)throw new Error('Enter a name and a future time within the next year.');if(!['none','daily','weekly'].includes(String(value.repeat)))throw new Error('Choose a repeat interval.');if(items.length>=100)throw new Error('You can save up to 100 reminders.');items.push({id:randomUUID(),name,dueAt,repeat:value.repeat as ToolboxReminder['repeat'],done:false});await persist();return listReminders()}
export async function removeReminder(id:unknown){await load();if(typeof id!=='string')throw new Error('Invalid reminder.');items=items.filter(item=>item.id!==id);await persist();return listReminders()}
export function stopReminders(){if(ticker)clearInterval(ticker);ticker=null}
