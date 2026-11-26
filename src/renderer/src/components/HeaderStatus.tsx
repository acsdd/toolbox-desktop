import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { describeWeather, useWeather, useWeatherCity } from '../lib/weather'

interface HeaderStatusProps {
  onOpen: () => void
}

function timeLabel(now: Date): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(now)
  } catch {
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
}

function dateLabel(now: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    }).format(now)
  } catch {
    return now.toLocaleDateString()
  }
}

/**
 * Live time, date and weather beside the brand. It stays in the top bar on the
 * dashboard, settings and every tool page, and opens the Clock & weather tool.
 */
export function HeaderStatus({ onOpen }: HeaderStatusProps) {
  const [now, setNow] = useState(() => new Date())
  const [city] = useWeatherCity()
  const { snapshot, busy, error } = useWeather(city)
  const condition = describeWeather(snapshot?.weatherCode ?? 2)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const time = timeLabel(now)
  const date = dateLabel(now)
  const temperature = snapshot ? `${Math.round(snapshot.temperature)}°C` : null

  const weatherSummary = city
    ? snapshot
      ? `${temperature}, ${condition.label} in ${city.name}`
      : error
        ? `Weather unavailable in ${city.name}`
        : busy
          ? `Loading weather for ${city.name}`
          : `Weather for ${city.name}`
    : 'No weather city selected'

  return (
    <button
      type="button"
      className="header-status"
      onClick={onOpen}
      title="Open Clock weather"
      aria-label={`${time}, ${date}. ${weatherSummary}. Open Clock & weather.`}
    >
      <span className="header-clock">
        <strong>{time}</strong>
        <span>{date}</span>
      </span>

      <span className="header-status-divider" aria-hidden="true" />

      <span className={`header-weather ${temperature ? '' : 'muted'}`}>
        <Icon name={snapshot ? condition.icon : city ? 'cloud' : 'plus'} size={16} />
        {city ? (
          <>
            <strong>{temperature ?? '—'}</strong>
            <span className="header-weather-city">{city.name}</span>
          </>
        ) : (
          <span className="header-weather-city">Set city</span>
        )}
      </span>
    </button>
  )
}
