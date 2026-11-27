const MAX_BYTES = 256 * 1024
const MAX_LINES = 5_000
const MAX_EDIT_DISTANCE = 512
const CONTEXT_LINES = 3
const utf8 = new TextEncoder()

export const TEXT_INPUT_LIMIT = '256 KiB and 5,000 lines per input'
export type TextInputIssue = 'bytes' | 'lines'

interface TextLine {
  text: string
  terminated: boolean
}

type Edit = 'context' | 'removed' | 'added'

export interface DiffLine extends TextLine {
  kind: Edit
  originalLine?: number
  modifiedLine?: number
}

export interface DiffHunk {
  originalStart: number
  originalCount: number
  modifiedStart: number
  modifiedCount: number
  lines: DiffLine[]
}

type TextComparison =
  | { kind: 'limit'; input: 'original' | 'modified'; issue: TextInputIssue }
  | { kind: 'identical' }
  | { kind: 'changed'; added: number; removed: number; simplified: boolean; hunks: DiffHunk[] }

export function textInputIssue(text: string): TextInputIssue | undefined {
  if (text.length > MAX_BYTES || utf8.encode(text).length > MAX_BYTES) return 'bytes'

  const last = text.at(-1)
  let lines = last !== undefined && last !== '\r' && last !== '\n' ? 1 : 0
  for (const _newline of text.matchAll(/\r\n|\r|\n/g)) {
    lines += 1
    if (lines > MAX_LINES) return 'lines'
  }
}

function splitLines(text: string): TextLine[] {
  if (!text) return []
  const lines = text.split(/\r\n|\r|\n/)
  const finalNewline = lines.at(-1) === ''
  if (finalNewline) lines.pop()
  return lines.map((line, index) => ({
    text: line,
    terminated: finalNewline || index < lines.length - 1
  }))
}

function usesInsertion(previous: Int32Array, index: number): boolean {
  return index === 0 || (index < previous.length && previous[index - 1] < previous[index])
}

function reconstructEdits(trace: Int32Array[], originalEnd: number, modifiedEnd: number): Edit[] {
  const reversed: Edit[] = []
  let original = originalEnd
  let modified = modifiedEnd

  for (let distance = trace.length; distance > 0; distance--) {
    const diagonal = original - modified
    const index = (distance + diagonal) / 2
    const previous = trace[distance - 1]
    const insertion = usesInsertion(previous, index)
    const previousDiagonal = diagonal + (insertion ? 1 : -1)
    const previousOriginal = previous[insertion ? index : index - 1]
    const previousModified = previousOriginal - previousDiagonal

    while (original > previousOriginal && modified > previousModified) {
      reversed.push('context')
      original--
      modified--
    }
    reversed.push(insertion ? 'added' : 'removed')
    original = previousOriginal
    modified = previousModified
  }

  while (original > 0) {
    reversed.push('context')
    original--
  }
  return reversed.reverse()
}

function findEdits(original: number[], modified: number[]): Edit[] | undefined {
  if (Math.abs(original.length - modified.length) > MAX_EDIT_DISTANCE) return undefined

  // Myers search. At each edit distance, keep the farthest original line on each
  // reachable diagonal. The edit cap bounds both the trace and work on each input.
  const trace: Int32Array[] = []
  for (let distance = 0; distance <= MAX_EDIT_DISTANCE; distance++) {
    const current = new Int32Array(distance + 1)
    const previous = trace[distance - 1]

    for (let index = 0; index <= distance; index++) {
      const diagonal = 2 * index - distance
      let originalIndex = 0
      if (previous) {
        originalIndex = usesInsertion(previous, index) ? previous[index] : previous[index - 1] + 1
      }
      let modifiedIndex = originalIndex - diagonal
      while (originalIndex < original.length && modifiedIndex < modified.length &&
        original[originalIndex] === modified[modifiedIndex]) {
        originalIndex++
        modifiedIndex++
      }

      if (originalIndex === original.length && modifiedIndex === modified.length) {
        return reconstructEdits(trace, originalIndex, modifiedIndex)
      }
      current[index] = originalIndex
    }
    trace.push(current)
  }
}

function hunkRanges(edits: Edit[]): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = []
  for (const [index, edit] of edits.entries()) {
    if (edit === 'context') continue
    const start = Math.max(0, index - CONTEXT_LINES)
    const end = Math.min(edits.length, index + CONTEXT_LINES + 1)
    const previous = ranges.at(-1)
    if (previous && start <= previous.end) previous.end = end
    else ranges.push({ start, end })
  }
  return ranges
}

function createHunks(edits: Edit[], original: TextLine[], modified: TextLine[]): DiffHunk[] {
  let originalIndex = 0
  let modifiedIndex = 0
  let previousEnd = 0

  return hunkRanges(edits).map(({ start, end }) => {
    const originalStart = originalIndex + start - previousEnd
    const modifiedStart = modifiedIndex + start - previousEnd
    originalIndex = originalStart
    modifiedIndex = modifiedStart
    previousEnd = end

    const lines = edits.slice(start, end).map((kind) => {
      const line = kind === 'added' ? modified[modifiedIndex] : original[originalIndex]
      return {
        ...line,
        kind,
        originalLine: kind === 'added' ? undefined : ++originalIndex,
        modifiedLine: kind === 'removed' ? undefined : ++modifiedIndex
      }
    })
    const originalCount = originalIndex - originalStart
    const modifiedCount = modifiedIndex - modifiedStart

    return {
      originalStart: originalStart + (originalCount === 0 ? 0 : 1),
      originalCount,
      modifiedStart: modifiedStart + (modifiedCount === 0 ? 0 : 1),
      modifiedCount,
      lines
    }
  })
}

export function compareText(originalText: string, modifiedText: string, ignoreWhitespace = false): TextComparison {
  const originalIssue = textInputIssue(originalText)
  if (originalIssue) return { kind: 'limit', input: 'original', issue: originalIssue }
  const modifiedIssue = textInputIssue(modifiedText)
  if (modifiedIssue) return { kind: 'limit', input: 'modified', issue: modifiedIssue }

  const original = splitLines(originalText)
  const modified = splitLines(modifiedText)
  const tokens = new Map<string, number>()
  const lineToken = ({ text, terminated }: TextLine) => {
    const key = (ignoreWhitespace ? text.replace(/\s/g, '') : text) + (terminated ? '\n' : '')
    const token = tokens.get(key) ?? tokens.size
    tokens.set(key, token)
    return token
  }
  const originalTokens = original.map(lineToken)
  const modifiedTokens = modified.map(lineToken)

  let start = 0
  while (start < original.length && start < modified.length && originalTokens[start] === modifiedTokens[start]) start++
  if (start === original.length && start === modified.length) return { kind: 'identical' }

  let originalEnd = original.length
  let modifiedEnd = modified.length
  while (originalEnd > start && modifiedEnd > start && originalTokens[originalEnd - 1] === modifiedTokens[modifiedEnd - 1]) {
    originalEnd--
    modifiedEnd--
  }

  const originalMiddle = originalEnd - start
  const modifiedMiddle = modifiedEnd - start
  const hasMiddleOnBothSides = originalMiddle > 0 && modifiedMiddle > 0
  const matched = hasMiddleOnBothSides
    ? findEdits(originalTokens.slice(start, originalEnd), modifiedTokens.slice(start, modifiedEnd))
    : undefined
  const middle = matched ?? [
    ...Array<Edit>(originalMiddle).fill('removed'),
    ...Array<Edit>(modifiedMiddle).fill('added')
  ]
  const edits: Edit[] = [
    ...Array<Edit>(start).fill('context'),
    ...middle,
    ...Array<Edit>(original.length - originalEnd).fill('context')
  ]

  let added = 0
  let removed = 0
  for (const edit of edits) {
    if (edit === 'added') added++
    if (edit === 'removed') removed++
  }

  return {
    kind: 'changed',
    added,
    removed,
    simplified: hasMiddleOnBothSides && matched === undefined,
    hunks: createHunks(edits, original, modified)
  }
}

export function formatDiffHunkHeader(hunk: DiffHunk): string {
  const range = (start: number, count: number) => count === 1 ? `${start}` : `${start},${count}`
  return `@@ -${range(hunk.originalStart, hunk.originalCount)} +${range(hunk.modifiedStart, hunk.modifiedCount)} @@`
}

export function formatUnifiedDiff(hunks: DiffHunk[]): string {
  if (!hunks.length) return ''
  const output = ['--- Original', '+++ Modified']
  const prefixes = { added: '+', removed: '-', context: ' ' }

  for (const hunk of hunks) {
    output.push(formatDiffHunkHeader(hunk))
    for (const line of hunk.lines) {
      output.push(prefixes[line.kind] + line.text)
      if (!line.terminated) output.push('\\ No newline at end of file')
    }
  }

  return output.join('\n') + '\n'
}
