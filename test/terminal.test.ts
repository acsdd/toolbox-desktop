import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as terminal from '../src/renderer/src/lib/terminal.ts'
import type { ToolDefinition } from '../src/renderer/src/tools/types.ts'

function tool(id: string, name: string): ToolDefinition {
  return {
    id,
    name,
    description: name,
    icon: 'spark',
    accent: '#6e9bff',
    order: 1,
    component: () => null
  }
}

test('parses the supported Toolbox commands', () => {
  assert.deepEqual(terminal.parseTerminalCommand(' HELP '), { kind: 'help' })
  assert.deepEqual(terminal.parseTerminalCommand('clear'), { kind: 'clear' })
  assert.deepEqual(terminal.parseTerminalCommand('home'), { kind: 'home' })
  assert.deepEqual(terminal.parseTerminalCommand('settings'), { kind: 'settings' })
  assert.deepEqual(terminal.parseTerminalCommand('status'), { kind: 'status' })
  assert.deepEqual(terminal.parseTerminalCommand('open Model Farm'), {
    kind: 'open',
    query: 'Model Farm'
  })
  assert.deepEqual(terminal.parseTerminalCommand('open'), { kind: 'open', query: '' })
})

test('treats shell commands and blank input as unsupported input', () => {
  assert.deepEqual(terminal.parseTerminalCommand('dir'), { kind: 'unknown', input: 'dir' })
  assert.deepEqual(terminal.parseTerminalCommand('  '), { kind: 'empty' })
})

test('resolves an open command by tool id or normalized name', () => {
  const available = [tool('modelfarm', 'Model Farm'), tool('disk-explorer', 'Disk space explorer')]

  assert.equal(terminal.findToolByQuery(available, 'modelfarm')?.id, 'modelfarm')
  assert.equal(terminal.findToolByQuery(available, 'MODEL FARM')?.id, 'modelfarm')
  assert.equal(terminal.findToolByQuery(available, 'disk space explorer')?.id, 'disk-explorer')
  assert.equal(terminal.findToolByQuery(available, 'missing'), undefined)
})
