export interface KitFolder { id: string; path: string }
export interface WorkspaceKit { id: string; name: string; folders: KitFolder[]; shortcutIds: string[] }
export interface KitEdit { id?: string; name: string; folderIds: string[]; shortcutIds: string[] }
export interface KitTarget { label: string; issue?: string }
export interface KitLaunch extends KitTarget { opened: boolean }
