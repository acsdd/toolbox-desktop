import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { Readable } from 'node:stream'

const v4 = new BlockList()
for (const [net, bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const) v4.addSubnet(net,bits,'ipv4')
const v6 = new BlockList()
for (const [net, bits] of [['::',128],['::1',128],['64:ff9b::',96],['::ffff:0:0',96],['100::',64],['2001:db8::',32],['fc00::',7],['fe80::',10],['ff00::',8]] as const) v6.addSubnet(net,bits,'ipv6')
export function isPublicAddress(address: string): boolean { const family=isIP(address); return family===4 ? !v4.check(address,'ipv4') : family===6 ? !v6.check(address,'ipv6') : false }

/** One GET to a DNS-validated address; no automatic redirects or second DNS lookup. */
export async function publicFetch(raw: string, options: { headers: Record<string,string>; signal: AbortSignal; resolve?: (host: string) => Promise<Array<{address:string;family:number}>> }): Promise<Response> {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsupported public URL.')
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host === 'home.arpa' || host.endsWith('.home.arpa')) throw new Error('Local network names are not allowed.')
  options.signal.throwIfAborted()
  const family = isIP(host)
  const addresses = family ? [{address: host, family}] : await (options.resolve ?? (name => lookup(name,{all:true,verbatim:true})))(host)
  options.signal.throwIfAborted()
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('Host resolves to a private or reserved address.')
  const selected=addresses[0]
  return new Promise((resolve,reject)=>{
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      hostname:selected.address, family:selected.family, servername:host, headers:{...options.headers,Host:url.host}, signal:options.signal
    }, response=>{
      const headers=new Headers()
      for(const [name,value] of Object.entries(response.headers)) if(value!==undefined) headers.set(name, Array.isArray(value)?value.join(', '):value)
      const status=response.statusCode || 500
      if ([204,205,304].includes(status)) { response.resume(); resolve(new Response(null,{status,headers})); return }
      resolve(new Response(Readable.toWeb(response) as unknown as ReadableStream, {status, headers}))
    })
    request.on('error',reject);request.end()
  })
}
