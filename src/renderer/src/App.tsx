import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { UserToolError, UserToolMeta } from '@shared/types'
import type { UpdateCheckResult } from '@shared/types'
import { Icon } from './components/Icon'
import type { IconName } from './components/Icon'
import { HeaderStatus } from './components/HeaderStatus'
import { PlayerButton } from './components/PlayerButton'
import { tools } from './tools/registry'
import type { ToolDefinition } from './tools/types'
import { UserToolView } from './user-tools/UserToolView'
import { ArtistWavePage } from './tools/artistwave/ArtistWavePage'
import {
  CARD_SIZE_KEY,
  COMPACT_KEY,
  CONFIG_RESTORED_EVENT,
  DISABLED_KEY,
  HOME_PAGE_KEY,
  LEGACY_ENABLED_KEY,
  PINNED_KEY,
  UPDATE_SOURCE_KEY,
  readCardSize,
  readHomePage,
  readUpdateSource
} from './lib/preferences'
import type { CardSize, HomePage } from './lib/preferences'
import { relativeTime } from './lib/format'

const BUILT_IN_IDS = tools.map((tool) => tool.id)

const CARD_SIZES: { id: CardSize; label: string; icon: number }[] = [
  { id: 'small', label: 'Small cards', icon: 12 },
  { id: 'medium', label: 'Default card size', icon: 14 },
  { id: 'large', label: 'Large cards', icon: 16 }
]

type View =
  | { kind: 'home' }
  | { kind: 'tool'; id: string }
  | { kind: 'settings' }
  | { kind: 'player' }

interface UpdateLookup {
  checking: boolean
  error: string | null
  result: UpdateCheckResult | null
}

function toolPage(tool: ToolDefinition): HomePage {
  return tool.page === 'connected' ? 'connected' : 'workspace'
}

function accentStyle(accent: string): CSSProperties {
  return { '--accent': accent } as CSSProperties
}

function loadDisabled(): string[] {
  try {
    const raw = localStorage.getItem(DISABLED_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === 'string')
      }
    }
  } catch {
    // Fall through to defaults.
  }

  // Migrate the v0.1 allowlist format to the opt-out format.
  try {
    const legacy = localStorage.getItem(LEGACY_ENABLED_KEY)
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy)
      localStorage.removeItem(LEGACY_ENABLED_KEY)
      if (Array.isArray(parsed)) {
        const enabled = new Set(parsed.filter((id): id is string => typeof id === 'string'))
        return BUILT_IN_IDS.filter((id) => !enabled.has(id))
      }
    }
  } catch {
    // Ignore malformed legacy state.
  }

  return []
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function App() {
  const [view, setView] = useState<View>({ kind: 'home' })
  const [playerStarted, setPlayerStarted] = useState(false)
  const [disabled, setDisabled] = useState<string[]>(loadDisabled)
  const [userTools, setUserTools] = useState<UserToolMeta[]>([])
  const [userToolErrors, setUserToolErrors] = useState<UserToolError[]>([])
  const [userToolsLoaded, setUserToolsLoaded] = useState(false)
  const [compact, setCompact] = useState(() => localStorage.getItem(COMPACT_KEY) === '1')
  const [pinned, setPinned] = useState(() => localStorage.getItem(PINNED_KEY) === '1')
  const [cardSize, setCardSize] = useState<CardSize>(readCardSize)
  const [homePage, setHomePage] = useState<HomePage>(readHomePage)
  const [appVersion, setAppVersion] = useState('')
  const [updateSource, setUpdateSource] = useState(readUpdateSource)
  const [update, setUpdate] = useState<UpdateLookup>({
    checking: false,
    error: null,
    result: null
  })
  const compactApplied = useRef(false)

  useEffect(() => {
    localStorage.setItem(DISABLED_KEY, JSON.stringify(disabled))
  }, [disabled])

  useEffect(() => {
    localStorage.setItem(COMPACT_KEY, compact ? '1' : '0')
  }, [compact])

  useEffect(() => {
    localStorage.setItem(PINNED_KEY, pinned ? '1' : '0')
    void window.api.appWindow.setAlwaysOnTop(pinned).catch(() => {})
  }, [pinned])

  useEffect(() => {
    localStorage.setItem(CARD_SIZE_KEY, cardSize)
  }, [cardSize])

  useEffect(() => {
    localStorage.setItem(HOME_PAGE_KEY, homePage)
  }, [homePage])

  useEffect(() => {
    localStorage.setItem(UPDATE_SOURCE_KEY, updateSource)
  }, [updateSource])

  useEffect(() => {
    void window.api.updates
      .version()
      .then(setAppVersion)
      .catch(() => {})
  }, [])

  const checkUpdates = useCallback(async (source: string, silent = false) => {
    const trimmed = source.trim()
    if (!trimmed) {
      if (!silent) {
        setUpdate({ checking: false, error: 'Add a release source first.', result: null })
      }
      return
    }

    setUpdate((current) => ({
      checking: true,
      error: silent ? current.error : null,
      result: current.result
    }))
    try {
      const result = await window.api.updates.check(trimmed)
      setUpdate({ checking: false, error: null, result })
    } catch (cause) {
      setUpdate((current) => ({
        checking: false,
        error: errorMessage(cause),
        result: silent ? current.result : null
      }))
    }
  }, [])

  useEffect(() => {
    const saved = readUpdateSource()
    if (!saved) return
    const timer = setTimeout(() => void checkUpdates(saved, true), 2500)
    return () => clearTimeout(timer)
  }, [checkUpdates])

  const openUpdate = useCallback((url: string) => {
    void window.api.updates.open(url).catch((cause) => {
      setUpdate((current) => ({ ...current, error: errorMessage(cause) }))
    })
  }, [])

  useEffect(() => {
    const onConfigRestored = () => {
      setDisabled(loadDisabled())
      setPinned(localStorage.getItem(PINNED_KEY) === '1')
      setCardSize(readCardSize())
    }
    window.addEventListener(CONFIG_RESTORED_EVENT, onConfigRestored)
    return () => window.removeEventListener(CONFIG_RESTORED_EVENT, onConfigRestored)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (compact) setCompact(false)
      else setView({ kind: 'home' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [compact])

  const loadUserTools = useCallback(async () => {
    try {
      const scan = await window.api.userTools.list()
      setUserTools(scan.tools)
      setUserToolErrors(scan.errors)
    } catch (cause) {
      setUserToolErrors([{ folder: '(scan)', message: errorMessage(cause) }])
    } finally {
      setUserToolsLoaded(true)
    }
  }, [])

  useEffect(() => {
    void loadUserTools()
  }, [loadUserTools])

  const allTools = useMemo<ToolDefinition[]>(() => {
    const installed = userTools.map((meta, index) => ({
      id: meta.id,
      name: meta.name,
      description: meta.description,
      icon: meta.icon as IconName,
      accent: meta.accent,
      order: 100 + index,
      userTool: true,
      component: () => <UserToolView tool={meta} />
    }))

    return [...tools, ...installed]
  }, [userTools])

  const visibleTools = useMemo(
    () => allTools.filter((tool) => !disabled.includes(tool.id)),
    [allTools, disabled]
  )

  const pageCounts = useMemo(
    () => ({
      workspace: visibleTools.filter((tool) => toolPage(tool) === 'workspace').length,
      connected: visibleTools.filter((tool) => toolPage(tool) === 'connected').length
    }),
    [visibleTools]
  )

  const pageTools = useMemo(
    () => visibleTools.filter((tool) => toolPage(tool) === homePage),
    [visibleTools, homePage]
  )

  const miniWidth = Math.max(380, Math.min(960, 207 + visibleTools.length * 39))

  useEffect(() => {
    if (compact) {
      compactApplied.current = true
      void window.api.appWindow.setCompact(true, miniWidth).catch(() => {})
    } else if (compactApplied.current) {
      compactApplied.current = false
      void window.api.appWindow.setCompact(false).catch(() => {})
    }
  }, [compact, miniWidth])

  const expand = () => {
    setCompact(false)
    setView({ kind: 'home' })
  }

  const openPlayer = useCallback(() => {
    setCompact(false)
    setView({ kind: 'player' })
    if (!playerStarted) {
      setPlayerStarted(true)
      void window.api.artistwave.attach().catch(() => {})
    }
  }, [playerStarted])

  const closePlayer = useCallback(() => {
    setPlayerStarted(false)
    setView({ kind: 'home' })
    void window.api.artistwave.detach().catch(() => {})
  }, [])

  useEffect(() => {
    if (!playerStarted) return
    void window.api.artistwave.setVisible(view.kind === 'player').catch(() => {})
  }, [playerStarted, view.kind])

  useEffect(() => {
    const onOpenPlayer = () => openPlayer()
    window.addEventListener('toolbox:open-player', onOpenPlayer)
    return () => window.removeEventListener('toolbox:open-player', onOpenPlayer)
  }, [openPlayer])

  const openTool = (id: string) => {
    const tool = allTools.find((item) => item.id === id)
    if (tool?.fullPage) {
      openPlayer()
      return
    }
    setCompact(false)
    setView({ kind: 'tool', id })
  }

  const toggleTool = (id: string) => {
    setDisabled((current) =>
      current.includes(id) ? current.filter((toolId) => toolId !== id) : [...current, id]
    )
  }

  const activeTool =
    view.kind === 'tool' ? allTools.find((tool) => tool.id === view.id) : undefined

  return (
    <div className={`app ${compact ? 'app-compact' : ''}`}>
      {compact ? (
        <MiniBar
          tools={visibleTools}
          pinned={pinned}
          onTogglePin={() => setPinned((value) => !value)}
          onOpen={openTool}
          onManage={() => {
            setCompact(false)
            setView({ kind: 'settings' })
          }}
          onExpand={expand}
        />
      ) : (
        <>
          <header className="topbar">
            <div className="topbar-left">
              <button className="brand" onClick={() => setView({ kind: 'home' })} title="Toolbox home">
                <span className="brand-mark">T</span>
                <span className="brand-text">
                  <strong>Toolbox</strong>
                  <small>Customizable utilities for Windows</small>
                </span>
              </button>
              <HeaderStatus onOpen={() => openTool('clock')} />
              <PlayerButton
                active={view.kind === 'player'}
                onToggle={() => (view.kind === 'player' ? setView({ kind: 'home' }) : openPlayer())}
              />
              {update.result?.available && (
                <button
                  className="update-button"
                  onClick={() => setView({ kind: 'settings' })}
                  title={`Toolbox ${update.result.latestVersion} is available — open Manage tools to update`}
                >
                  <Icon name="download" size={17} />
                  <span className="update-copy">
                    <strong>Update</strong>
                    <small>v{update.result.latestVersion}</small>
                  </span>
                </button>
              )}
            </div>

            <div className="topbar-actions">
              <span className="tool-count">
                {visibleTools.length} of {allTools.length} tools active
              </span>
              <button
                className="icon-button mini-toggle"
                onClick={() => setCompact(true)}
                title="Switch to mini bar"
                aria-label="Switch to mini bar"
              >
                <Icon name="mini" size={18} />
              </button>
              <button
                className={`icon-button pin-toggle ${pinned ? 'pinned' : ''}`}
                onClick={() => setPinned((value) => !value)}
                title={pinned ? 'Unpin from top' : 'Keep on top'}
                aria-label={pinned ? 'Unpin from top' : 'Keep on top'}
                aria-pressed={pinned}
              >
                <Icon name="pin" size={18} />
              </button>
              <button
                className={`icon-button settings-toggle ${view.kind === 'settings' ? 'active' : ''}`}
                onClick={() => setView({ kind: 'settings' })}
                title="Manage tools"
                aria-label="Manage tools"
              >
                <Icon name="settings" size={18} />
              </button>
            </div>
          </header>

          <main className={`content ${view.kind === 'player' ? 'content-player' : ''}`}>
            {playerStarted && (
              <ArtistWavePage
                visible={view.kind === 'player'}
                onHide={() => setView({ kind: 'home' })}
                onStop={closePlayer}
              />
            )}

            {view.kind !== 'player' && (
              <>
                {view.kind === 'home' && (
                  <Home
                    tools={pageTools}
                    loading={!userToolsLoaded}
                    cardSize={cardSize}
                    page={homePage}
                    counts={pageCounts}
                    version={appVersion}
                    onCardSize={setCardSize}
                    onPage={setHomePage}
                    onOpen={openTool}
                    onManage={() => setView({ kind: 'settings' })}
                  />
                )}

                {view.kind === 'settings' && (
                  <Settings
                    tools={allTools}
                    disabled={disabled}
                    onToggle={toggleTool}
                    onBack={() => setView({ kind: 'home' })}
                    userToolErrors={userToolErrors}
                    onRefreshUserTools={loadUserTools}
                    version={appVersion}
                    updateSource={updateSource}
                    update={update}
                    onUpdateSource={setUpdateSource}
                    onCheckUpdates={() => void checkUpdates(updateSource)}
                    onOpenUpdate={openUpdate}
                  />
                )}

                {view.kind === 'tool' &&
                  (activeTool ? (
                    <ToolPage tool={activeTool} onBack={() => setView({ kind: 'home' })} />
                  ) : (
                    <MissingTool onBack={() => setView({ kind: 'home' })} />
                  ))}
              </>
            )}
          </main>
        </>
      )}
    </div>
  )
}

interface MiniBarProps {
  tools: ToolDefinition[]
  pinned: boolean
  onTogglePin: () => void
  onOpen: (id: string) => void
  onManage: () => void
  onExpand: () => void
}

function MiniBar({
  tools: miniTools,
  pinned,
  onTogglePin,
  onOpen,
  onManage,
  onExpand
}: MiniBarProps) {
  return (
    <div className="mini-bar">
      <button
        className="mini-brand"
        onClick={onExpand}
        title="Open dashboard"
        aria-label="Open dashboard"
      >
        <span className="brand-mark small">T</span>
      </button>

      <div className="mini-tools">
        {miniTools.map((tool) => (
          <button
            key={tool.id}
            className="mini-tool"
            style={accentStyle(tool.accent)}
            onClick={() => onOpen(tool.id)}
            title={tool.name}
            aria-label={tool.name}
          >
            <Icon name={tool.icon} size={18} />
          </button>
        ))}
      </div>

      <span className="mini-divider" />

      <div className="mini-actions">
        <button
          className={`mini-tool mini-pin ${pinned ? 'pinned' : ''}`}
          onClick={onTogglePin}
          title={pinned ? 'Unpin from top' : 'Keep on top'}
          aria-label={pinned ? 'Unpin from top' : 'Keep on top'}
          aria-pressed={pinned}
        >
          <Icon name="pin" size={17} />
        </button>
        <button
          className="mini-tool"
          onClick={onManage}
          title="Manage tools"
          aria-label="Manage tools"
        >
          <Icon name="settings" size={17} />
        </button>
        <button
          className="mini-tool mini-expand"
          onClick={onExpand}
          title="Expand dashboard"
          aria-label="Expand dashboard"
        >
          <Icon name="expand" size={17} />
        </button>
      </div>
    </div>
  )
}

interface HomeProps {
  tools: ToolDefinition[]
  loading: boolean
  cardSize: CardSize
  page: HomePage
  counts: Record<HomePage, number>
  version: string
  onCardSize: (size: CardSize) => void
  onPage: (page: HomePage) => void
  onOpen: (id: string) => void
  onManage: () => void
}

function Home({
  tools: visibleTools,
  loading,
  cardSize,
  page,
  counts,
  version,
  onCardSize,
  onPage,
  onOpen,
  onManage
}: HomeProps) {
  const connected = page === 'connected'

  return (
    <div className={`home cards-${cardSize}`}>
      <div className="hero">
        <div>
          <div className="home-switch" role="tablist" aria-label="Tool pages">
            <button
              role="tab"
              aria-selected={page === 'workspace'}
              className={page === 'workspace' ? 'active' : ''}
              onClick={() => onPage('workspace')}
            >
              Workspace
              <span className="home-switch-count">{counts.workspace}</span>
            </button>
            <button
              role="tab"
              aria-selected={page === 'connected'}
              className={page === 'connected' ? 'active' : ''}
              onClick={() => onPage('connected')}
            >
              Connected
              <span className="home-switch-count">{counts.connected}</span>
            </button>
          </div>
          <h1>
            {connected ? (
              <>
                Your services,
                <br />
                one dashboard.
              </>
            ) : (
              <>
                Everything you need,
                <br />
                one window.
              </>
            )}
          </h1>
          <p className="hero-copy">
            {connected
              ? 'Connect your accounts and services without leaving the desktop. Credentials are encrypted on this PC — you decide what connects.'
              : 'Pick a tool and get to work. Everything runs locally on this machine — no accounts, no cloud sync, no telemetry.'}
          </p>
        </div>
        <div className="hero-actions">
          <div className="card-size-control" role="group" aria-label="Card size">
            {CARD_SIZES.map((option) => (
              <button
                key={option.id}
                className={`card-size-button ${cardSize === option.id ? 'active' : ''}`}
                onClick={() => onCardSize(option.id)}
                title={option.label}
                aria-label={option.label}
                aria-pressed={cardSize === option.id}
              >
                <Icon name="grid" size={option.icon} />
              </button>
            ))}
          </div>
          <button className="ghost-button" onClick={onManage}>
            <Icon name="settings" size={16} />
            Manage tools
          </button>
        </div>
      </div>

      {visibleTools.length === 0 && !loading ? (
        <div className="empty-state">
          <Icon name={connected ? 'cloud' : 'spark'} size={26} />
          <strong>{connected ? 'No connected tools yet' : 'All tools are hidden'}</strong>
          <p>
            {connected
              ? 'Connected tools appear here. Enable one from Manage tools.'
              : 'Enable at least one tool to see it on your dashboard.'}
          </p>
          <button className="ghost-button" onClick={onManage}>
            Open manage tools
          </button>
        </div>
      ) : (
        <div className="tool-grid">
          {visibleTools.map((tool) => (
            <button
              key={tool.id}
              className="tool-card"
              style={accentStyle(tool.accent)}
              onClick={() => onOpen(tool.id)}
            >
              {tool.userTool && <span className="card-badge">User tool</span>}
              <span className="tool-icon">
                <Icon name={tool.icon} size={22} />
              </span>
              <h3>{tool.name}</h3>
              <p>{tool.description}</p>
              <span className="card-open">
                Open
                <Icon name="back" size={14} />
              </span>
            </button>
          ))}
          {loading && (
            <div className="tool-card tool-card-loading">
              <span className="tool-icon">
                <Icon name="refresh" size={22} />
              </span>
              <h3>Scanning tools…</h3>
              <p>Checking your tools folder for installed packages.</p>
            </div>
          )}
        </div>
      )}

      <footer className="home-footer">
        Local-first{version ? ` · v${version}` : ''}
      </footer>
    </div>
  )
}

interface SettingsProps {
  tools: ToolDefinition[]
  disabled: string[]
  onToggle: (id: string) => void
  onBack: () => void
  userToolErrors: UserToolError[]
  onRefreshUserTools: () => Promise<void>
  version: string
  updateSource: string
  update: UpdateLookup
  onUpdateSource: (value: string) => void
  onCheckUpdates: () => void
  onOpenUpdate: (url: string) => void
}

function Settings({
  tools: allTools,
  disabled,
  onToggle,
  onBack,
  userToolErrors,
  onRefreshUserTools,
  version,
  updateSource,
  update,
  onUpdateSource,
  onCheckUpdates,
  onOpenUpdate
}: SettingsProps) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const checked = update.result

  const runAction = async (task: () => Promise<string | null>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const message = await task()
      if (message) setNotice(message)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const openFolder = () =>
    runAction(async () => {
      await window.api.userTools.openFolder()
      return null
    })

  const rescan = () =>
    runAction(async () => {
      await onRefreshUserTools()
      return 'Tool folder rescanned.'
    })

  const installExample = () =>
    runAction(async () => {
      const result = await window.api.userTools.installExample()
      await onRefreshUserTools()
      return result.installed
        ? 'Example tool installed. It is on your dashboard now.'
        : 'The example tool is already installed.'
    })

  const userToolCount = allTools.filter((tool) => tool.userTool).length

  return (
    <div className="page">
      <button className="back-button" onClick={onBack}>
        <Icon name="back" size={18} />
        All tools
      </button>

      <div className="page-heading">
        <h1>Manage tools</h1>
        <p>
          Choose which tools appear on your dashboard. Changes save instantly, and a hidden tool
          keeps all of its data.
        </p>
      </div>

      <div className="settings-list">
        {allTools.map((tool) => {
          const isOn = !disabled.includes(tool.id)
          return (
            <div className="settings-row" key={tool.id}>
              <span className="tool-icon small" style={accentStyle(tool.accent)}>
                <Icon name={tool.icon} size={18} />
              </span>
              <div className="settings-copy">
                <strong>
                  {tool.name}
                  {tool.page === 'connected' && <span className="row-badge">Connected</span>}
                  {tool.userTool && <span className="row-badge">User</span>}
                </strong>
                <span>{tool.description}</span>
              </div>
              <button
                role="switch"
                aria-checked={isOn}
                aria-label={`Enable ${tool.name}`}
                className={`switch ${isOn ? 'on' : ''}`}
                onClick={() => onToggle(tool.id)}
              >
                <span className="switch-knob" />
              </button>
            </div>
          )
        })}
      </div>

      <section className="settings-section">
        <div className="settings-section-head">
          <h2>App updates</h2>
          <p>
            Point Toolbox at a GitHub repository (<code>owner/repo</code>) or an HTTPS JSON
            manifest. It checks once at startup and whenever you ask. Downloads open in your
            browser — nothing installs on its own.
          </p>
        </div>

        <div className="updates-panel">
          <label className="updates-field">
            <span>Release source</span>
            <input
              type="url"
              value={updateSource}
              onChange={(event) => onUpdateSource(event.target.value)}
              placeholder="owner/repo or https://example.com/update.json"
              spellCheck={false}
              autoComplete="off"
            />
          </label>

          <div className="updates-actions">
            <button
              className="ghost-button updates-check"
              onClick={onCheckUpdates}
              disabled={update.checking || !updateSource.trim()}
            >
              <Icon name="refresh" size={15} />
              {update.checking ? 'Checking…' : 'Check now'}
            </button>
            <span className="updates-version">
              {version ? `Installed v${version}` : 'Installed version unknown'}
            </span>
          </div>

          {update.error && <p className="error-text">{update.error}</p>}

          {checked && (
            <div className={`update-result ${checked.available ? 'available' : ''}`}>
              <strong>
                {checked.available
                  ? `v${checked.latestVersion} is available`
                  : 'You are up to date'}
              </strong>
              <span>
                {checked.available
                  ? `Installed v${checked.currentVersion} · latest v${checked.latestVersion}`
                  : `Installed v${checked.currentVersion}`}
                {' · '}checked {relativeTime(checked.checkedAt)}
              </span>
              {checked.notes && <p>{checked.notes}</p>}
              {checked.available && checked.url && (
                <button
                  className="ghost-button small"
                  onClick={() => checked.url && onOpenUpdate(checked.url)}
                >
                  <Icon name="download" size={15} />
                  Open download page
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <h2>User tools</h2>
          <p>
            {userToolCount > 0
              ? `${userToolCount} installed. `
              : ''}
            Drop a folder containing <code>manifest.json</code> and <code>index.js</code> into the
            tools directory, then rescan.
          </p>
        </div>

        <div className="user-tools-panel">
          <div className="user-tools-actions">
            <button className="ghost-button" onClick={() => void openFolder()} disabled={busy}>
              <Icon name="folder" size={15} />
              Open tools folder
            </button>
            <button className="ghost-button" onClick={() => void rescan()} disabled={busy}>
              <Icon name="refresh" size={15} />
              Rescan
            </button>
            <button className="ghost-button" onClick={() => void installExample()} disabled={busy}>
              <Icon name="plus" size={15} />
              Install example
            </button>
          </div>

          {notice && <div className="result-banner">{notice}</div>}
          {error && <p className="error-text">{error}</p>}

          {userToolErrors.length > 0 && (
            <div className="result-banner warn">
              {userToolErrors.length} folder
              {userToolErrors.length === 1 ? '' : 's'} could not be loaded:
              <ul>
                {userToolErrors.slice(0, 4).map((item) => (
                  <li key={item.folder}>
                    <strong>{item.folder}</strong>: {item.message}
                  </li>
                ))}
                {userToolErrors.length > 4 && (
                  <li>…and {userToolErrors.length - 4} more.</li>
                )}
              </ul>
            </div>
          )}

          <p className="user-tools-warning">
            <Icon name="warning" size={15} />
            User tools are local JavaScript that runs inside the app. Only install code you trust —
            a tool can act with the same local permissions as Toolbox itself.
          </p>
        </div>
      </section>

      <div className="settings-note">
        <Icon name="spark" size={16} />
        <p>
          <strong>Tool format:</strong> <code>manifest.json</code> declares id, name, description,
          icon, and accent; <code>index.js</code> exports <code>mount(root, ctx)</code> and may
          return a cleanup function.
        </p>
      </div>
    </div>
  )
}

interface ToolPageProps {
  tool: ToolDefinition
  onBack: () => void
}

function ToolPage({ tool, onBack }: ToolPageProps) {
  const ToolView = tool.component

  return (
    <div className="page tool-page" style={accentStyle(tool.accent)}>
      <button className="back-button" onClick={onBack}>
        <Icon name="back" size={18} />
        All tools
      </button>

      <div className="tool-heading">
        <span className="tool-icon">
          <Icon name={tool.icon} size={22} />
        </span>
        <div>
          <h1>{tool.name}</h1>
          <p>{tool.description}</p>
        </div>
      </div>

      <section className="tool-surface">
        <ToolView />
      </section>
    </div>
  )
}

function MissingTool({ onBack }: { onBack: () => void }) {
  return (
    <div className="page">
      <button className="back-button" onClick={onBack}>
        <Icon name="back" size={18} />
        All tools
      </button>
      <div className="empty-state">
        <Icon name="warning" size={24} />
        <strong>Tool not found</strong>
        <p>This tool is no longer registered. Pick another one from the dashboard.</p>
      </div>
    </div>
  )
}

export default App
