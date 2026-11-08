import { access, mkdir, readdir, rename, stat } from 'node:fs/promises'
import { extname, isAbsolute, join, parse } from 'node:path'
import type { FileEntry, OrganizeResult } from '../../shared/types'

const CATEGORY_EXTENSIONS: Record<string, string[]> = {
  Images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'tif', 'tiff', 'ico'],
  Documents: ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'odt', 'ods', 'odp'],
  Video: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'],
  Audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'],
  Archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'],
  Installers: ['exe', 'msi', 'msix', 'appx', 'msu'],
  Code: ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'html', 'css', 'json', 'yml', 'yaml', 'xml', 'sh', 'ps1']
}

const CATEGORY_ORDER = ['Images', 'Documents', 'Video', 'Audio', 'Archives', 'Installers', 'Code', 'Other']

const EXTENSION_LOOKUP = new Map<string, string>()
for (const [category, extensions] of Object.entries(CATEGORY_EXTENSIONS)) {
  for (const extension of extensions) EXTENSION_LOOKUP.set(extension, category)
}

export function categorize(extension: string): string {
  return EXTENSION_LOOKUP.get(extension.toLowerCase()) ?? 'Other'
}

function verifiedFolder(dir: unknown): string {
  if (typeof dir !== 'string' || !dir.trim()) throw new Error('A folder path is required.')
  if (!isAbsolute(dir)) throw new Error('Folder path must be absolute.')

  const normalized = dir.replace(/[\\/]+$/, '')
  const root = parse(dir).root.replace(/[\\/]+$/, '')
  if (normalized.toLowerCase() === root.toLowerCase()) {
    throw new Error('Refusing to organize a drive root. Choose a folder inside a drive.')
  }
  return dir
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function uniqueTarget(directory: string, name: string): Promise<string> {
  let candidate = join(directory, name)
  if (!(await pathExists(candidate))) return candidate

  const extension = extname(name)
  const base = name.slice(0, name.length - extension.length)
  for (let index = 1; index < 10000; index++) {
    candidate = join(directory, `${base} (${index})${extension}`)
    if (!(await pathExists(candidate))) return candidate
  }
  throw new Error(`Could not find a free file name for ${name}.`)
}

export async function listFiles(dir: unknown): Promise<FileEntry[]> {
  const folder = verifiedFolder(dir)
  const entries = await readdir(folder, { withFileTypes: true })

  const results = await Promise.all(
    entries.map(async (entry): Promise<FileEntry | null> => {
      try {
        if (entry.isDirectory()) {
          return { name: entry.name, size: 0, ext: '', isDirectory: true, category: 'Folder' }
        }
        if (!entry.isFile()) return null

        const info = await stat(join(folder, entry.name))
        const extension = extname(entry.name).slice(1).toLowerCase()
        return {
          name: entry.name,
          size: info.size,
          ext: extension,
          isDirectory: false,
          category: categorize(extension)
        }
      } catch {
        return null
      }
    })
  )

  return results
    .filter((entry): entry is FileEntry => entry !== null)
    .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name))
}

export async function organizeFolder(dir: unknown): Promise<OrganizeResult> {
  const folder = verifiedFolder(dir)
  const entries = await readdir(folder, { withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile())
  const folderCount = entries.length - files.length

  if (files.length > 5000) {
    throw new Error('Too many files (limit 5000). Organize this folder in smaller batches.')
  }

  const counts = new Map<string, number>()
  const errors: string[] = []
  let moved = 0

  for (const file of files) {
    const extension = extname(file.name).slice(1).toLowerCase()
    const category = categorize(extension)
    try {
      const targetDirectory = join(folder, category)
      await mkdir(targetDirectory, { recursive: true })
      const target = await uniqueTarget(targetDirectory, file.name)
      await rename(join(folder, file.name), target)
      counts.set(category, (counts.get(category) ?? 0) + 1)
      moved++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${file.name}: ${message}`)
    }
  }

  const categories = CATEGORY_ORDER.filter((category) => counts.has(category)).map((category) => ({
    name: category,
    count: counts.get(category) ?? 0
  }))

  return { moved, skipped: folderCount, errors, categories }
}
