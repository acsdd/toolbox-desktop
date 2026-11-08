import { useEffect, useRef, useState } from 'react'
import * as React from 'react'
import type { ClipItem, SystemStats, UserToolMeta } from '@shared/types'

export interface UserToolContext {
  id: string
  accent: string
  version: string
  storage: {
    get(key: string): string | null
    set(key: string, value: string): void
    remove(key: string): void
  }
  clipboard: {
    list(): Promise<ClipItem[]>
    copy(text: string): Promise<void>
  }
  system: {
    stats(): Promise<SystemStats>
  }
  h: typeof React.createElement
  React: typeof React
}

interface UserToolModule {
  mount?: (root: HTMLElement, ctx: UserToolContext) => unknown
}

function createContext(tool: UserToolMeta): UserToolContext {
  const prefix = `usertool.${tool.id}.`

  return {
    id: tool.id,
    accent: tool.accent,
    version: '0.3.0',
    storage: {
      get: (key) => localStorage.getItem(prefix + key),
      set: (key, value) => localStorage.setItem(prefix + key, value),
      remove: (key) => localStorage.removeItem(prefix + key)
    },
    clipboard: {
      list: () => window.api.clipboard.list(),
      copy: (text) => window.api.clipboard.copy(text)
    },
    system: {
      stats: () => window.api.system.stats()
    },
    h: React.createElement,
    React
  }
}

interface UserToolViewProps {
  tool: UserToolMeta
}

export function UserToolView({ tool }: UserToolViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | undefined

    const run = async () => {
      setLoading(true)
      setError(null)

      try {
        const code = await window.api.userTools.code(tool.id)
        if (cancelled) return

        const objectUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
        try {
          const module = (await import(/* @vite-ignore */ objectUrl)) as UserToolModule
          if (typeof module.mount !== 'function') {
            throw new Error('index.js must export a mount(root, ctx) function.')
          }

          const host = hostRef.current
          if (!host || cancelled) return

          host.innerHTML = ''
          const result = module.mount(host, createContext(tool))
          if (typeof result === 'function') {
            cleanup = result as () => void
          }
          setLoading(false)
        } finally {
          URL.revokeObjectURL(objectUrl)
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause))
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
      try {
        cleanup?.()
      } catch {
        // A tool's cleanup must never break navigation.
      }
    }
  }, [tool.id])

  return (
    <div className="user-tool-view">
      <div className="user-tool-banner">
        <span className="user-tool-tag">Installed tool</span>
        <span className="muted-text">{tool.id}</span>
      </div>

      {error && <div className="result-banner warn">Could not load this tool: {error}</div>}
      {loading && <p className="hint">Loading tool…</p>}

      <div ref={hostRef} className="user-tool-host" />
    </div>
  )
}
