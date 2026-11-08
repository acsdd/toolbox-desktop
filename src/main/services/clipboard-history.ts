import { clipboard } from 'electron'
import { randomUUID } from 'node:crypto'
import type { ClipItem } from '../../shared/types'

const MAX_ITEMS = 60
const POLL_MS = 800

class ClipboardHistory {
  private items: ClipItem[] = []
  private lastText = ''
  private timer: ReturnType<typeof setInterval> | null = null
  private starting = false
  private stopped = false

  start(): void {
    if (this.timer || this.starting) return
    this.stopped = false
    this.starting = true
    void this.initialize()
  }

  private async initialize(): Promise<void> {
    // Adopt whatever is already on the clipboard as the baseline instead of
    // ingesting it. This keeps secrets copied by an earlier session (e.g. from
    // the vault) out of history after a restart.
    this.lastText = await clipboard.readText().catch(() => '')
    this.starting = false
    if (this.stopped) return
    this.timer = setInterval(() => void this.capture(), POLL_MS)
  }

  stop(): void {
    this.stopped = true
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  list(): ClipItem[] {
    return this.items
  }

  async copy(text: string): Promise<void> {
    if (typeof text !== 'string' || !text) return
    // Mark before writing so the poller can never capture this value mid-write.
    this.lastText = text
    await clipboard.writeText(text)
    this.items = [
      { id: randomUUID(), text, at: Date.now() },
      ...this.items.filter((item) => item.text !== text)
    ].slice(0, MAX_ITEMS)
  }

  /** Copies a secret to the clipboard without recording it in history. */
  async copySecret(text: string): Promise<void> {
    if (typeof text !== 'string' || !text) return
    this.lastText = text
    await clipboard.writeText(text)
  }

  clear(): void {
    this.items = []
  }

  private async capture(): Promise<void> {
    const text = await clipboard.readText().catch(() => '')
    if (!text || !text.trim() || text === this.lastText) return
    this.lastText = text
    this.items = [
      { id: randomUUID(), text, at: Date.now() },
      ...this.items.filter((item) => item.text !== text)
    ].slice(0, MAX_ITEMS)
  }
}

export const clipboardHistory = new ClipboardHistory()
