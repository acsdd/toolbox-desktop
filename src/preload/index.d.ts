import type { ToolboxApi } from '../shared/types'

declare global {
  interface Window {
    api: ToolboxApi
  }
}

export {}
