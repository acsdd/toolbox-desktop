import { useEffect, useMemo, useRef, useState } from 'react'
import { rankTools } from '../lib/tool-search'

interface FinderTool { id: string; name: string; description?: string }
export function ToolFinder({ tools, onOpen, onClose }: { tools: readonly FinderTool[]; onOpen(id: string): void; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const matches = useMemo(() => rankTools(query, tools), [query, tools])
  const index = Math.min(selected, Math.max(0, matches.length - 1))
  useEffect(() => {
    const invoker = document.activeElement as HTMLElement | null
    const node = dialog.current!
    node.showModal()
    node.querySelector('input')?.focus()
    return () => { node.close(); invoker?.focus() }
  }, [])
  useEffect(() => { dialog.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [index, query])
  function choose(id: string) { onClose(); onOpen(id) }
  return <dialog ref={dialog} className="tool-finder" aria-labelledby="tool-finder-title" onCancel={event => { event.preventDefault(); onClose() }} onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected(value => matches.length ? (value + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length : 0)
    }
    if (event.key === 'Enter' && matches[index]) { event.preventDefault(); choose(matches[index].id) }
  }}>
    <div className="tool-finder-heading"><h2 id="tool-finder-title">Find a tool</h2><button className="ghost-button" onClick={onClose} aria-label="Close tool finder">Close</button></div>
    <input aria-label="Search tools" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="tool-finder-results" aria-activedescendant={matches[index] ? `finder-${matches[index].id}` : undefined} value={query} onChange={event => { setQuery(event.target.value); setSelected(0) }} placeholder="Search tools…" />
    <p className="hint">Arrow keys to select · Enter to open · Escape to close</p>
    <div id="tool-finder-results" role="listbox" aria-label="Matching tools">{matches.map((tool, itemIndex) => <div role="option" id={`finder-${tool.id}`} key={tool.id} aria-selected={index === itemIndex} onMouseDown={event => event.preventDefault()} onClick={() => choose(tool.id)}><strong>{tool.name}</strong><span>{tool.description}</span></div>)}</div>
    {!matches.length && <p role="status">No tools found.</p>}
  </dialog>
}
