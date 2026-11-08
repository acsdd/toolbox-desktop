import type { ComponentType } from 'react'
import type { IconName } from '../components/Icon'

export type ToolPage = 'workspace' | 'connected'

export interface ToolDefinition {
  id: string
  name: string
  description: string
  icon: IconName
  accent: string
  order: number
  page?: ToolPage
  /** Opens as a full-window page instead of inside the standard tool surface. */
  fullPage?: boolean
  component: ComponentType
  userTool?: boolean
}
