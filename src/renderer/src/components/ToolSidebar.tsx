import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from './Icon'
import { groupSidebarTools } from '../lib/sidebar'
import type { ToolDefinition } from '../tools/types'

interface ToolSidebarProps {
  tools: ToolDefinition[]
  activeId: string | null
  onHome: () => void
  onManage: () => void
  onOpen: (id: string) => void
}

export function ToolSidebar({ tools, activeId, onHome, onManage, onOpen }: ToolSidebarProps) {
  const groups = useMemo(() => groupSidebarTools(tools), [tools])

  return (
    <nav className="tool-sidebar" aria-label="Toolbox navigation">
      <button
        className={`sidebar-tool sidebar-home ${activeId === 'home' ? 'active' : ''}`}
        onClick={onHome}
        title="Home"
        aria-label="Home"
        aria-current={activeId === 'home' ? 'page' : undefined}
      >
        <Icon name="grid" size={18} />
      </button>

      <div className="sidebar-groups">
        {groups.map((group) => (
          <section className="sidebar-group" key={group.id} aria-label={`${group.label} tools`}>
            <span className="sidebar-group-label">{group.label}</span>
            <div className="sidebar-tools">
              {group.tools.map((tool) => (
                <button
                  key={tool.id}
                  className={`sidebar-tool ${activeId === tool.id ? 'active' : ''}`}
                  style={{ '--accent': tool.accent } as CSSProperties}
                  onClick={() => onOpen(tool.id)}
                  title={tool.name}
                  aria-label={tool.name}
                  aria-current={activeId === tool.id ? 'page' : undefined}
                >
                  <Icon name={tool.icon} size={18} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <button
        className={`sidebar-tool sidebar-manage ${activeId === 'settings' ? 'active' : ''}`}
        onClick={onManage}
        title="Manage tools"
        aria-label="Manage tools"
        aria-current={activeId === 'settings' ? 'page' : undefined}
      >
        <Icon name="settings" size={18} />
      </button>
    </nav>
  )
}
