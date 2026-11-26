import type { AiEndpointResult } from '../../shared/types'
export async function inspectAiEndpoint(input:unknown):Promise<AiEndpointResult>{
 if(!input||typeof input!=='object')throw new Error('Enter an endpoint.')
 const data=input as {kind?:unknown;url?:unknown};if(data.kind!=='ollama'&&data.kind!=='lmstudio')throw new Error('Unknown local AI service.')
 if(typeof data.url!=='string'||data.url.length>500)throw new Error('Enter a valid endpoint URL.')
 let base:URL;try{base=new URL(data.url)}catch{throw new Error('Enter a valid endpoint URL.')}
 if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw new Error('Use an HTTP or HTTPS URL without credentials.')
 const url=new URL(data.kind==='ollama'?'/api/ps':'/v1/models',base);const start=Date.now()
 try{
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(5000)})
  if(!response.ok)throw new Error(`HTTP ${response.status}`)
  const reader=response.body?.getReader();if(!reader)throw new Error('No response body.')
  const chunks:Uint8Array[]=[];let bytes=0
  for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>1024*1024){await reader.cancel();throw new Error('Response was too large.')}chunks.push(part.value)}
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8')) as {models?:{name?:unknown}[];data?:{id?:unknown}[]}
  const records=data.kind==='ollama'?body.models:body.data
  if(!Array.isArray(records))throw new Error('Unexpected model response.')
  const models=records.slice(0,100).map(item=>data.kind==='ollama'?(item as {name?:unknown}).name:(item as {id?:unknown}).id).filter((item):item is string=>typeof item==='string').map(item=>item.slice(0,200))
  return {ok:true,models,durationMs:Date.now()-start,error:''}
 }catch(error){return {ok:false,models:[],durationMs:Date.now()-start,error:error instanceof Error?error.message.slice(0,180):'Could not reach service.'}}
}
