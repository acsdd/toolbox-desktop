import { readdir, lstat, statfs } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import type { DiskScan } from '../../shared/types'
export async function scanDisk(value:unknown): Promise<DiskScan> {
  if(typeof value!=='string'||!value.trim()||value.length>2048)throw new Error('Choose a folder to inspect.')
  const root=resolve(value);const info=await lstat(root).catch(()=>null)
  if(!info?.isDirectory()||info.isSymbolicLink())throw new Error('Choose an available folder, not a shortcut.')
  const groups=new Map<string,number>();const queue:{dir:string;group:string}[]=[{dir:root,group:''}];let count=0,skipped=0,truncated=false
  while(queue.length&&!truncated){
    const current=queue.pop()!;let entries
    try{entries=await readdir(current.dir,{withFileTypes:true})}catch{skipped++;continue}
    for(const entry of entries){
      if(++count>50000){truncated=true;break}
      if(entry.isSymbolicLink()){skipped++;continue}
      const full=join(current.dir,entry.name),group=current.group|| (entry.isDirectory()?entry.name:'Files in this folder')
      if(entry.isDirectory()){if(!groups.has(group))groups.set(group,0);queue.push({dir:full,group})}
      else if(entry.isFile()){try{const file=await lstat(full);if(file.isFile()&&!file.isSymbolicLink())groups.set(group,(groups.get(group)||0)+file.size)}catch{skipped++}}
    }
  }
  const entries=[...groups].map(([name,bytes])=>({name,bytes})).sort((a,b)=>b.bytes-a.bytes)
  return {path:root,name:basename(root)||root,entries,totalBytes:entries.reduce((sum,item)=>sum+item.bytes,0),skipped,truncated,scannedAt:Date.now()}
}

export async function storageCapacity(value:unknown):Promise<{total:number;free:number}> {
  if(typeof value!=='string'||!value.trim()||value.length>2048)throw new Error('Choose a mounted folder or share.')
  const info=await statfs(resolve(value))
  return {total:Number(info.blocks)*Number(info.bsize),free:Number(info.bavail)*Number(info.bsize)}
}
