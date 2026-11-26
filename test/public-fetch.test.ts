import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPublicAddress, publicFetch } from '../src/main/services/public-fetch.ts'
test('public address policy rejects loopback, private, mapped and reserved addresses', () => {
  for (const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.0.2.1','::1','::ffff:127.0.0.1','fc00::1']) assert.equal(isPublicAddress(ip),false,ip)
  assert.equal(isPublicAddress('8.8.8.8'),true)
})
test('rejects mixed public and private DNS answers before connecting', async () => {
  await assert.rejects(publicFetch('https://example.com/', { headers: {}, signal: AbortSignal.timeout(2000), resolve: async () => [{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}] }), /private or reserved/)
})
