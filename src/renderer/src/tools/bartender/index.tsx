import { useEffect, useRef, useState } from 'react'
import type { BartenderIngredient, BartenderRecipe, BartenderStatus } from '@shared/types'
import { Icon } from '../../components/Icon'
import { relativeTime } from '../../lib/format'
import type { ToolDefinition } from '../types'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function updatedLabel(value: number | null): string {
  if (!value) return 'Not loaded yet'
  try {
    return `Updated ${relativeTime(value)}`
  } catch {
    return 'Updated recently'
  }
}

function isReady(recipe: BartenderRecipe): boolean {
  return recipe.totalRequired > 0 && recipe.matchedCount >= recipe.totalRequired
}

function recipeMeta(recipe: BartenderRecipe): string {
  const parts: string[] = []
  if (recipe.glassware) parts.push(recipe.glassware)
  parts.push(`${recipe.matchedCount} of ${recipe.totalRequired} ingredients`)
  return parts.join(' · ')
}

function BartenderTool() {
  const [status, setStatus] = useState<BartenderStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [recipes, setRecipes] = useState<BartenderRecipe[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<'load' | 'match' | null>(null)
  const [hasMatched, setHasMatched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const resultsRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let alive = true

    window.api.bartender
      .status()
      .then((next) => {
        if (!alive) return
        setStatus(next)
        setSelected(next.selectedIds)
        setRecipes(next.recipes)
        setHasMatched(next.lastMatch !== null)
        if (next.error) setFormError(next.error)
      })
      .catch((cause) => {
        if (alive) setLoadError(errorMessage(cause))
      })

    return () => {
      alive = false
    }
  }, [])

  const load = async () => {
    if (busy) return
    setBusy('load')
    setFormError(null)
    try {
      const next = await window.api.bartender.load()
      setStatus(next)
      setSelected(next.selectedIds)
      setRecipes(next.recipes)
      setExpandedId(null)
      setHasMatched(false)
      if (next.error) setFormError(next.error)
    } catch (cause) {
      setFormError(errorMessage(cause))
    } finally {
      setBusy(null)
    }
  }

  const find = async () => {
    if (busy) return
    if (selected.length === 0) {
      setFormError('Pick at least one ingredient first.')
      return
    }

    setBusy('match')
    setFormError(null)
    setRecipes([])
    setExpandedId(null)
    setHasMatched(true)
    try {
      const next = await window.api.bartender.match(selected)
      setStatus(next)
      setSelected(next.selectedIds)
      setRecipes(next.recipes)
      if (next.matchError) setFormError(next.matchError)
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    } catch (cause) {
      setFormError(errorMessage(cause))
    } finally {
      setBusy(null)
    }
  }

  const toggle = (id: number) => {
    if (busy) return
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    )
    setRecipes([])
    setHasMatched(false)
    setExpandedId(null)
    setFormError(null)
  }

  const clearSelection = () => {
    if (busy || selected.length === 0) return
    setSelected([])
    setRecipes([])
    setHasMatched(false)
    setExpandedId(null)
    setFormError(null)
  }

  const openSource = (url: string) => {
    window.api.bartender.openSource(url).catch((cause) => setFormError(errorMessage(cause)))
  }

  if (!status) {
    return (
      <div className="linked-tool bartender-tool">
        {loadError ? (
          <p className="error-text">{loadError}</p>
        ) : (
          <p className="hint">
            <Icon name="cocktail" size={13} /> Reading your bar…
          </p>
        )}
      </div>
    )
  }

  const error = formError || status.error

  if (status.ingredients.length === 0) {
    return (
      <div className="linked-tool bartender-tool">
        <div className="linked-intro">
          <span className="linked-intro-icon">
            <Icon name="cocktail" size={28} />
          </span>
          <div>
            <p className="linked-eyebrow">Bartender Aid · cocktail matcher</p>
            <h2>What can you make tonight?</h2>
            <p>
              Load a bar inventory of spirits, mixers and garnishes, tick what you have, and Toolbox
              asks Bartender Aid which cocktails are ready to pour. No account or API key is needed —
              the recipe service is free and public.
            </p>
            <div className="bartender-intro-actions">
              <button className="primary-button" onClick={() => void load()} disabled={busy !== null}>
                <Icon name="cocktail" size={15} />
                {busy === 'load' ? 'Waking the bar…' : error ? 'Try again' : 'Load the bar'}
              </button>
            </div>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="linked-help">
          <strong>How the card works</strong>
          <p>
            The inventory comes from the Bartender Aid server and is cached on this PC, so your bar
            is still there next time. The free server sleeps when idle; the first load of the day
            can take up to half a minute while it wakes up.
          </p>
        </div>

        <p className="hint">
          <Icon name="shield" size={13} /> Your bar list stays on this PC. Only the ingredient ids
          you tick are sent when you search for cocktails.
        </p>
      </div>
    )
  }

  const selectedSet = new Set(selected)
  const normalizedQuery = query.trim().toLowerCase()
  const visibleIngredients = status.ingredients.filter(
    (ingredient) =>
      ingredient.name.toLowerCase().includes(normalizedQuery) ||
      ingredient.category.toLowerCase().includes(normalizedQuery)
  )

  const groups = visibleIngredients.reduce<Record<string, BartenderIngredient[]>>(
    (collection, ingredient) => {
      if (!collection[ingredient.category]) collection[ingredient.category] = []
      collection[ingredient.category].push(ingredient)
      return collection
    },
    {}
  )
  const categories = Object.keys(groups).sort((left, right) => left.localeCompare(right))

  const readyCount = recipes.filter(isReady).length
  const summaryCount = hasMatched ? readyCount : selected.length

  return (
    <div className="linked-tool bartender-tool">
      <div className="linked-summary">
        <div className={`linked-count ${summaryCount > 0 ? 'has-unread' : ''}`}>
          <strong>{busy === 'match' ? '…' : summaryCount}</strong>
          <span>{hasMatched ? 'ready to pour' : 'in stock'}</span>
        </div>

        <div className="linked-summary-copy">
          <p className="linked-eyebrow">
            <Icon name="cocktail" size={13} />
            {status.ingredients.length} bar ingredients
          </p>
          <strong>{busy === 'match' ? 'Matching recipes…' : 'Your bar'}</strong>
          <span>{selected.length} selected · {updatedLabel(status.lastLoaded)}</span>
        </div>

        <div className="linked-actions">
          <button className="ghost-button small" onClick={() => void load()} disabled={busy !== null}>
            <Icon name="refresh" size={13} />
            {busy === 'load' ? 'Refreshing…' : 'Refresh bar list'}
          </button>
        </div>
      </div>

      <section className="linked-panel bartender-picker">
        <div className="linked-panel-head">
          <span>1 · Tick what you have</span>
          <span>{selected.length} selected</span>
        </div>

        <div className="bartender-picker-body">
          <div className="bartender-search-row">
            <label className="bartender-search">
              <Icon name="search" size={14} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ingredients or categories"
                spellCheck={false}
                aria-label="Search ingredients"
              />
            </label>
            <button
              className="linked-row-button"
              onClick={clearSelection}
              disabled={selected.length === 0 || busy !== null}
            >
              Clear
            </button>
          </div>

          {visibleIngredients.length === 0 ? (
            <p className="bartender-no-results">No ingredients match that search.</p>
          ) : (
            <div className="bartender-groups">
              {categories.map((category) => (
                <div className="bartender-group" key={category}>
                  <span className="bartender-group-label">{category}</span>
                  <div className="bartender-chips">
                    {groups[category].map((ingredient) => (
                      <button
                        key={ingredient.id}
                        className={`chip-button ${selectedSet.has(ingredient.id) ? 'active' : ''}`}
                        aria-pressed={selectedSet.has(ingredient.id)}
                        onClick={() => toggle(ingredient.id)}
                        disabled={busy !== null}
                      >
                        {selectedSet.has(ingredient.id) ? '✓ ' : ''}
                        {ingredient.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bartender-picker-foot">
          <span>
            {selected.length === 0
              ? 'Nothing selected yet'
              : `${selected.length} ${selected.length === 1 ? 'ingredient' : 'ingredients'} selected`}
          </span>
          <button
            className="primary-button"
            onClick={() => void find()}
            disabled={busy !== null || selected.length === 0}
          >
            <Icon name="cocktail" size={15} />
            {busy === 'match' ? 'Matching…' : 'Find cocktails'}
          </button>
        </div>
      </section>

      <section className="linked-panel bartender-results" ref={resultsRef}>
        <div className="linked-panel-head">
          <span>2 · Cocktails</span>
          <span>
            {hasMatched && recipes.length > 0
              ? `${readyCount} ready · ${recipes.length} total`
              : hasMatched && busy === null
                ? 'No matches'
                : ''}
          </span>
        </div>

        {error && <p className="error-text bartender-error">{error}</p>}

        {!hasMatched ? (
          <div className="linked-empty">
            <Icon name="cocktail" size={22} />
            <span>Pick your ingredients, then find cocktails.</span>
          </div>
        ) : busy === 'match' ? (
          <div className="linked-empty">
            <Icon name="refresh" size={22} />
            <span>Shaking up recipes…</span>
          </div>
        ) : recipes.length === 0 ? (
          <div className="linked-empty">
            <Icon name="cocktail" size={22} />
            <span>No cocktails match that bar yet. Add a spirit, mixer or garnish.</span>
          </div>
        ) : (
          <div className="linked-list">
            {recipes.map((recipe) => {
              const ready = isReady(recipe)
              const open = expandedId === recipe.id
              const missing = Math.max(0, recipe.totalRequired - recipe.matchedCount)

              return (
                <div className={`bartender-recipe ${open ? 'open' : ''}`} key={recipe.id}>
                  <button
                    className="bartender-recipe-head"
                    aria-expanded={open}
                    onClick={() => setExpandedId(open ? null : recipe.id)}
                  >
                    {recipe.imageUrl ? (
                      <img
                        className="bartender-recipe-thumb"
                        src={recipe.imageUrl}
                        alt={recipe.name}
                        loading="lazy"
                      />
                    ) : (
                      <span className="bartender-recipe-thumb placeholder">
                        <Icon name="cocktail" size={20} />
                      </span>
                    )}

                    <span className="bartender-recipe-copy">
                      <strong>{recipe.name}</strong>
                      <span>{recipeMeta(recipe)}</span>
                    </span>

                    <span className={`bartender-badge ${ready ? 'ready' : 'missing'}`}>
                      {ready ? 'Ready' : `Missing ${missing}`}
                    </span>

                    <Icon
                      name="back"
                      size={14}
                      className={`bartender-chevron ${open ? 'open' : ''}`}
                    />
                  </button>

                  {open && (
                    <div className="bartender-recipe-body">
                      <div className="bartender-ingredients">
                        {recipe.ingredients.map((ingredient) => (
                          <div
                            className={`bartender-ingredient ${ingredient.have ? 'have' : 'missing'}`}
                            key={ingredient.id}
                          >
                            <span className="bartender-ingredient-state">
                              {ingredient.have ? 'Have' : 'Missing'}
                            </span>
                            <span className="bartender-ingredient-name">{ingredient.name}</span>
                            <span className="bartender-ingredient-amount">
                              {ingredient.amount || '—'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {recipe.instructions && (
                        <p className="bartender-instructions">{recipe.instructions}</p>
                      )}

                      {recipe.sourceUrl && (
                        <button
                          className="bartender-source"
                          onClick={() => openSource(recipe.sourceUrl as string)}
                        >
                          Open recipe source
                          <Icon name="expand" size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="linked-help">
        <strong>How matching works</strong>
        <p>
          Tick ingredients and Toolbox sends their ids to Bartender Aid, which compares them with
          its recipe database and returns the cocktails that fit, ready ones first. Recipes and
          photos come from TheCocktailDB through that service. The list is refreshed only when you
          ask, and nothing is sent in the background.
        </p>
      </div>

      <p className="hint">
        <Icon name="shield" size={13} /> Your bar list stays on this PC. No account, key or personal
        data is involved.
      </p>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'bartender',
  name: 'Bartender Aid',
  description: 'See which cocktails you can pour with the ingredients you have.',
  icon: 'cocktail',
  accent: '#fb923c',
  order: 6,
  page: 'connected',
  component: BartenderTool
}
