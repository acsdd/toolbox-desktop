import type { ToolDefinition } from '../tools/types'

export interface SidebarGroup {
  id: 'ai' | 'it'
  label: string
  tools: ToolDefinition[]
}

const GROUPS = [
  {
    id: 'ai',
    label: 'AI',
    ids: ['launchpad', 'modelfarm', 'ai-monitor', 'github', 'projects']
  },
  {
    id: 'it',
    label: 'IT',
    ids: [
      'system',
      'network-checks',
      'disk-explorer',
      'configuration',
      'clipboard',
      'organizer',
      'runbooks',
      'incident',
      'integration',
      'nas-companion',
      'vault',
      'backup'
    ]
  }
] as const

export function groupSidebarTools(available: ToolDefinition[]): SidebarGroup[] {
  const byId = new Map(available.map((tool) => [tool.id, tool]))

  return GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    tools: group.ids.flatMap((id) => {
      const tool = byId.get(id)
      return tool ? [tool] : []
    })
  }))
}
