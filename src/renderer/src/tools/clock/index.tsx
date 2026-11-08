import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { WeatherCity, WeatherSnapshot } from '@shared/types'
import { Icon } from '../../components/Icon'
import { describeWeather, readSavedWeatherCity, useWeather, useWeatherCity } from '../../lib/weather'
import type { ToolDefinition } from '../types'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

interface ClockParts {
  time: string
  date: string
  zone: string
  cityTime: string
}

function formatClock(now: Date, timezone: string): ClockParts {
  const zone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone

  try {
    const time = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).format(now)

    const date = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(now)

    const cityTime = timezone
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23'
        }).format(now)
      : time.slice(0, 5)

    return { time, date, zone, cityTime }
  } catch {
    return {
      time: now.toLocaleTimeString(),
      date: now.toLocaleDateString(),
      zone: 'Local time',
      cityTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }
}

function CityWeather({
  city,
  weather,
  busy,
  error
}: {
  city: WeatherCity
  weather: WeatherSnapshot | null
  busy: boolean
  error: string | null
}) {
  const condition = describeWeather(weather?.weatherCode ?? 2)

  return (
    <div className={`clock-weather ${weather ? 'has-weather' : ''}`} aria-live="polite">
      <span className="clock-weather-icon">
        <Icon name={weather ? condition.icon : 'cloud'} size={36} />
      </span>
      <div className="clock-weather-copy">
        <span className="clock-weather-city">
          {city.name}
          {city.country ? `, ${city.country}` : ''}
        </span>
        <strong className="clock-weather-temp">
          {weather ? `${Math.round(weather.temperature)}°` : '—'}
          <small>C</small>
        </strong>
        <span className="clock-weather-condition">
          {weather
            ? `${condition.label} · feels ${Math.round(weather.apparentTemperature)}°C`
            : error
              ? 'Weather unavailable'
              : busy
                ? 'Loading conditions…'
                : 'No reading yet'}
        </span>
      </div>
    </div>
  )
}

function ClockTool() {
  const [now, setNow] = useState(() => new Date())
  const [city, setCity] = useWeatherCity()
  const { snapshot: weather, busy: weatherBusy, error: weatherError, refresh } = useWeather(city)
  const [searchOpen, setSearchOpen] = useState(() => !readSavedWeatherCity())
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WeatherCity[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const local = useMemo(() => formatClock(now, ''), [now])
  const cityClock = useMemo(() => (city ? formatClock(now, city.timezone) : null), [now, city])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const needle = query.trim()
    if (needle.length < 2) {
      setSearchError('Enter at least two characters to search.')
      return
    }

    setSearching(true)
    setSearchError(null)
    try {
      const found = await window.api.weather.search(needle)
      setResults(found)
      if (found.length === 0) setSearchError(`No cities matched "${needle}".`)
    } catch (cause) {
      setResults([])
      setSearchError(errorMessage(cause))
    } finally {
      setSearching(false)
    }
  }

  const chooseCity = (next: WeatherCity) => {
    setCity(next)
    setSearchOpen(false)
    setResults([])
    setSearchError(null)
    setQuery('')
  }

  return (
    <div className="clock-tool">
      <div className="clock-hero">
        <div className="clock-main">
          <p className="clock-eyebrow">
            <Icon name="clock" size={13} />
            Local time · {local.zone}
          </p>
          <div className="clock-time">{local.time}</div>
          <p className="clock-date">{local.date}</p>
        </div>

        {city ? (
          <CityWeather city={city} weather={weather} busy={weatherBusy} error={weatherError} />
        ) : (
          <div className="clock-weather clock-weather-empty">
            <span className="clock-weather-icon">
              <Icon name="cloud" size={34} />
            </span>
            <div className="clock-weather-copy">
              <span className="clock-weather-city">No city yet</span>
              <span className="clock-weather-condition">
                Search below to add live weather and a second clock.
              </span>
            </div>
          </div>
        )}
      </div>

      {city && cityClock && (
        <div className="clock-city-strip">
          <span>
            <Icon name="clock" size={13} />
            {city.name} time <b>{cityClock.cityTime}</b>
          </span>
          <span>
            {[city.region, city.country].filter(Boolean).join(', ') || 'Location saved'}
            {city.timezone ? ` · ${city.timezone}` : ''}
          </span>
          {weather && (
            <span>
              {Math.round(weather.humidity)}% humidity · {Math.round(weather.windSpeed)} km/h wind
            </span>
          )}
          <div className="clock-city-actions">
            <button className="ghost-button small" onClick={refresh} disabled={weatherBusy}>
              <Icon name="refresh" size={13} />
              {weatherBusy ? 'Refreshing…' : 'Refresh'}
            </button>
            <button className="ghost-button small" onClick={() => setSearchOpen((open) => !open)}>
              {searchOpen ? 'Close search' : 'Change city'}
            </button>
          </div>
        </div>
      )}

      {weatherError && <p className="error-text">{weatherError}</p>}

      {searchOpen && (
        <div className="clock-search">
          <form className="clock-search-form" onSubmit={(event) => void search(event)}>
            <div className="search-box">
              <Icon name="search" size={15} />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a city, for example Lisbon"
                maxLength={80}
                spellCheck={false}
                aria-label="Search for a city"
              />
            </div>
            <button type="submit" className="primary-button" disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>

          {searchError && <p className="error-text">{searchError}</p>}

          {results.length > 0 && (
            <div className="clock-results" role="listbox" aria-label="City results">
              {results.map((option) => (
                <button
                  key={`${option.id}-${option.latitude}-${option.longitude}`}
                  className="clock-result"
                  role="option"
                  aria-selected={false}
                  onClick={() => chooseCity(option)}
                >
                  <span className="clock-result-icon">
                    <Icon name="sun" size={16} />
                  </span>
                  <span className="clock-result-copy">
                    <strong>{option.name}</strong>
                    <span>
                      {[option.region, option.country].filter(Boolean).join(', ') || 'Location'}
                    </span>
                  </span>
                  <span className="clock-result-meta">
                    {Math.round(option.latitude)}°, {Math.round(option.longitude)}°
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="hint">
        <Icon name="spark" size={13} /> Weather is provided by Open-Meteo. The city you choose is
        saved on this PC, and only its coordinates leave the machine. The local clock works offline.
      </p>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'clock',
  name: 'Clock & weather',
  description: 'A precise local clock plus current conditions and a second clock for any city.',
  icon: 'clock',
  accent: '#f0c36a',
  order: 7,
  component: ClockTool
}
