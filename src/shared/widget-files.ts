export interface InboxItem {
  name: string
  size: number
  modifiedAt: number
  category: string
}

export interface InboxSnapshot {
  folder: string
  readAt: number
  items: InboxItem[]
  partial: boolean
  skipped: number
}

export interface VerificationFile { id: string; name: string; size: number }
export type VerificationProgress = { bytes: number; total: number }
export type DigestComparison = 'match' | 'mismatch' | 'invalid' | 'empty'

export function compareDigest(actual: string, expected: string): DigestComparison {
  const value = expected.trim().toLowerCase()
  if (!value) return 'empty'
  if (!/^[a-f0-9]{64}$/.test(value)) return 'invalid'
  return actual === value ? 'match' : 'mismatch'
}
