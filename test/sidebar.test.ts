import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as sidebar from '../src/renderer/src/lib/sidebar.ts'
import type { ToolDefinition } from '../src/renderer/src/tools/types.ts'

function tool(id: string): ToolDefinition {
  return {
    id,
    name: id,
    description: id,
    icon: 'spark',
    accent: '#6e9bff',
    order: 1,
    component: () => null
  }
}

test('groups the approved AI and IT tools in navigation order', () => {
  const groups = sidebar.groupSidebarTools([
    tool('vault'),
    tool('github'),
    tool('system'),
    tool('launchpad'),
    tool('runbooks'),
    tool('modelfarm'),
    tool('network-checks'),
    tool('ai-monitor'),
    tool('projects'),
    tool('integration'),
    tool('configuration'),
    tool('disk-explorer'),
    tool('clipboard'),
    tool('organizer'),
    tool('incident'),
    tool('nas-companion'),
    tool('backup')
  ])

  assert.deepEqual(
    groups.map((group) => ({ label: group.label, ids: group.tools.map((item) => item.id) })),
    [
      {
        label: 'AI',
        ids: ['launchpad', 'modelfarm', 'ai-monitor', 'github', 'projects']
      },
      {
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
    ]
  )
})

test('omits tools outside the approved navigation groups', () => {
  const groups = sidebar.groupSidebarTools([tool('notes'), tool('clock'), tool('system')])

  assert.deepEqual(
    groups.map((group) => group.tools.map((item) => item.id)),
    [[], ['system']]
  )
})
