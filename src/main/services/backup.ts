import { app, shell } from 'electron'
import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto'
import type {
  BackupConfig,
  BackupCreateInput,
  BackupCreateResult,
  BackupLocation,
  BackupPreview,
  BackupRestoreInput,
  BackupRestoreResult
} from '../../shared/types'
import { exportSecretValues, replaceSecretValues } from './vault'
import type { VaultExportEntry } from './vault'
import { APP_VERSION } from '../version'

const MAGIC = Buffer.from('TBX1', 'ascii')
const FORMAT_VERSION = 1
const SALT_BYTES = 16
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32
const HEADER_BYTES = MAGIC.length + 1
const MIN_FILE_BYTES = HEADER_BYTES + SALT_BYTES + IV_BYTES + TAG_BYTES + 2
const MAX_BACKUP_BYTES = 50 * 1024 * 1024
const BACKUP_FOLDER = 'Toolbox Backups'
const FILE_PATTERN = /^toolbox-backup-\d{8}-\d{6}(-\d+)?\.tbx$/i

interface BackupPayload {
  format: 'toolbox-backup'
  version: 1
  createdAt: number
  appVersion: string
  config: BackupConfig
  secrets: VaultExportEntry[]
}

function isValidId(value: string): boolean {
  return /^[a-zA-Z0-9-]{1,64}$/.test(value)
}

function sanitizeConfig(value: unknown): BackupConfig {
  const source = value && typeof value === 'object' ? (value as Partial<BackupConfig>) : {}
  const disabled = Array.isArray(source.disabled)
    ? source.disabled.filter((id): id is string => typeof id === 'string' && isValidId(id)).slice(0, 200)
    : []
  const cardSize =
    source.cardSize === 'small' || source.cardSize === 'large' ? source.cardSize : 'medium'
  return { disabled, pinned: source.pinned === true, cardSize }
}

function requirePassword(value: unknown, minimum: number): string {
  if (typeof value !== 'string' || value.length < minimum) {
    throw new Error(
      minimum > 1
        ? `Use at least ${minimum} characters for the backup password.`
        : 'Enter the backup password.'
    )
  }
  if (value.length > 1024) throw new Error('The backup password is too long.')
  return value
}

function resolveDestination(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Choose a backup folder first.')
  }
  const destination = resolve(value)
  if (/^[a-zA-Z]:[\\/]?$/.test(destination)) {
    throw new Error('Choose a folder for backups, not a whole drive.')
  }
  return destination
}

function stamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('') + '-' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('')
}

async function isDirectory(path: string, timeoutMs = 400): Promise<boolean> {
  try {
    return await Promise.race([
      stat(path).then((info) => info.isDirectory()),
      new Promise<boolean>((resolvePromise) => {
        setTimeout(() => resolvePromise(false), timeoutMs)
      })
    ])
  } catch {
    return false
  }
}

async function uniqueBackupFile(directory: string, createdAt: number): Promise<string> {
  const base = `toolbox-backup-${stamp(new Date(createdAt))}`
  for (let attempt = 1; attempt <= 50; attempt++) {
    const candidate = join(directory, attempt === 1 ? `${base}.tbx` : `${base}-${attempt}.tbx`)
    try {
      await access(candidate)
    } catch {
      return candidate
    }
  }
  throw new Error('Could not find an unused backup file name.')
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    scrypt(
      password,
      salt,
      KEY_BYTES,
      { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error)
        else resolvePromise(key)
      }
    )
  })
}

async function encryptPayload(payload: BackupPayload, password: string): Promise<Buffer> {
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = await deriveKey(password, salt)
  const aad = Buffer.concat([MAGIC, Buffer.from([FORMAT_VERSION])])
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')

  let ciphertext: Buffer
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(aad)
    ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
    return Buffer.concat([aad, salt, iv, cipher.getAuthTag(), ciphertext])
  } finally {
    plaintext.fill(0)
    key.fill(0)
  }
}

function validatePayload(value: unknown): BackupPayload {
  if (!value || typeof value !== 'object') throw new Error('The backup contents are malformed.')
  const data = value as Partial<BackupPayload>

  if (data.format !== 'toolbox-backup') throw new Error('This is not a Toolbox backup.')
  if (data.version !== 1) throw new Error('This backup was made by an unsupported Toolbox version.')
  if (!Array.isArray(data.secrets)) throw new Error('The backup contents are malformed.')

  return {
    format: 'toolbox-backup',
    version: 1,
    createdAt:
      typeof data.createdAt === 'number' && Number.isFinite(data.createdAt)
        ? data.createdAt
        : Date.now(),
    appVersion: typeof data.appVersion === 'string' ? data.appVersion.slice(0, 40) : 'unknown',
    config: sanitizeConfig(data.config),
    secrets: data.secrets as VaultExportEntry[]
  }
}

async function decryptPayload(raw: Buffer, password: string): Promise<BackupPayload> {
  if (raw.length < MIN_FILE_BYTES) throw new Error('That file is too small to be a backup.')
  if (!raw.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('That file is not a Toolbox encrypted backup.')
  }
  if (raw[HEADER_BYTES - 1] !== FORMAT_VERSION) {
    throw new Error('This backup was made by an unsupported Toolbox version.')
  }

  const saltStart = HEADER_BYTES
  const ivStart = saltStart + SALT_BYTES
  const tagStart = ivStart + IV_BYTES
  const dataStart = tagStart + TAG_BYTES
  const salt = raw.subarray(saltStart, ivStart)
  const iv = raw.subarray(ivStart, tagStart)
  const tag = raw.subarray(tagStart, dataStart)
  const ciphertext = raw.subarray(dataStart)
  const key = await deriveKey(password, salt)

  let plaintext: Buffer
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(raw.subarray(0, HEADER_BYTES))
    decipher.setAuthTag(tag)
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch {
    throw new Error('Incorrect password, or the backup file has been altered.')
  } finally {
    key.fill(0)
  }

  try {
    const parsed: unknown = JSON.parse(plaintext.toString('utf8'))
    return validatePayload(parsed)
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('The ')) throw cause
    throw new Error('The decrypted backup contents are unreadable.')
  } finally {
    plaintext.fill(0)
  }
}

export async function listBackupLocations(): Promise<BackupLocation[]> {
  const locations: BackupLocation[] = []
  const seen = new Set<string>()

  const add = (label: string, kind: BackupLocation['kind'], root: string | undefined): void => {
    if (!root) return
    const path = join(root, BACKUP_FOLDER)
    const key = path.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    locations.push({ path, label, kind })
  }

  const home = app.getPath('home')

  const googleDriveHome = join(home, 'Google Drive')
  if (await isDirectory(join(googleDriveHome, 'My Drive'))) {
    add('Google Drive', 'google-drive', join(googleDriveHome, 'My Drive'))
  } else if (await isDirectory(googleDriveHome)) {
    add('Google Drive', 'google-drive', googleDriveHome)
  }

  if (process.platform === 'win32') {
    const letters = 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const mounts = await Promise.all(
      letters.map(async (letter) => ({
        letter,
        found: await isDirectory(`${letter}:\\My Drive`)
      }))
    )
    for (const mount of mounts) {
      if (mount.found) add('Google Drive', 'google-drive', `${mount.letter}:\\My Drive`)
    }
  }

  add(
    'OneDrive',
    'onedrive',
    process.env['OneDrive'] ?? process.env['OneDriveConsumer'] ?? join(home, 'OneDrive')
  )
  add('Dropbox', 'dropbox', process.env['Dropbox'] ?? join(home, 'Dropbox'))
  add('This PC · Documents', 'local', app.getPath('documents'))

  return locations
}

export async function openBackupFolder(destination: unknown): Promise<void> {
  const directory = resolveDestination(destination)
  await mkdir(directory, { recursive: true })
  const message = await shell.openPath(directory)
  if (message) throw new Error(message)
}

export async function listBackups(destination: unknown): Promise<BackupPreview[]> {
  if (typeof destination !== 'string' || !destination.trim()) return []
  const directory = resolve(destination)

  let names: string[]
  try {
    names = await readdir(directory)
  } catch {
    return []
  }

  const previews: BackupPreview[] = []
  for (const name of names) {
    if (!FILE_PATTERN.test(name)) continue
    try {
      const file = join(directory, name)
      const info = await stat(file)
      if (!info.isFile()) continue
      previews.push({
        file,
        fileName: name,
        size: info.size,
        createdAt: info.mtimeMs
      })
    } catch {
      // Skip files that disappear while the folder is being scanned.
    }
  }

  return previews.sort((a, b) => b.createdAt - a.createdAt).slice(0, 25)
}

export async function createBackup(input: unknown): Promise<BackupCreateResult> {
  if (!input || typeof input !== 'object') throw new Error('Invalid backup request.')
  const request = input as Partial<BackupCreateInput>

  const password = requirePassword(request.password, 8)
  const directory = resolveDestination(request.destination)

  await mkdir(directory, { recursive: true })

  const secrets = await exportSecretValues()
  const createdAt = Date.now()
  const payload: BackupPayload = {
    format: 'toolbox-backup',
    version: 1,
    createdAt,
    appVersion: APP_VERSION,
    config: sanitizeConfig(request.config),
    secrets
  }

  const bytes = await encryptPayload(payload, password)
  const file = await uniqueBackupFile(directory, createdAt)
  await writeFile(file, bytes, { mode: 0o600 })
  const info = await stat(file)

  return {
    file,
    fileName: basename(file),
    size: info.size,
    createdAt,
    secretCount: secrets.length
  }
}

export async function restoreBackup(input: unknown): Promise<BackupRestoreResult> {
  if (!input || typeof input !== 'object') throw new Error('Invalid restore request.')
  const request = input as Partial<BackupRestoreInput>

  const password = requirePassword(request.password, 1)
  if (typeof request.file !== 'string' || !request.file.trim()) {
    throw new Error('Choose a backup file to restore.')
  }

  const file = resolve(request.file)
  const info = await stat(file).catch(() => null)
  if (!info || !info.isFile()) throw new Error('That backup file no longer exists.')
  if (info.size > MAX_BACKUP_BYTES) throw new Error('That backup file is too large.')

  const payload = await decryptPayload(await readFile(file), password)
  const secretCount = await replaceSecretValues(payload.secrets)

  return {
    file,
    fileName: basename(file),
    createdAt: payload.createdAt,
    appVersion: payload.appVersion,
    secretCount,
    config: payload.config
  }
}
