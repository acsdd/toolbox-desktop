import { BrowserWindow, Notification } from 'electron'

export function focusMainWindow(): void {
  const window = BrowserWindow.getAllWindows()[0]
  if (!window || window.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

export function showDesktopNotification(title: string, body: string): boolean {
  if (!Notification.isSupported()) return false

  const notification = new Notification({ title, body, silent: false })
  notification.on('click', focusMainWindow)
  notification.show()
  return true
}
