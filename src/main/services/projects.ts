import fs from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import git from 'isomorphic-git'
import http from 'isomorphic-git/http/node'
import type { ProjectStatus } from '../../shared/types'

async function isRepo(dir: string): Promise<boolean> { try { const result=await stat(join(dir,'.git')); return result.isDirectory() || result.isFile() } catch { return false } }
async function status(dir: string): Promise<ProjectStatus> {
  try {
    const [branch, head, matrix] = await Promise.all([
      git.currentBranch({fs,dir,fullname:false}),git.resolveRef({fs,dir,ref:'HEAD'}),git.statusMatrix({fs,dir,refresh:false})
    ])
    const changes=matrix.filter(([,h,w,s])=>h!==w || h!==s)
    let ahead: number | null=null,behind: number | null=null,remoteUrl=''
    if(branch){
      try {
        const remote=await git.getConfig({fs,dir,path:`branch.${branch}.remote`})
        const merge=await git.getConfig({fs,dir,path:`branch.${branch}.merge`})
        const configuredUrl=remote?await git.getConfig({fs,dir,path:`remote.${remote}.url`}):undefined
        if(configuredUrl){try{const parsed=new URL(configuredUrl);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash)remoteUrl=parsed.href}catch{}}
        if(remote && merge?.startsWith('refs/heads/')) {
          const upstream=await git.resolveRef({fs,dir,ref:`refs/remotes/${remote}/${merge.slice(11)}`})
          if(upstream===head){ahead=0;behind=0}
          else {
            const [ours,theirs]=await Promise.all([git.log({fs,dir,ref:head,depth:500}),git.log({fs,dir,ref:upstream,depth:500})])
            if(ours.length<500 && theirs.length<500){const a=new Set(ours.map(item=>item.oid)),b=new Set(theirs.map(item=>item.oid));ahead=ours.filter(item=>!b.has(item.oid)).length;behind=theirs.filter(item=>!a.has(item.oid)).length}
          }
        }
      } catch { /* No locally recorded upstream; never fetch automatically. */ }
    }
    return {name:basename(dir),path:dir,branch:branch || 'Detached HEAD',changes:changes.length,ahead,behind,remoteUrl,error:''}
  } catch(error) { return {name:basename(dir),path:dir,branch:'',changes:null,ahead:null,behind:null,remoteUrl:'',error:error instanceof Error ? error.message.slice(0,180) : 'Could not read repository.'} }
}
export async function listProjects(value: unknown): Promise<ProjectStatus[]> {
  if(typeof value!=='string' || !value.trim() || value.length>2048) throw new Error('Choose a project folder.')
  const root=resolve(value), info=await stat(root).catch(()=>null)
  if(!info?.isDirectory())throw new Error('That folder is not available.')
  if(await isRepo(root))return [await status(root)]
  const children=await readdir(root,{withFileTypes:true})
  const candidates=children.filter(entry=>entry.isDirectory() && !entry.name.startsWith('.')).slice(0,100)
  const dirs=(await Promise.all(candidates.map(async entry=>{const dir=join(root,entry.name);return await isRepo(dir)?dir:null}))).filter((dir):dir is string=>Boolean(dir))
  const results:ProjectStatus[]=[]
  for(const dir of dirs)results.push(await status(dir))
  return results
}

/** Fetch only after an explicit user action; credentials in remote URLs are rejected. */
export async function fetchProject(value:unknown):Promise<void>{
  if(typeof value!=='string'||!value.trim()||value.length>2048)throw new Error('Choose a repository.')
  const dir=resolve(value);if(!(await isRepo(dir)))throw new Error('That repository is unavailable.')
  const branch=await git.currentBranch({fs,dir,fullname:false});if(!branch)throw new Error('Fetching a detached checkout is not supported.')
  const remote=await git.getConfig({fs,dir,path:`branch.${branch}.remote`});if(!remote||remote==='.')throw new Error('This branch has no remote to fetch.')
  const merge=await git.getConfig({fs,dir,path:`branch.${branch}.merge`});if(!merge?.startsWith('refs/heads/'))throw new Error('This branch has no configured upstream branch.')
  const configured=await git.getConfig({fs,dir,path:`remote.${remote}.url`});let url:URL
  try{url=new URL(configured||'')}catch{throw new Error('The remote needs an HTTPS URL for bundled Git.') }
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Only HTTPS remote URLs without embedded credentials are supported.')
  try{await git.fetch({fs,http,dir,remote,ref:branch,remoteRef:merge.slice(11),singleBranch:true,tags:false})}
  catch{throw new Error('Fetch failed. Check network access and whether this repository requires authentication.') }
}
