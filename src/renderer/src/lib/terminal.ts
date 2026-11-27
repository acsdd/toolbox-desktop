import type { ToolDefinition } from '../tools/types'

export type TerminalCommand =
  | { kind: 'empty' }
  | { kind: 'help' }
  | { kind: 'clear' }
  | { kind: 'home' }
  | { kind: 'settings' }
  | { kind: 'status' }
  | { kind: 'open'; query: string }
  | { kind: 'unknown'; input: string }

export function parseTerminalCommand(input: string): TerminalCommand {
  const trimmed = input.trim()
  if (!trimmed) return { kind: 'empty' }

  const [name, ...args] = trimmed.split(/\s+/)
  switch (name.toLowerCase()) {
    case 'help':
      return { kind: 'help' }
    case 'clear':
      return { kind: 'clear' }
    case 'home':
      return { kind: 'home' }
    case 'settings':
      return { kind: 'settings' }
    case 'status':
      return { kind: 'status' }
    case 'open':
      return { kind: 'open', query: args.join(' ') }
    default:
      return { kind: 'unknown', input: trimmed }
  }
}

function normalizeToolQuery(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function findToolByQuery(
  available: ToolDefinition[],
  query: string
): ToolDefinition | undefined {
  const normalized = normalizeToolQuery(query)
  if (!normalized) return undefined

  return available.find((tool) => normalizeToolQuery(tool.id) === normalized)
    ?? available.find((tool) => normalizeToolQuery(tool.name) === normalized)
}
