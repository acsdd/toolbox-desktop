import { useEffect, useRef, useState } from 'react'
import { compareDigest } from '@shared/widget-files'
import type { VerificationFile, VerificationProgress } from '@shared/widget-files'
import { formatBytes } from '../../lib/format'
import type { ToolDefinition } from '../types'
import '../utility-widgets.css'

function FileVerification() {
  const [file, setFile] = useState<VerificationFile | null>(null)
  const [expected, setExpected] = useState('')
  const [digest, setDigest] = useState('')
  const [working, setWorking] = useState(false)
  const [picking, setPicking] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [progress, setProgress] = useState<VerificationProgress | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const active = useRef<string | null>(null)
  const result = compareDigest(digest, expected)

  useEffect(() => () => {
    if (active.current) void window.api.fileVerification.cancel(active.current).catch(() => {})
  }, [])

  async function choose() {
    setPicking(true)
    setError('')
    try {
      const selected = await window.api.fileVerification.pick()
      if (!selected) return
      setFile(selected)
      setExpected('')
      setDigest('')
      setNotice('')
    } catch (cause) { setError(String(cause)) }
    finally { setPicking(false) }
  }

  async function calculate() {
    if (!file || active.current) return
    const { id, size } = file
    active.current = id
    setWorking(true)
    setProgress({ bytes: 0, total: size })
    setDigest('')
    setError('')
    setNotice('')
    const timer = window.setInterval(() => {
      void window.api.fileVerification.progress(id).then(value => {
        if (value && active.current === id) setProgress(value)
      }).catch(() => {})
    }, 200)
    try {
      const result = await window.api.fileVerification.run(id)
      if (result === null) setNotice('Verification cancelled.')
      else setDigest(result)
    } catch (cause) { setError(String(cause)) }
    finally {
      window.clearInterval(timer)
      active.current = null
      setWorking(false)
      setCanceling(false)
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(digest); setNotice('SHA-256 copied.') }
    catch { setError('Could not copy the digest. You can select and copy it manually.') }
  }

  async function cancel() {
    if (!file) return
    setCanceling(true)
    try { await window.api.fileVerification.cancel(file.id) }
    catch (cause) { setError(String(cause)); setCanceling(false) }
  }

  return <div className="utility-widget" data-widget="file-verification">
    <section className="utility-panel utility-panel-feature" aria-label="File to verify">
      {file ? <strong className="utility-path">{file.name} · {formatBytes(file.size)}</strong> : <p>Choose a file to calculate its SHA-256 digest.</p>}
      <div className="utility-actions">
        <button className="ghost-button" type="button" disabled={working || picking} onClick={() => void choose()}>Choose file</button>
        <button className="primary-button" type="button" disabled={!file || working || picking} onClick={() => void calculate()}>Calculate SHA-256</button>
        {working && <button className="ghost-button" type="button" disabled={canceling} onClick={() => void cancel()}>{canceling ? 'Cancelling…' : 'Cancel'}</button>}
      </div>
      {working && progress && <label className="utility-progress">
        {formatBytes(progress.bytes)} read of {formatBytes(progress.total)}
        <progress max={Math.max(1, progress.total)} value={progress.bytes} />
      </label>}
    </section>
    <section className="utility-panel" aria-label="Digest comparison">
      <label className="utility-field">Expected SHA-256 digest (optional)<input value={expected} maxLength={128} spellCheck={false} autoComplete="off" onChange={event => setExpected(event.target.value)} /></label>
      {digest && <>
        <strong>Calculated SHA-256</strong>
        <output className="utility-digest" aria-label="Calculated SHA-256">{digest}</output>
        <div className="utility-actions"><button className="ghost-button" type="button" onClick={() => void copy()}>Copy result</button></div>
      </>}
      {result === 'invalid' && <p className="utility-message" role="status">Invalid digest. Enter 64 hexadecimal characters.</p>}
      {digest && result === 'match' && <p className="utility-message" role="status">Match. The calculated SHA-256 matches the expected digest.</p>}
      {digest && result === 'mismatch' && <p className="utility-message" role="status">Mismatch. The file digest differs from the expected digest.</p>}
    </section>
    {notice && <p className="utility-message" role="status">{notice}</p>}
    {error && <p className="utility-message" role="alert">{error}</p>}
  </div>
}

export const manifest: ToolDefinition = {
  id: 'file-verification', name: 'File Verification', description: 'Calculate a file’s SHA-256 digest and check it against an expected value.',
  icon: 'shield', accent: '#73d3b2', order: 33, component: FileVerification
}
