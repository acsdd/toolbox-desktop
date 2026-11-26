import { useState } from 'react'
import type { ProjectStatus } from '@shared/types'
import type { ToolDefinition } from '../types'
const KEY='toolbox.projects-folder'
function ProjectsTool(){
 const [folder,setFolder]=useState(()=>localStorage.getItem(KEY)||'')
 const [projects,setProjects]=useState<ProjectStatus[]>([])
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[fetchTarget,setFetchTarget]=useState<ProjectStatus|null>(null)
 async function scan(path:string){setBusy(true);setError('');try{setProjects(await window.api.projects.list(path));setLoaded(true)}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}finally{setBusy(false)}}
 async function choose(){try{const path=await window.api.projects.pickFolder();if(!path)return;setFolder(path);try{localStorage.setItem(KEY,path)}catch{};await scan(path)}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}}
 async function fetchUpdates(){if(!fetchTarget)return;setBusy(true);setError('');try{await window.api.projects.fetch(fetchTarget.path);setFetchTarget(null);await scan(folder)}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}finally{setBusy(false)}}
 return <div className="diagnostic-tool"><p className="diagnostic-intro">Inspect a project folder or its immediate repositories. Results use local information and never fetch from a remote.</p>
 <div className="tool-strip"><button className="ghost-button" disabled={busy} onClick={()=>void choose()}>Choose folder</button><button className="primary-button" disabled={busy||!folder} onClick={()=>void scan(folder)}>{busy?'Checking…':'Refresh'}</button></div>
 {folder && <p className="hint">{folder}</p>}{error && <p className="error-text" role="alert">{error}</p>}
 {loaded&&!projects.length&&<div className="empty-state compact"><strong>No repositories found</strong><p>Choose a repository or a folder containing repositories.</p></div>}
 <div className="diagnostic-list">{projects.map(project=><article className="diagnostic-row" key={project.path}><div><strong>{project.name}</strong><small>{project.path}</small>{project.error?<p className="error-text">{project.error}</p>:<p>{project.branch} · {project.changes===0?'Clean':`${project.changes} changed files`} · {project.ahead===null?'Upstream comparison unavailable':`${project.ahead} ahead / ${project.behind} behind`}</p>}</div>{project.remoteUrl&&<button className="ghost-button small" disabled={busy} onClick={()=>setFetchTarget(project)}>Fetch…</button>}</article>)}</div>{fetchTarget&&<div className="result-banner"><strong>Fetch updates for {fetchTarget.name}?</strong><p>{fetchTarget.remoteUrl}</p><p>This contacts the remote and updates remote-tracking references; it does not change your files.</p><div className="tool-strip"><button className="ghost-button small" onClick={()=>setFetchTarget(null)}>Cancel</button><button className="primary-button" disabled={busy} onClick={()=>void fetchUpdates()}>Confirm fetch</button></div></div>}
 </div>
}
export const manifest:ToolDefinition={id:'projects',name:'Projects & Git',description:'See branches and local changes across your project repositories.',icon:'folder',accent:'#91afff',order:23,component:ProjectsTool}
