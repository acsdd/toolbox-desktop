import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareText, formatUnifiedDiff, textInputIssue } from '../src/renderer/src/lib/text-diff.ts'

test('compares Windows, Unix and standalone CR line endings consistently', () => {
  const result = compareText('one\r\ntwo\rthree\r\n', 'one\ntwo\nthree\n')

  assert.equal(result.kind, 'identical')
})

test('ignores whitespace within lines only when requested', () => {
  const original = '  a  b\t\nnext\n'
  const modified = 'ab\nnext\n'

  assert.equal(compareText(original, modified).kind, 'changed')
  assert.equal(compareText(original, modified, true).kind, 'identical')
  assert.equal(compareText('a\nb\n', 'ab\n', true).kind, 'changed')
})

test('prints a unified hunk with context and signed changes', () => {
  const result = compareText('first\nold\nthird\n', 'first\nnew\nthird\nlast\n')

  assert.equal(result.kind, 'changed')
  assert.equal(result.added, 2)
  assert.equal(result.removed, 1)
  assert.deepEqual(result.hunks[0].lines.map(({ kind, originalLine, modifiedLine }) => [kind, originalLine, modifiedLine]), [
    ['context', 1, 1],
    ['removed', 2, undefined],
    ['added', undefined, 2],
    ['context', 3, 3],
    ['added', undefined, 4]
  ])
  assert.equal(formatUnifiedDiff(result.hunks), [
    '--- Original',
    '+++ Modified',
    '@@ -1,3 +1,4 @@',
    ' first',
    '-old',
    '+new',
    ' third',
    '+last',
    ''
  ].join('\n'))
})

test('creates a patch for insertion before the first line of an empty input', () => {
  const result = compareText('', 'new\n')

  assert.equal(result.kind, 'changed')
  assert.match(formatUnifiedDiff(result.hunks), /\n@@ -0,0 \+1 @@\n\+new\n$/)
})

test('reports a change in whether the final line ends with a newline', () => {
  const result = compareText('line', 'line\n')

  assert.equal(result.kind, 'changed')
  assert.match(formatUnifiedDiff(result.hunks), /\n-line\n\\ No newline at end of file\n\+line\n$/)
})

test('rejects text larger than 256 KiB in UTF-8', () => {
  assert.equal(textInputIssue('é'.repeat(128 * 1024)), undefined)
  assert.equal(textInputIssue('é'.repeat(128 * 1024) + 'x'), 'bytes')
})

test('rejects a 5001st line even when all lines are blank', () => {
  assert.equal(textInputIssue('\r\n'.repeat(5_000)), undefined)
  assert.equal(textInputIssue('\r\n'.repeat(5_000) + 'x'), 'lines')
  assert.deepEqual(compareText('hello', '\n'.repeat(5_001)), {
    kind: 'limit', input: 'modified', issue: 'lines'
  })
})

test('keeps separated edits in their own hunks even in a long input', () => {
  const context = Array.from({ length: 4_998 }, (_, index) => `same ${index}\n`).join('')
  const result = compareText(`old\n${context}old again\n`, `new\n${context}new again\n`)

  assert.equal(result.kind, 'changed')
  assert.equal(result.simplified, false)
  assert.equal(result.hunks.length, 2)
  assert.match(formatUnifiedDiff(result.hunks), /@@ -4997,4 \+4997,4 @@\n/)
})

test('simplifies the changed region when the edit search hits its budget', () => {
  const result = compareText('start\n' + 'old\n'.repeat(4_998) + 'end\n', 'start\n' + 'new\n'.repeat(4_998) + 'end\n')

  assert.equal(result.kind, 'changed')
  assert.equal(result.simplified, true)
  assert.equal(result.added, 4_998)
  assert.equal(result.removed, 4_998)
  assert.equal(result.hunks[0].lines[0].kind, 'context')
  assert.equal(result.hunks[0].lines.at(-1)?.kind, 'context')
})
