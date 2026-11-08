import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { relativeTime } from '../../lib/format'
import type { ToolDefinition } from '../types'

interface Note {
  id: string
  body: string
  updatedAt: number
}

const STORAGE_KEY = 'toolbox.notes'

function createId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `note-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function newNote(): Note {
  return { id: createId(), body: '', updatedAt: Date.now() }
}

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== 'object') return false
  const note = value as Partial<Note>
  return (
    typeof note.id === 'string' &&
    typeof note.body === 'string' &&
    typeof note.updatedAt === 'number'
  )
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [newNote()]

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [newNote()]

    const notes = parsed.filter(isNote)
    return notes.length > 0 ? notes : [newNote()]
  } catch {
    return [newNote()]
  }
}

function noteTitle(body: string): string {
  const firstLine = body.split('\n').find((line) => line.trim())
  if (!firstLine) return 'Untitled note'
  const trimmed = firstLine.trim()
  return trimmed.length > 46 ? `${trimmed.slice(0, 46)}…` : trimmed
}

function NotesTool() {
  const [notes, setNotes] = useState<Note[]>(loadNotes)
  const [activeId, setActiveId] = useState<string>(() => notes[0]?.id ?? '')

  const active = notes.find((note) => note.id === activeId) ?? notes[0]

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
    }, 250)
    return () => clearTimeout(timer)
  }, [notes])

  useEffect(() => {
    if (!notes.some((note) => note.id === activeId) && notes[0]) {
      setActiveId(notes[0].id)
    }
  }, [notes, activeId])

  const updateBody = (body: string) => {
    if (!active) return
    setNotes((current) =>
      current.map((note) =>
        note.id === active.id ? { ...note, body, updatedAt: Date.now() } : note
      )
    )
  }

  const addNote = () => {
    const note = newNote()
    setNotes((current) => [note, ...current])
    setActiveId(note.id)
  }

  const deleteNote = (id: string) => {
    const remaining = notes.filter((note) => note.id !== id)
    if (remaining.length === 0) {
      const note = newNote()
      setNotes([note])
      setActiveId(note.id)
      return
    }
    setNotes(remaining)
    if (activeId === id) setActiveId(remaining[0].id)
  }

  const wordCount = active
    ? active.body.trim().split(/\s+/).filter(Boolean).length
    : 0

  return (
    <div className="notes-layout">
      <aside className="notes-sidebar">
        <div className="notes-sidebar-head">
          <span>
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </span>
          <button className="mini-button" onClick={addNote} title="New note">
            <Icon name="plus" size={14} />
            New
          </button>
        </div>

        <div className="notes-list">
          {notes.map((note) => (
            <button
              key={note.id}
              className={`note-item ${note.id === active?.id ? 'active' : ''}`}
              onClick={() => setActiveId(note.id)}
            >
              <strong>{noteTitle(note.body)}</strong>
              <span>{relativeTime(note.updatedAt)}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="note-editor">
        <div className="note-editor-head">
          <span>{active ? noteTitle(active.body) : 'Note'}</span>
          <div>
            <span className="muted-text">{wordCount} words · auto-saved</span>
            <button
              className="icon-button danger"
              title="Delete note"
              aria-label="Delete note"
              onClick={() => active && deleteNote(active.id)}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        </div>

        <textarea
          className="note-textarea"
          value={active?.body ?? ''}
          onChange={(event) => updateBody(event.target.value)}
          placeholder="Start typing. Notes are stored locally on this machine."
          spellCheck={false}
        />
      </div>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'notes',
  name: 'Quick notes',
  description: 'A fast scratchpad for thoughts, snippets, and stand-up notes. Saved locally, always there.',
  icon: 'notes',
  accent: '#5b8cff',
  order: 1,
  component: NotesTool
}
