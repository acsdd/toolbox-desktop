import { app, BrowserWindow, safeStorage } from 'electron'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import type { MailMessageSummary, MailSetup, MailStatus } from '../../shared/types'
import { showDesktopNotification } from './notify'

const GMAIL_HOST = 'imap.gmail.com'
const GMAIL_PORT = 993
const POLL_MS = 2 * 60 * 1000
const MAX_MESSAGES = 6
const CONNECT_TIMEOUT_MS = 20000

interface StoredAccount {
  version: 1
  email: string
  host: string
  port: number
  secret: string
  notifications: boolean
}

interface MailState {
  account: StoredAccount | null
  password: string | null
  loaded: boolean
  connected: boolean
  checking: boolean
  unread: number
  lastCheck: number | null
  error: string | null
  messages: MailMessageSummary[]
  lastUid: number
  timer: NodeJS.Timeout | null
  pending: Promise<MailStatus> | null
  generation: number
}

const state: MailState = {
  account: null,
  password: null,
  loaded: false,
  connected: false,
  checking: false,
  unread: 0,
  lastCheck: null,
  error: null,
  messages: [],
  lastUid: 0,
  timer: null,
  pending: null,
  generation: 0
}

function accountPath(): string {
  return join(app.getPath('userData'), 'gmail.json')
}

function isStoredAccount(value: unknown): value is StoredAccount {
  if (!value || typeof value !== 'object') return false
  const account = value as Partial<StoredAccount>
  return (
    account.version === 1 &&
    typeof account.email === 'string' &&
    typeof account.host === 'string' &&
    typeof account.port === 'number' &&
    typeof account.secret === 'string' &&
    typeof account.notifications === 'boolean'
  )
}

function status(): MailStatus {
  return {
    configured: Boolean(state.account),
    email: state.account?.email ?? '',
    host: state.account?.host ?? GMAIL_HOST,
    port: state.account?.port ?? GMAIL_PORT,
    connected: state.connected,
    checking: state.checking,
    unread: state.unread,
    lastCheck: state.lastCheck,
    error: state.error,
    notifications: state.account?.notifications ?? true,
    messages: state.messages
  }
}

function broadcast(): void {
  const payload = status()
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('mail:update', payload)
  }
}

async function persistAccount(account: StoredAccount | null = state.account): Promise<void> {
  if (!account) return
  const target = accountPath()
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(account, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  })
}

async function loadAccount(): Promise<void> {
  if (state.loaded) return
  state.loaded = true

  try {
    const raw = await readFile(accountPath(), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredAccount(parsed)) return
    if (!(await safeStorage.isAsyncEncryptionAvailable())) return

    const decrypted = await safeStorage.decryptStringAsync(Buffer.from(parsed.secret, 'base64'))
    state.account = parsed
    state.password = decrypted.result

    if (decrypted.shouldReEncrypt) {
      parsed.secret = (await safeStorage.encryptStringAsync(decrypted.result)).toString('base64')
      await persistAccount()
    }
  } catch {
    // A missing or unreadable account just means Gmail is not connected yet.
    state.account = null
    state.password = null
  }
}

function validateSetup(input: unknown): { email: string; password: string } {
  if (!input || typeof input !== 'object') throw new Error('Enter your Gmail address and App Password.')
  const setup = input as Partial<MailSetup>
  const email = typeof setup.email === 'string' ? setup.email.trim().toLowerCase() : ''
  // Google shows App Passwords in four groups; the spaces are not part of the password.
  const password = typeof setup.password === 'string' ? setup.password.replace(/\s+/g, '') : ''

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    throw new Error('Enter a valid Gmail address.')
  }
  if (password.length !== 16) {
    throw new Error(
      'Gmail App Passwords are 16 characters. Paste the App Password generated at myaccount.google.com/apppasswords — your normal Google password will not work.'
    )
  }
  return { email, password }
}

function friendlyError(cause: unknown): string {
  const error = cause as {
    message?: string
    responseText?: string
    executedCommand?: string
    authenticationFailed?: boolean
  }
  const detail = typeof error?.responseText === 'string' ? error.responseText.trim() : ''
  const message = error?.message || (cause instanceof Error ? cause.message : String(cause))
  const combined = `${message} ${detail}`
  const command = (error?.executedCommand ?? '').toUpperCase()

  if (/imap access is disabled|imap is disabled/i.test(combined)) {
    return 'IMAP is turned off for this Gmail account. Enable it in Gmail → Settings → See all settings → Forwarding and POP/IMAP, then try again.'
  }
  if (/application-specific password required/i.test(combined)) {
    return 'Google requires an App Password. Turn on 2-step verification and create one at myaccount.google.com/apppasswords.'
  }
  if (/web login required|please log in via your web browser|less secure/i.test(combined)) {
    return 'Google blocked this sign-in. Open Gmail in a browser, complete any security prompt, then try the App Password again.'
  }
  if (/too many simultaneous connections|too many connections/i.test(combined)) {
    return 'Gmail has too many open IMAP connections right now. Wait a minute and try again.'
  }
  if (
    error?.authenticationFailed ||
    /authentication|invalid credentials|login failed|auth failed|AUTHENTICATE/i.test(combined) ||
    /AUTHENTICATE|LOGIN/.test(command)
  ) {
    return 'Gmail rejected the sign-in. Use a 16-character App Password with 2-step verification enabled — your normal Google password will not work.'
  }
  if (
    /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|CONNECT_TIMEOUT|timeout|network|no connection/i.test(
      combined
    )
  ) {
    return 'Could not reach Gmail. Check your internet connection and try again.'
  }
  if (/certificate|self signed|TLS|SSL/i.test(combined)) {
    return 'The secure connection to Gmail could not be verified.'
  }
  if (detail) {
    return `Gmail rejected the request: ${detail}`
  }
  if (/^command failed$/i.test(message)) {
    return 'Gmail rejected the request. Check that IMAP is enabled for this account and use a fresh App Password.'
  }
  return message
}

function formatSender(envelope: {
  from?: { name?: string; address?: string }[]
} | undefined): string {
  const first = envelope?.from?.[0]
  if (!first) return 'Unknown sender'
  return first.name?.trim() || first.address?.trim() || 'Unknown sender'
}

function isoDate(value: Date | string | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

interface FetchResult {
  unread: number
  messages: MailMessageSummary[]
  maxUid: number
}

async function fetchInbox(email: string, password: string): Promise<FetchResult> {
  const client = new ImapFlow({
    host: GMAIL_HOST,
    port: GMAIL_PORT,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
    emitLogs: false,
    disableAutoIdle: true,
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: CONNECT_TIMEOUT_MS
  })

  await client.connect()
  try {
    const mailboxStatus = await client.status('INBOX', { unseen: true })
    const lock = await client.getMailboxLock('INBOX', { readOnly: true })
    try {
      const exists = client.mailbox ? client.mailbox.exists : 0
      const messages: MailMessageSummary[] = []
      let maxUid = 0

      if (exists > 0) {
        const start = Math.max(1, exists - MAX_MESSAGES + 1)
        for await (const message of client.fetch(`${start}:*`, {
          envelope: true,
          flags: true
        })) {
          const flags = message.flags ?? new Set<string>()
          messages.push({
            uid: message.uid,
            from: formatSender(message.envelope),
            subject: message.envelope?.subject?.trim() || '(no subject)',
            date: isoDate(message.envelope?.date),
            seen: flags.has('\\Seen')
          })
          maxUid = Math.max(maxUid, message.uid)
        }
      }

      messages.sort((left, right) => right.uid - left.uid)
      return {
        unread: typeof mailboxStatus === 'object' && mailboxStatus ? (mailboxStatus.unseen ?? 0) : 0,
        messages,
        maxUid
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

function notifyNewMail(messages: MailMessageSummary[], unread: number): void {
  if (!state.account?.notifications) return
  if (messages.length === 0) return

  const title =
    messages.length === 1 ? 'New mail in Gmail' : `${messages.length} new messages in Gmail`
  const body =
    messages.length === 1
      ? `${messages[0].from} — ${messages[0].subject}`
      : `${unread} unread · ${messages[0].from} — ${messages[0].subject}`

  showDesktopNotification(title, body)
}

async function runCheck(reason: 'startup' | 'timer' | 'manual'): Promise<MailStatus> {
  const account = state.account
  const password = state.password
  if (!account || !password) return status()
  if (state.pending) return state.pending

  const generation = state.generation
  state.checking = true
  state.error = null
  broadcast()

  const task = (async () => {
    try {
      const result = await fetchInbox(account.email, password)
      if (generation !== state.generation) return status()

      const isBaseline = state.lastUid === 0
      const fresh = result.messages.filter((message) => !message.seen && message.uid > state.lastUid)

      state.unread = result.unread
      state.messages = result.messages
      state.lastCheck = Date.now()
      state.connected = true
      state.error = null
      state.lastUid = Math.max(state.lastUid, result.maxUid)

      if (reason === 'timer' && !isBaseline) notifyNewMail(fresh, result.unread)
    } catch (cause) {
      if (generation !== state.generation) return status()
      state.connected = false
      state.error = friendlyError(cause)
    } finally {
      if (generation === state.generation) {
        state.checking = false
        state.pending = null
        broadcast()
      }
    }
    return status()
  })()

  state.pending = task
  return task
}

function startPolling(): void {
  stopPolling()
  state.timer = setInterval(() => void runCheck('timer'), POLL_MS)
}

function stopPolling(): void {
  if (state.timer) {
    clearInterval(state.timer)
    state.timer = null
  }
}

export async function initMail(): Promise<void> {
  await loadAccount()
  if (!state.account) return
  startPolling()
  void runCheck('startup')
}

export function getMailStatus(): MailStatus {
  return status()
}

export async function connectMail(input: unknown): Promise<MailStatus> {
  const { email, password } = validateSetup(input)

  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error('Windows encryption is unavailable, so the App Password cannot be stored safely.')
  }

  state.loaded = true
  stopPolling()
  state.generation += 1
  state.pending = null
  state.checking = true
  state.error = null
  state.connected = false
  broadcast()

  try {
    const result = await fetchInbox(email, password)
    const secret = (await safeStorage.encryptStringAsync(password)).toString('base64')

    const nextAccount: StoredAccount = {
      version: 1,
      email,
      host: GMAIL_HOST,
      port: GMAIL_PORT,
      secret,
      notifications: true
    }
    await persistAccount(nextAccount)

    state.account = nextAccount
    state.password = password
    state.messages = result.messages
    state.unread = result.unread
    state.lastUid = result.maxUid
    state.lastCheck = Date.now()
    state.connected = true
    state.error = null
    startPolling()
    broadcast()
    return status()
  } catch (cause) {
    const message = friendlyError(cause)
    state.connected = false
    state.error = message
    if (state.account) startPolling()
    throw new Error(message)
  } finally {
    state.checking = false
    broadcast()
  }
}

export async function disconnectMail(): Promise<MailStatus> {
  stopPolling()
  state.generation += 1
  state.pending = null
  state.account = null
  state.password = null
  state.connected = false
  state.checking = false
  state.unread = 0
  state.lastCheck = null
  state.error = null
  state.messages = []
  state.lastUid = 0
  await rm(accountPath(), { force: true }).catch(() => {})
  broadcast()
  return status()
}

export async function checkMail(): Promise<MailStatus> {
  return runCheck('manual')
}

export async function setMailNotifications(enabled: unknown): Promise<MailStatus> {
  if (!state.account) return status()
  state.account.notifications = enabled === true
  await persistAccount().catch(() => {})
  broadcast()
  return status()
}

export function stopMail(): void {
  stopPolling()
}

/** Send only a user-reviewed plaintext report using the connected Gmail account. */
export async function sendIncidentEmail(input: unknown): Promise<{recipient:string}> {
  await loadAccount()
  if (!state.account || !state.password) throw new Error('Connect Gmail in Gmail announcer before sending, or open an email draft instead.')
  if (!input || typeof input !== 'object') throw new Error('Enter a destination and report.')
  const value = input as {recipient?:unknown;subject?:unknown;body?:unknown}
  const recipient = typeof value.recipient === 'string' ? value.recipient.trim() : ''
  const subject = typeof value.subject === 'string' ? value.subject.trim() : ''
  const body = typeof value.body === 'string' ? value.body : ''
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(recipient) || recipient.length > 254) throw new Error('Enter a valid email address.')
  if (!subject || subject.length > 150 || /[\r\n]/.test(subject) || !body || body.length > 12000) throw new Error('Enter a subject and report within the size limits.')
  const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:state.account.email,pass:state.password},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true})
  try {
    const result=await transport.sendMail({from:state.account.email,to:recipient,subject,text:body})
    if (!result.accepted.length) throw new Error('The mail server did not accept the report.')
    return {recipient}
  } catch { throw new Error('Could not send the report through Gmail. Check the account connection and try again.') }
  finally {transport.close()}
}
