import type { ToolDefinition } from './types'

/**
 * Tools are discovered at build time: every `tools/<id>/index.tsx` that exports a
 * `manifest` is registered automatically. Adding a tool means adding a folder —
 * the shell never needs to know about it.
 */
const modules = import.meta.glob<{ manifest: ToolDefinition }>('./*/index.tsx', {
  eager: true
})

export const tools: ToolDefinition[] = Object.values(modules)
  .map((module) => module.manifest)
  .filter((manifest): manifest is ToolDefinition => Boolean(manifest))
  .sort((a, b) => a.order - b.order)

export function getTool(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id)
}
