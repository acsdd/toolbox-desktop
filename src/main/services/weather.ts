import { net } from 'electron'
import type { WeatherCity, WeatherSnapshot } from '../../shared/types'
import { USER_AGENT } from '../version'

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const REQUEST_TIMEOUT_MS = 9000
const WEATHER_AGENT = `${USER_AGENT} (Windows desktop app)`

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

async function getJson(url: URL): Promise<unknown> {
  let response: Response
  try {
    response = await net.fetch(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': WEATHER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (cause) {
    if (cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) {
      throw new Error('The weather service did not respond in time. Try again shortly.')
    }
    throw new Error('Could not reach the weather service. Check your internet connection.')
  }

  if (!response.ok) {
    throw new Error(`The weather service rejected the request (HTTP ${response.status}).`)
  }

  try {
    return await response.json()
  } catch {
    throw new Error('The weather service returned an unreadable response.')
  }
}

export async function searchWeatherCities(input: unknown): Promise<WeatherCity[]> {
  const query = typeof input === 'string' ? input.trim() : ''
  if (query.length < 2) throw new Error('Enter at least two characters to search for a city.')
  if (query.length > 80) throw new Error('City search is too long.')

  const url = new URL(GEOCODE_URL)
  url.searchParams.set('name', query)
  url.searchParams.set('count', '6')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')

  const payload = await getJson(url)
  const results = isRecord(payload) && Array.isArray(payload.results) ? payload.results : []

  const cities: WeatherCity[] = []
  for (const item of results) {
    if (!isRecord(item)) continue

    const id = asNumber(item.id)
    const latitude = asNumber(item.latitude)
    const longitude = asNumber(item.longitude)
    const name = asString(item.name).trim()
    const country = asString(item.country).trim()

    if (id === null || latitude === null || longitude === null || !name) continue

    cities.push({
      id,
      name,
      country,
      region: asString(item.admin1).trim(),
      latitude,
      longitude,
      timezone: asString(item.timezone).trim()
    })
  }

  return cities
}

export async function getCurrentWeather(input: unknown): Promise<WeatherSnapshot> {
  if (!isRecord(input)) throw new Error('Invalid weather location.')

  const latitude = asNumber(input.latitude)
  const longitude = asNumber(input.longitude)
  if (latitude === null || latitude < -90 || latitude > 90) {
    throw new Error('The weather location is invalid.')
  }
  if (longitude === null || longitude < -180 || longitude > 180) {
    throw new Error('The weather location is invalid.')
  }

  const url = new URL(FORECAST_URL)
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code'
  )
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '1')

  const payload = await getJson(url)
  if (!isRecord(payload) || !isRecord(payload.current)) {
    throw new Error('The weather service returned no current conditions.')
  }

  const current = payload.current
  const temperature = asNumber(current.temperature_2m)
  const apparentTemperature = asNumber(current.apparent_temperature)
  const humidity = asNumber(current.relative_humidity_2m)
  const windSpeed = asNumber(current.wind_speed_10m)
  const weatherCode = asNumber(current.weather_code)

  if (
    temperature === null ||
    apparentTemperature === null ||
    humidity === null ||
    windSpeed === null ||
    weatherCode === null
  ) {
    throw new Error('The weather service returned incomplete conditions.')
  }

  return {
    temperature,
    apparentTemperature,
    humidity,
    windSpeed,
    weatherCode,
    timezone: asString(payload.timezone) || asString(input.timezone),
    observedAt: asString(current.time) || new Date().toISOString()
  }
}
