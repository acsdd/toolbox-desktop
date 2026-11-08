import { useCallback, useEffect, useRef, useState } from 'react'
import type { WeatherCity, WeatherSnapshot } from '@shared/types'
import type { IconName } from '../components/Icon'
import { WEATHER_CITY_KEY } from './preferences'

export const WEATHER_CITY_EVENT = 'toolbox:weather-city'

const CACHE_FRESH_MS = 2 * 60 * 1000
const REFRESH_MS = 10 * 60 * 1000

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

export function readSavedWeatherCity(): WeatherCity | null {
  try {
    const raw = localStorage.getItem(WEATHER_CITY_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const city = parsed as Partial<WeatherCity>

    if (
      typeof city.name !== 'string' ||
      !city.name.trim() ||
      typeof city.latitude !== 'number' ||
      !Number.isFinite(city.latitude) ||
      typeof city.longitude !== 'number' ||
      !Number.isFinite(city.longitude)
    ) {
      return null
    }

    return {
      id: typeof city.id === 'number' && Number.isFinite(city.id) ? city.id : 0,
      name: city.name.trim(),
      country: typeof city.country === 'string' ? city.country : '',
      region: typeof city.region === 'string' ? city.region : '',
      latitude: city.latitude,
      longitude: city.longitude,
      timezone: typeof city.timezone === 'string' ? city.timezone : ''
    }
  } catch {
    return null
  }
}

function normalizeCity(city: WeatherCity): WeatherCity {
  return {
    id: Number.isFinite(city.id) ? city.id : 0,
    name: city.name.trim(),
    country: city.country.trim(),
    region: city.region.trim(),
    latitude: city.latitude,
    longitude: city.longitude,
    timezone: city.timezone.trim()
  }
}

export function saveWeatherCity(city: WeatherCity | null): void {
  const normalized = city ? normalizeCity(city) : null

  if (normalized) localStorage.setItem(WEATHER_CITY_KEY, JSON.stringify(normalized))
  else localStorage.removeItem(WEATHER_CITY_KEY)

  window.dispatchEvent(
    new CustomEvent<WeatherCity | null>(WEATHER_CITY_EVENT, { detail: normalized })
  )
}

/**
 * The header and the Clock & weather tool share the same saved city. A custom
 * event keeps both in sync when the city is chosen in either place.
 */
export function useWeatherCity(): [WeatherCity | null, (city: WeatherCity | null) => void] {
  const [city, setCity] = useState<WeatherCity | null>(readSavedWeatherCity)

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<WeatherCity | null>).detail
      setCity(detail ?? null)
    }
    window.addEventListener(WEATHER_CITY_EVENT, onChange)
    return () => window.removeEventListener(WEATHER_CITY_EVENT, onChange)
  }, [])

  const update = useCallback((next: WeatherCity | null) => saveWeatherCity(next), [])
  return [city, update]
}

export function describeWeather(code: number): { label: string; icon: IconName } {
  if (code === 0) return { label: 'Clear sky', icon: 'sun' }
  if (code === 1) return { label: 'Mainly clear', icon: 'sun' }
  if (code === 2) return { label: 'Partly cloudy', icon: 'cloud' }
  if (code === 3) return { label: 'Overcast', icon: 'cloud' }
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'cloud' }
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'rain' }
  if (code === 61 || code === 63 || code === 65) return { label: 'Rain', icon: 'rain' }
  if (code === 66 || code === 67) return { label: 'Freezing rain', icon: 'rain' }
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: 'snow' }
  if (code >= 80 && code <= 82) return { label: 'Rain showers', icon: 'rain' }
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: 'snow' }
  if (code >= 95) return { label: 'Thunderstorm', icon: 'storm' }
  return { label: 'Unsettled', icon: 'cloud' }
}

interface CachedWeather {
  key: string
  snapshot: WeatherSnapshot
  at: number
}

let cache: CachedWeather | null = null
let inflight: { key: string; promise: Promise<WeatherSnapshot> } | null = null

function keyOf(city: WeatherCity): string {
  return `${city.latitude.toFixed(4)},${city.longitude.toFixed(4)}`
}

function cachedFor(city: WeatherCity): CachedWeather | null {
  return cache && cache.key === keyOf(city) ? cache : null
}

function requestWeather(city: WeatherCity): Promise<WeatherSnapshot> {
  const key = keyOf(city)
  if (inflight && inflight.key === key) return inflight.promise

  const promise = window.api.weather.current(city)
  const entry = { key, promise }
  inflight = entry
  promise.then(
    () => {
      if (inflight === entry) inflight = null
    },
    () => {
      if (inflight === entry) inflight = null
    }
  )
  return promise
}

export interface WeatherReading {
  snapshot: WeatherSnapshot | null
  busy: boolean
  error: string | null
  refresh: () => void
}

/**
 * Loads current conditions once per city and refreshes them every ten minutes.
 * A small shared cache prevents the header and the tool from double-fetching
 * when both are mounted, and keeps the last reading visible during refreshes.
 */
export function useWeather(city: WeatherCity | null): WeatherReading {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null)
  const [snapshotKey, setSnapshotKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const token = useRef(0)

  const load = useCallback(
    async (force: boolean) => {
      if (!city) {
        token.current += 1
        setSnapshot(null)
        setSnapshotKey('')
        setBusy(false)
        setError(null)
        return
      }

      const key = keyOf(city)
      const cached = cachedFor(city)

      if (cached) {
        setSnapshot(cached.snapshot)
        setSnapshotKey(key)
        if (!force && Date.now() - cached.at < CACHE_FRESH_MS) {
          setBusy(false)
          setError(null)
          return
        }
      }

      const id = ++token.current
      setBusy(true)
      setError(null)

      try {
        const next = await requestWeather(city)
        if (id !== token.current) return
        cache = { key, snapshot: next, at: Date.now() }
        setSnapshot(next)
        setSnapshotKey(key)
      } catch (cause) {
        if (id === token.current) setError(errorMessage(cause))
      } finally {
        if (id === token.current) setBusy(false)
      }
    },
    [city]
  )

  useEffect(() => {
    if (!city) {
      token.current += 1
      setSnapshot(null)
      setSnapshotKey('')
      setBusy(false)
      setError(null)
      return
    }

    void load(false)
    const timer = setInterval(() => void load(true), REFRESH_MS)
    return () => {
      clearInterval(timer)
      token.current += 1
    }
  }, [city, load])

  const activeKey = city ? keyOf(city) : ''

  return {
    snapshot: snapshotKey === activeKey ? snapshot : null,
    busy,
    error,
    refresh: () => void load(true)
  }
}
