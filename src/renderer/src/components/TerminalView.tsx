import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { HeaderStatus } from './HeaderStatus'
import { formatBytes, formatUptime } from '../lib/format'
import { findToolByQuery, parseTerminalCommand } from '../lib/terminal'
import type { ToolDefinition } from '../tools/types'

interface TerminalViewProps {
  tools: ToolDefinition[]
  onHome: () => void
  onSettings: () => void
  onOpenTool: (id: string) => void
  onOpenClock: () => void
}

interface TerminalEntry {
  id: number
  text: string
  tone: 'normal' | 'command' | 'error'
}

const INITIAL_ENTRIES: TerminalEntry[] = [
  { id: 0, text: 'Toolbox command bar ready.', tone: 'normal' },
  { id: 1, text: 'Navigate Toolbox here. Shell commands are not available.', tone: 'normal' },
  { id: 2, text: 'Type help to see what you can do.', tone: 'normal' }
]

const HELP = `Available commands
  help              Show this command list
  clear             Clear the output
  home              Open the dashboard
  settings          Open Manage tools
  open <tool>       Open a tool by name or id
  status            Show local system status`

export function TerminalView({
  tools,
  onHome,
  onSettings,
  onOpenTool,
  onOpenClock
}: TerminalViewProps) {
  const [entries, setEntries] = useState<TerminalEntry[]>(INITIAL_ENTRIES)
  const [input, setInput] = useState('')
  const nextId = useRef(INITIAL_ENTRIES.length)
  const history = useRef<string[]>([])
  const historyIndex = useRef(0)
  const draftBeforeHistory = useRef('')
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [entries])

  const append = useCallback((text: string, tone: TerminalEntry['tone'] = 'normal') => {
    const entry = { id: nextId.current++, text, tone }
    setEntries((current) => [...current, entry])
  }, [])

  const runCommand = async (raw: string) => {
    const value = raw.trim()
    if (!value) return

    history.current = [...history.current, value].slice(-50)
    historyIndex.current = history.current.length
    setInput('')

    const command = parseTerminalCommand(value)
    if (command.kind === 'empty') return
    if (command.kind === 'clear') {
      setEntries([])
      return
    }

    append(`$ ${value}`, 'command')

    switch (command.kind) {
      case 'help':
        append(HELP)
        break
      case 'home':
        onHome()
        break
      case 'settings':
        onSettings()
        break
      case 'open': {
        const tool = findToolByQuery(tools, command.query)
        if (!command.query) {
          append('Usage: open <tool>. Run help to see the available commands.', 'error')
        } else if (!tool) {
          append(`No visible tool matches “${command.query}”.`, 'error')
        } else {
          onOpenTool(tool.id)
        }
        break
      }
      case 'status':
        append('Reading local system status…')
        try {
          const stats = await window.api.system.stats()
          append(
            `CPU ${Math.round(stats.cpuPercent)}% · Memory ${formatBytes(stats.memUsed)} / ${formatBytes(stats.memTotal)}\n` +
              `Disk ${formatBytes(stats.diskFree)} free of ${formatBytes(stats.diskTotal)} · Uptime ${formatUptime(stats.uptime)}\n` +
              `${stats.hostname} · ${stats.platform}`
          )
        } catch (cause) {
          append(cause instanceof Error ? cause.message : String(cause), 'error')
        }
        break
      case 'unknown':
        append(`Unknown command “${command.input}”. This bar only runs Toolbox commands. Type help.`, 'error')
        break
    }
  }

  const handleHistoryKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()

    if (event.key === 'ArrowUp') {
      if (history.current.length === 0) return
      if (historyIndex.current === history.current.length) draftBeforeHistory.current = input
      historyIndex.current = Math.max(0, historyIndex.current - 1)
      setInput(history.current[historyIndex.current] ?? '')
      return
    }

    if (historyIndex.current >= history.current.length) return
    historyIndex.current += 1
    setInput(
      historyIndex.current === history.current.length
        ? draftBeforeHistory.current
        : history.current[historyIndex.current] ?? ''
    )
  }

  return (
    <div className="terminal-view">
      <div className="terminal-panel">
        <div className="terminal-chrome">
          <div className="terminal-title">
            <span className="terminal-signal" aria-hidden="true" />
            <div>
              <span className="terminal-eyebrow">Toolbox command bar</span>
              <strong>Local control, no shell</strong>
            </div>
          </div>
          <HeaderStatus className="terminal-status" onOpen={onOpenClock} />
        </div>

        <div className="terminal-output" ref={outputRef} role="log" aria-live="polite">
          {entries.map((entry) => (
            <div className={`terminal-entry ${entry.tone}`} key={entry.id}>
              {entry.text}
            </div>
          ))}
        </div>

        <form
          className="terminal-prompt"
          onSubmit={(event) => {
            event.preventDefault()
            void runCommand(input)
          }}
        >
          <span className="terminal-prompt-label">toolbox</span>
          <span className="terminal-prompt-mark" aria-hidden="true">›</span>
          <input
            ref={inputRef}
            className="terminal-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleHistoryKey}
            aria-label="Terminal command"
            placeholder="Type help or open <tool>"
            spellCheck={false}
            autoComplete="off"
          />
          <span className="terminal-enter">Enter</span>
        </form>
      </div>
    </div>
  )
}
