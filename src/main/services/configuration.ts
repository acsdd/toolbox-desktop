import { execFile } from 'node:child_process'
export interface ServiceSnapshot {takenAt:number;services:{name:string;status:string;startType:string}[]}
const SCRIPT="$ErrorActionPreference='Stop'; Get-Service | Select-Object -First 2500 Name,@{n='Status';e={$_.Status.ToString()}},@{n='StartType';e={$_.StartType.ToString()}} | ConvertTo-Json -Compress"
export async function snapshotServices(input:unknown):Promise<ServiceSnapshot>{
 const wanted=typeof input==='string'?input.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).slice(0,30):[]
 if(!wanted.length||wanted.some(x=>!/^[a-z0-9_.-]{1,100}$/i.test(x)))throw new Error('Enter one or more Windows service names, separated by commas.')
 if(process.platform!=='win32')throw new Error('Windows services are available on Windows only.')
 const output=await new Promise<string>((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',SCRIPT],{windowsHide:true,timeout:15000,maxBuffer:1500000},(error,stdout)=>error?reject(new Error('Could not read Windows service status.')):resolve(stdout)))
 let parsed:unknown;try{parsed=JSON.parse(output)}catch{throw new Error('Could not read Windows service status.')}
 const all=Array.isArray(parsed)?parsed:[parsed]
 const services=wanted.map(name=>{const found=all.find((item:Record<string,unknown>)=>typeof item.Name==='string'&&item.Name.toLowerCase()===name);return {name,status:found?String(found.Status):'Not found',startType:found?String(found.StartType??'Unknown'):'Unknown'}})
 return {takenAt:Date.now(),services}
}
