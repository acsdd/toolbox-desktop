import { app, shell } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  BartenderIngredient,
  BartenderRecipe,
  BartenderRecipeIngredient,
  BartenderStatus
} from '../../shared/types'

const API_URL = 'https://bartender-aid.onrender.com/api'
const REQUEST_TIMEOUT_MS = 45000
const USER_AGENT = 'Toolbox/0.9.0'
const MAX_SELECTION = 60

interface StoredBartender {
  version: 1
  ingredients: BartenderIngredient[]
  selectedIds: number[]
  lastLoaded: number | null
}

interface BartenderState {
  ingredients: BartenderIngredient[]
  selectedIds: number[]
  recipes: BartenderRecipe[]
  loading: boolean
  matching: boolean
  lastLoaded: number | null
  lastMatch: number | null
  error: string | null
  matchError: string | null
  cached: boolean
  pendingLoad: Promise<BartenderStatus> | null
  pendingMatch: Promise<BartenderStatus> | null
  generation: number
}

const state: BartenderState = {
  ingredients: [],
  selectedIds: [],
  recipes: [],
  loading: false,
  matching: false,
  lastLoaded: null,
  lastMatch: null,
  error: null,
  matchError: null,
  cached: false,
  pendingLoad: null,
  pendingMatch: null,
  generation: 0
}

function bartenderPath(): string {
  return join(app.getPath('userData'), 'bartender.json')
}

function status(): BartenderStatus {
  return {
    ingredients: state.ingredients,
    selectedIds: state.selectedIds,
    recipes: state.recipes,
    loading: state.loading,
    matching: state.matching,
    lastLoaded: state.lastLoaded,
    lastMatch: state.lastMatch,
    error: state.error,
    matchError: state.matchError
  }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function safeHttpsUrl(value: unknown): string {
  const raw = text(value)
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' ? parsed.toString() : ''
  } catch {
    return ''
  }
}

function normalizeIngredient(value: unknown): BartenderIngredient | null {
  if (!isRecord(value)) return null
  const id = positiveInt(value.id)
  const name = text(value.name)
  if (id === null || !name) return null
  return { id, name, category: text(value.category) || 'Other' }
}

function normalizeRecipeIngredient(value: unknown): BartenderRecipeIngredient | null {
  if (!isRecord(value)) return null
  const id = positiveInt(value.id)
  const name = text(value.name)
  if (id === null || !name) return null
  return { id, name, amount: text(value.amount), have: value.hasIt === true }
}

function normalizeRecipe(value: unknown): BartenderRecipe | null {
  if (!isRecord(value)) return null
  const id = positiveInt(value.id)
  const name = text(value.name)
  if (id === null || !name) return null

  const rawIngredients = value.recipe_ingredients ?? value.ingredients
  const ingredients = Array.isArray(rawIngredients)
    ? rawIngredients
        .map(normalizeRecipeIngredient)
        .filter((entry): entry is BartenderRecipeIngredient => entry !== null)
    : []

  const required = positiveInt(value.total_required ?? value.totalRequired)
  const rawMatched = value.matched_count ?? value.matchedCount
  const matched =
    typeof rawMatched === 'number' && Number.isFinite(rawMatched)
      ? Math.max(0, Math.round(rawMatched))
      : ingredients.filter((entry) => entry.have).length

  const totalRequired = required ?? ingredients.length

  return {
    id,
    name,
    instructions: text(value.instructions),
    glassware: text(value.glassware),
    imageUrl: safeHttpsUrl(value.image_url ?? value.imageUrl),
    sourceUrl: safeHttpsUrl(value.source_url ?? value.sourceUrl) || null,
    totalRequired,
    matchedCount: Math.min(matched, totalRequired),
    ingredients
  }
}

function sortRecipes(recipes: BartenderRecipe[]): BartenderRecipe[] {
  return [...recipes].sort((left, right) => {
    const leftReady = left.matchedCount >= left.totalRequired && left.totalRequired > 0
    const rightReady = right.matchedCount >= right.totalRequired && right.totalRequired > 0
    if (leftReady !== rightReady) return leftReady ? -1 : 1
    const leftRatio = left.totalRequired > 0 ? left.matchedCount / left.totalRequired : 0
    const rightRatio = right.totalRequired > 0 ? right.matchedCount / right.totalRequired : 0
    if (leftRatio !== rightRatio) return rightRatio - leftRatio
    return left.name.localeCompare(right.name)
  })
}

function validateSelection(input: unknown, ingredients: BartenderIngredient[]): number[] {
  if (!Array.isArray(input)) throw new Error('Choose at least one ingredient.')

  const known = new Set(ingredients.map((entry) => entry.id))
  const ids = [
    ...new Set(
      input.filter((entry): entry is number => typeof entry === 'number' && Number.isInteger(entry))
    )
  ]

  if (ids.length === 0) throw new Error('Choose at least one ingredient.')
  if (ids.length > MAX_SELECTION) {
    throw new Error(`Select up to ${MAX_SELECTION} ingredients at a time.`)
  }
  if (ids.some((id) => !known.has(id))) {
    throw new Error('That ingredient is not in the bar list. Reload the bar and try again.')
  }
  return ids
}

async function loadCache(): Promise<void> {
  if (state.cached) return
  state.cached = true

  try {
    const raw = await readFile(bartenderPath(), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return

    const rawIngredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : []
    const ingredients = rawIngredients
      .map(normalizeIngredient)
      .filter((entry): entry is BartenderIngredient => entry !== null)
      .slice(0, 500)

    const known = new Set(ingredients.map((entry) => entry.id))
    const rawSelected = Array.isArray(parsed.selectedIds) ? parsed.selectedIds : []
    const selectedIds = [
      ...new Set(
        rawSelected.filter(
          (entry): entry is number => typeof entry === 'number' && Number.isInteger(entry)
        )
      )
    ]
      .filter((id) => known.has(id))
      .slice(0, MAX_SELECTION)

    state.ingredients = ingredients
    state.selectedIds = selectedIds
    state.lastLoaded = typeof parsed.lastLoaded === 'number' ? parsed.lastLoaded : null
  } catch {
    // Start with an empty bar; the card offers a first load.
  }
}

async function persistState(): Promise<void> {
  const stored: StoredBartender = {
    version: 1,
    ingredients: state.ingredients,
    selectedIds: state.selectedIds,
    lastLoaded: state.lastLoaded
  }

  try {
    const target = bartenderPath()
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, JSON.stringify(stored, null, 2), { encoding: 'utf8', mode: 0o600 })
  } catch (cause) {
    console.error('Could not save the bartender bar list:', message(cause))
  }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...(init?.headers as Record<string, string> | undefined)
      }
    })
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === 'TimeoutError'
    throw new Error(
      timedOut
        ? 'Bartender Aid did not respond in time. Its free server may be waking up — try again in a moment.'
        : 'Could not reach Bartender Aid. Check your internet connection and try again.'
    )
  }

  if (!response.ok) {
    throw new Error(
      response.status === 503
        ? 'Bartender Aid is running, but its recipe database is unavailable. Try again shortly.'
        : `Bartender Aid returned HTTP ${response.status}. Try again shortly.`
    )
  }

  try {
    return await response.json()
  } catch {
    throw new Error('Bartender Aid returned an unexpected response.')
  }
}

export async function initBartender(): Promise<void> {
  await loadCache()
}

export function getBartenderStatus(): BartenderStatus {
  return status()
}

export async function loadBartenderIngredients(): Promise<BartenderStatus> {
  await loadCache()
  if (state.pendingLoad) return state.pendingLoad

  const generation = ++state.generation
  state.loading = true
  state.error = null

  const task = (async () => {
    try {
      const data = await request('/ingredients')
      if (!Array.isArray(data)) throw new Error('Bartender Aid returned an unexpected response.')

      const ingredients = data
        .map(normalizeIngredient)
        .filter((entry): entry is BartenderIngredient => entry !== null)
        .sort((left, right) => left.name.localeCompare(right.name))

      if (ingredients.length === 0) {
        throw new Error('Bartender Aid returned an empty bar list. Try again shortly.')
      }

      if (generation === state.generation) {
        const known = new Set(ingredients.map((entry) => entry.id))
        state.ingredients = ingredients
        state.selectedIds = state.selectedIds.filter((id) => known.has(id))
        state.recipes = []
        state.lastLoaded = Date.now()
        state.lastMatch = null
        state.error = null
        await persistState()
      }
    } catch (cause) {
      if (generation === state.generation) state.error = message(cause)
    } finally {
      state.loading = false
      state.pendingLoad = null
    }
    return status()
  })()

  state.pendingLoad = task
  return task
}

export async function matchBartenderCocktails(input: unknown): Promise<BartenderStatus> {
  await loadCache()
  if (state.pendingMatch) return state.pendingMatch

  const ids = validateSelection(input, state.ingredients)
  const generation = ++state.generation

  state.selectedIds = ids
  state.matching = true
  state.matchError = null
  await persistState()

  const task = (async () => {
    try {
      const data = await request('/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredientIds: ids })
      })
      if (!Array.isArray(data)) throw new Error('Bartender Aid returned an unexpected response.')

      const recipes = sortRecipes(
        data.map(normalizeRecipe).filter((entry): entry is BartenderRecipe => entry !== null)
      )

      if (generation === state.generation) {
        state.recipes = recipes
        state.lastMatch = Date.now()
        state.matchError = null
      }
    } catch (cause) {
      if (generation === state.generation) state.matchError = message(cause)
    } finally {
      state.matching = false
      state.pendingMatch = null
    }
    return status()
  })()

  state.pendingMatch = task
  return task
}

export async function openBartenderSource(url: unknown): Promise<void> {
  if (typeof url !== 'string') throw new Error('Invalid recipe link.')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid recipe link.')
  }
  if (parsed.protocol !== 'https:') throw new Error('Only secure web links can be opened.')
  await shell.openExternal(parsed.toString())
}
