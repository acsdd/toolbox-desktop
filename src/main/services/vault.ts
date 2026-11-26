import { app, safeStorage } from 'electron'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type { VaultEntry, VaultInput } from '../../shared/types'
import { clipboardHistory } from './clipboard-history'

export interface VaultExportEntry {
  id: string
  name: string
  notes: string
  updatedAt: number
  value: string
}

interface StoredEntry {
  id: string
  name: string
  notes: string
  updatedAt: number
  secret: string
}

interface VaultFile {
  version: 1
  entries: StoredEntry[]
}

let cache: VaultFile | null = null

function vaultPath(): string {
  return join(app.getPath('userData'), 'vault.json')
}

function isStoredEntry(value: unknown): value is StoredEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<StoredEntry>
  return (
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.notes === 'string' &&
    typeof entry.updatedAt === 'number' &&
    typeof entry.secret === 'string'
  )
}

async function load(): Promise<VaultFile> {
  if (cache) return cache

  try {
    const raw = await readFile(vaultPath(), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    const entries = (parsed as VaultFile)?.entries
    cache = {
      version: 1,
      entries: Array.isArray(entries) ? entries.filter(isStoredEntry) : []
    }
  } catch {
    cache = { version: 1, entries: [] }
  }
  return cache
}

async function writeVault(target: string, data: VaultFile): Promise<void> {
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 })
}

async function persist(data: VaultFile): Promise<void> {
  await writeVault(vaultPath(), data)
  cache = data
}

async function requireEncryption(): Promise<void> {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error('Windows encryption is unavailable, so secrets cannot be stored safely.')
  }
}

function toPublicEntry(entry: StoredEntry): VaultEntry {
  return {
    id: entry.id,
    name: entry.name,
    notes: entry.notes,
    updatedAt: entry.updatedAt
  }
}

export async function listSecrets(): Promise<VaultEntry[]> {
  const data = await load()
  return data.entries.map(toPublicEntry)
}

export async function addSecret(input: unknown): Promise<VaultEntry> {
  await requireEncryption()

  if (!input || typeof input !== 'object') throw new Error('Invalid secret payload.')
  const { name, value, notes } = input as Partial<VaultInput>

  const trimmedName = typeof name === 'string' ? name.trim() : ''
  if (!trimmedName) throw new Error('Give the secret a name.')
  if (trimmedName.length > 80) throw new Error('Name must be 80 characters or fewer.')
  if (typeof value !== 'string' || !value) throw new Error('The secret value cannot be empty.')
  if (value.length > 20000) throw new Error('Secret value is too large (20,000 characters max).')

  const entry: StoredEntry = {
    id: randomUUID(),
    name: trimmedName,
    notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : '',
    updatedAt: Date.now(),
    secret: (await safeStorage.encryptStringAsync(value)).toString('base64')
  }

  const data = await load()
  await persist({ version: 1, entries: [entry, ...data.entries] })
  return toPublicEntry(entry)
}

export async function copySecret(id: unknown): Promise<void> {
  if (typeof id !== 'string') throw new Error('Invalid secret id.')
  await requireEncryption()

  const data = await load()
  const entry = data.entries.find((item) => item.id === id)
  if (!entry) throw new Error('Secret not found.')

  const decrypted = await safeStorage.decryptStringAsync(Buffer.from(entry.secret, 'base64'))
  const value = decrypted.result

  // Windows rotated the master key — upgrade the stored ciphertext.
  if (decrypted.shouldReEncrypt) {
    const reEncrypted = await safeStorage.encryptStringAsync(value)
    entry.secret = reEncrypted.toString('base64')
    entry.updatedAt = Date.now()
    await persist(data)
  }

  await clipboardHistory.copySecret(value)
}

export async function removeSecret(id: unknown): Promise<void> {
  if (typeof id !== 'string') throw new Error('Invalid secret id.')

  const data = await load()
  const entries = data.entries.filter((entry) => entry.id !== id)
  if (entries.length === data.entries.length) throw new Error('Secret not found.')

  await persist({ version: 1, entries })
}

/**
 * Decrypts every secret so it can be re-encrypted with a user password for a
 * backup. The plaintext only lives in memory for the duration of the export.
 */
export async function exportSecretValues(): Promise<VaultExportEntry[]> {
  await requireEncryption()

  const data = await load()
  const exported: VaultExportEntry[] = []
  let reEncrypted = false

  for (const entry of data.entries) {
    let value: string
    try {
      const decrypted = await safeStorage.decryptStringAsync(Buffer.from(entry.secret, 'base64'))
      value = decrypted.result
      if (decrypted.shouldReEncrypt) {
        entry.secret = (await safeStorage.encryptStringAsync(value)).toString('base64')
        reEncrypted = true
      }
    } catch {
      throw new Error(
        `"${entry.name}" cannot be decrypted with this Windows account. Restore that secret before backing up.`
      )
    }

    exported.push({
      id: entry.id,
      name: entry.name,
      notes: entry.notes,
      updatedAt: entry.updatedAt,
      value
    })
  }

  if (reEncrypted) await persist(data)
  return exported
}

/**
 * Replaces the local vault with secrets from a backup. Entries are re-encrypted
 * with this machine's Windows DPAPI key, so a backup stays portable across PCs.
 */
async function prepareSecretValues(input: unknown): Promise<StoredEntry[]> {
  await requireEncryption()

  if (!Array.isArray(input)) throw new Error('The backup secrets are malformed.')
  if (input.length > 2000) throw new Error('The backup contains too many secrets.')

  const entries: StoredEntry[] = []
  const ids = new Set<string>()
  let totalChars = 0

  for (const item of input) {
    if (!item || typeof item !== 'object') throw new Error('The backup secrets are malformed.')
    const source = item as Partial<VaultExportEntry>

    const name = typeof source.name === 'string' ? source.name.trim() : ''
    if (!name) throw new Error('A backup secret is missing its name.')
    if (name.length > 80) throw new Error('A backup secret name is too long.')

    if (typeof source.value !== 'string' || !source.value) {
      throw new Error(`The secret "${name}" has no value.`)
    }
    if (source.value.length > 20000) throw new Error(`The secret "${name}" is too large.`)

    totalChars += source.value.length
    if (totalChars > 4_000_000) throw new Error('The backup secrets are too large.')

    let id =
      typeof source.id === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(source.id)
        ? source.id
        : randomUUID()
    if (ids.has(id)) id = randomUUID()
    ids.add(id)

    entries.push({
      id,
      name,
      notes: typeof source.notes === 'string' ? source.notes.trim().slice(0, 500) : '',
      updatedAt:
        typeof source.updatedAt === 'number' && Number.isFinite(source.updatedAt)
          ? source.updatedAt
          : Date.now(),
      secret: (await safeStorage.encryptStringAsync(source.value)).toString('base64')
    })
  }

  return entries
}

export async function verifySecretValues(input: unknown): Promise<number> {
  const entries = await prepareSecretValues(input)
  const source = input as VaultExportEntry[]
  const directory = await mkdtemp(join(tmpdir(), 'toolbox-restore-check-'))
  try {
    const file = join(directory, 'vault.json')
    await writeVault(file, { version: 1, entries })
    const restored: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (!restored || typeof restored !== 'object' || (restored as VaultFile).version !== 1 || !Array.isArray((restored as VaultFile).entries)) throw new Error('The test restore could not be read.')
    const readEntries = (restored as VaultFile).entries
    if (readEntries.length !== entries.length || !readEntries.every(isStoredEntry)) throw new Error('The test restore is incomplete.')
    for (let index = 0; index < readEntries.length; index++) {
      const decoded = await safeStorage.decryptStringAsync(Buffer.from(readEntries[index].secret, 'base64'))
      if (decoded.result !== source[index].value || readEntries[index].id !== entries[index].id || readEntries[index].name !== entries[index].name || readEntries[index].notes !== entries[index].notes || readEntries[index].updatedAt !== entries[index].updatedAt) throw new Error('Could not verify the test restore.')
    }
    return readEntries.length
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export async function replaceSecretValues(input: unknown): Promise<number> {
  const entries = await prepareSecretValues(input)

  // Keep a local safety copy of the previous vault before replacing it.
  try {
    await copyFile(vaultPath(), `${vaultPath()}.bak`)
  } catch {
    // No previous vault file to preserve.
  }

  await persist({ version: 1, entries })
  return entries.length
}
