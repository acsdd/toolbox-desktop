import { useDeferredValue, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import {
  compareText,
  formatDiffHunkHeader,
  formatUnifiedDiff,
  textInputIssue,
  TEXT_INPUT_LIMIT,
  type DiffLine,
  type TextInputIssue
} from '../../lib/text-diff'
import type { ToolDefinition } from '../types'
import './text-compare.css'

const INPUTS = [
  { field: 'original', label: 'Original text' },
  { field: 'modified', label: 'Modified text' }
] as const
type TextField = (typeof INPUTS)[number]['field']
const LINE_LABELS = { context: 'Context', removed: 'Removed', added: 'Added' }
const ROWS_PER_PAGE = 200

function DiffRow({ line }: { line: DiffLine }) {
  return (
    <div className={`text-compare-line text-compare-line--${line.kind}`}>
      <span className="text-compare-line-number" title="Original line">{line.originalLine}</span>
      <span className="text-compare-line-number" title="Modified line">{line.modifiedLine}</span>
      <span className="text-compare-line-label">{LINE_LABELS[line.kind]}</span>
      <code>{line.text || ' '}</code>
      {!line.terminated && <span className="text-compare-newline">No newline at end of text</span>}
    </div>
  )
}

function TextCompareTool() {
  const id = useId()
  const [input, setInput] = useState({ original: '', modified: '', ignoreWhitespace: false })
  const [issues, setIssues] = useState<Partial<Record<TextField, TextInputIssue>>>({})
  const [page, setPage] = useState(0)
  const [copyStatus, setCopyStatus] = useState('')
  const copyRequest = useRef(0)
  const deferredInput = useDeferredValue(input)
  const comparing = input !== deferredInput
  const hasText = Boolean(input.original || input.modified)
  const comparison = useMemo(
    () => compareText(deferredInput.original, deferredInput.modified, deferredInput.ignoreWhitespace),
    [deferredInput]
  )
  const rows = useMemo(() => comparison.kind === 'changed'
    ? comparison.hunks.flatMap((hunk) => [
      { kind: 'header' as const, text: formatDiffHunkHeader(hunk) },
      ...hunk.lines
    ])
    : [], [comparison])
  const firstRow = page * ROWS_PER_PAGE
  const lastRow = Math.min(firstRow + ROWS_PER_PAGE, rows.length)

  function updateInput(changes: Partial<typeof input>) {
    setInput((previous) => ({ ...previous, ...changes }))
    setPage(0)
    setCopyStatus('')
    copyRequest.current++
  }

  function editText(field: TextField, text: string) {
    const issue = textInputIssue(text)
    setIssues((previous) => ({ ...previous, [field]: issue }))
    if (!issue) updateInput({ [field]: text })
  }

  function swapText() {
    updateInput({ original: input.modified, modified: input.original })
    setIssues({})
  }

  async function copyDiff() {
    if (comparing || comparison.kind !== 'changed') return
    const request = ++copyRequest.current
    setCopyStatus('')
    let message = 'Diff copied.'
    try {
      await navigator.clipboard.writeText(formatUnifiedDiff(comparison.hunks))
    } catch {
      message = 'Could not copy the diff to the clipboard.'
    }
    if (request === copyRequest.current) setCopyStatus(message)
  }

  let summary = 'Enter text to compare the two versions.'
  if (comparing) summary = 'Comparing…'
  else if (comparison.kind === 'changed') summary = `${comparison.added} added · ${comparison.removed} removed`
  else if (comparison.kind === 'limit') summary = `Each input is limited to ${TEXT_INPUT_LIMIT}.`
  else if (hasText) summary = input.ignoreWhitespace ? 'Texts match when ignoring whitespace.' : 'Texts are identical.'

  return (
    <div className="text-compare">
      <p className="muted-text" id={`${id}-limit`}>{TEXT_INPUT_LIMIT}</p>
      <div className="text-compare-inputs">
        {INPUTS.map(({ field, label }) => (
          <div key={field} className="text-compare-field">
            <label htmlFor={`${id}-${field}`}>{label}</label>
            <textarea
              id={`${id}-${field}`}
              aria-describedby={`${id}-limit${issues[field] ? ` ${id}-${field}-error` : ''}`}
              aria-invalid={Boolean(issues[field])}
              value={input[field]}
              onChange={(event) => editText(field, event.target.value)}
              placeholder={`Paste ${field} text`}
              wrap="off"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            {issues[field] && (
              <p className="text-compare-error" id={`${id}-${field}-error`} role="alert">
                {issues[field] === 'bytes' ? 'The input exceeds 256 KiB.' : 'The input exceeds 5,000 lines.'} Previous text kept.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="text-compare-controls">
        <button type="button" className="ghost-button" disabled={!hasText} onClick={swapText}>
          <Icon name="refresh" size={15} /> Swap texts
        </button>
        <label className="text-compare-option">
          <input
            type="checkbox"
            checked={input.ignoreWhitespace}
            onChange={(event) => updateInput({ ignoreWhitespace: event.target.checked })}
          />
          Ignore whitespace
        </label>
      </div>

      <section className="text-compare-result" aria-labelledby={`${id}-result`}>
        <div className="text-compare-result-head">
          <div>
            <h2 id={`${id}-result`}>Unified diff</h2>
            <p className="muted-text" role="status">{summary}</p>
          </div>
          <button type="button" className="primary-button" disabled={comparing || comparison.kind !== 'changed'} onClick={copyDiff}>
            <Icon name="copy" size={15} /> Copy diff
          </button>
        </div>
        <div className="text-compare-copy-status" role="status">{copyStatus}</div>
        {!comparing && comparison.kind === 'changed' && (
          <>
            {comparison.simplified && (
              <p className="muted-text">
                This comparison reached its edit limit. Some unchanged lines may appear as changes.
              </p>
            )}
            <div key={page} className="text-compare-preview" role="region" aria-label="Diff lines" tabIndex={0}>
              <div className="text-compare-rows">
                {rows.slice(firstRow, lastRow).map((row, index) => row.kind === 'header'
                  ? <div key={firstRow + index} className="text-compare-hunk"><code>{row.text}</code></div>
                  : <DiffRow key={firstRow + index} line={row} />)}
              </div>
            </div>
            {rows.length > ROWS_PER_PAGE && (
              <div className="text-compare-pages">
                <button type="button" className="ghost-button small" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                <p className="muted-text" role="status">Rows {firstRow + 1}–{lastRow} of {rows.length}</p>
                <button type="button" className="ghost-button small" disabled={lastRow === rows.length} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'text-compare',
  name: 'Text Compare',
  description: 'Compare two versions of text line by line and copy a unified diff.',
  icon: 'notes',
  accent: '#ad9cff',
  order: 30,
  page: 'workspace',
  component: TextCompareTool
}
