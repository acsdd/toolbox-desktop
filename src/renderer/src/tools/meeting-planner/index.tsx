import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from '../../components/Icon'
import {
  findMeetingSlots,
  formatMeetingTimes,
  isMeetingTimeZone,
  isMeetingWorkTime,
  localMeetingDate,
  summarizeMeetingRange
} from '../../lib/meeting-slots'
import type { MeetingSlot, MeetingWorkHours } from '../../lib/meeting-slots'
import type { ToolDefinition } from '../types'
import './meeting-planner.css'

const STORAGE_KEY = 'toolbox.meeting-planner.hours'
const MAX_ZONES = 4
const VISIBLE_SLOTS = 6
const SUGGESTED_ZONES = [
  'UTC',
  'Europe/London',
  'America/New_York',
  'Asia/Tokyo'
]
const TIME_ZONES = [...new Set([
  ...Intl.supportedValuesOf('timeZone'),
  'UTC',
  'Asia/Kathmandu',
  'Asia/Kolkata',
  'Europe/Kyiv'
])].sort()

function defaultHours(timeZone: string): MeetingWorkHours {
  return { timeZone, from: '09:00', until: '17:00' }
}

function isSavedHours(value: unknown): value is MeetingWorkHours {
  if (typeof value !== 'object' || value === null) return false
  const { timeZone, from, until } = value as Partial<MeetingWorkHours>
  return typeof timeZone === 'string' && isMeetingTimeZone(timeZone) &&
    typeof from === 'string' && isMeetingWorkTime(from) &&
    typeof until === 'string' && isMeetingWorkTime(until) && from < until
}

function readWorkHours(): MeetingWorkHours[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (Array.isArray(stored)) {
      const valid = stored.filter(isSavedHours).slice(0, MAX_ZONES)
      if (valid.length) return valid
    }
  } catch {
    // The planner also works when local storage is unavailable.
  }
  return [defaultHours(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')]
}

interface CopyFeedback {
  slots: MeetingSlot[]
  start: number
  message: string
}

function MeetingPlanner() {
  const [hours, setHours] = useState(readWorkHours)
  const [date, setDate] = useState(() => localMeetingDate(Date.now(), hours[0].timeZone))
  const [duration, setDuration] = useState('30')
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null)

  const result = useMemo(() => {
    try {
      return { slots: findMeetingSlots(date, hours, Number(duration)), error: null }
    } catch (cause) {
      return { slots: [], error: cause instanceof Error ? cause.message : 'Meeting times are unavailable.' }
    }
  }, [date, duration, hours])

  useEffect(() => {
    if (!hours.every(isSavedHours)) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hours))
    } catch {
      // Keep the current working hours in memory for this view.
    }
  }, [hours])

  function setZoneHours(index: number, change: Partial<MeetingWorkHours>) {
    setHours((current) => current.map((zone, position) => position === index ? { ...zone, ...change } : zone))
  }

  function addZone() {
    setHours((current) => {
      if (current.length >= MAX_ZONES) return current
      const next = SUGGESTED_ZONES.find((timeZone) => !current.some((zone) => zone.timeZone === timeZone))
      return next ? [...current, defaultHours(next)] : current
    })
  }

  async function copyTimes(slot: MeetingSlot) {
    try {
      await navigator.clipboard.writeText(formatMeetingTimes(slot))
      setCopyFeedback({ slots: result.slots, start: slot.start, message: 'Copied times.' })
    } catch {
      setCopyFeedback({ slots: result.slots, start: slot.start, message: 'Could not copy times. Try again.' })
    }
  }

  return (
    <div className="meeting-planner">
      <div className="meeting-config">
        <label>
          <strong>Meeting date</strong>
          <input
            className="meeting-date"
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            aria-describedby="meeting-date-zone"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <small id="meeting-date-zone">Date in {hours[0].timeZone}</small>
        </label>
        <label>
          <strong>Duration (minutes)</strong>
          <input
            className="meeting-duration"
            type="number"
            min="1"
            max="1440"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </label>
      </div>

      <section className="meeting-zones" aria-labelledby="meeting-zones-title">
        <div className="meeting-section-heading">
          <h2 id="meeting-zones-title">Working hours by time zone</h2>
          <button type="button" className="ghost-button small" onClick={addZone} disabled={hours.length >= MAX_ZONES}>
            <Icon name="plus" size={14} />
            Add time zone
          </button>
        </div>
        {hours.map((zone, index) => (
          <div className="meeting-zone" key={index}>
            <label className="meeting-zone-name">
              <span>Time zone</span>
              <select
                aria-label={`Time zone ${index + 1}`}
                value={zone.timeZone}
                onChange={(event) => setZoneHours(index, { timeZone: event.target.value })}
              >
                {!TIME_ZONES.includes(zone.timeZone) && <option>{zone.timeZone}</option>}
                {TIME_ZONES.map((timeZone) => <option key={timeZone}>{timeZone}</option>)}
              </select>
            </label>
            <label>
              <span>Starts</span>
              <input
                className="meeting-work-start"
                aria-label={`Working hours start for zone ${index + 1}`}
                type="time"
                value={zone.from}
                onChange={(event) => setZoneHours(index, { from: event.target.value })}
              />
            </label>
            <label>
              <span>Ends</span>
              <input
                className="meeting-work-end"
                aria-label={`Working hours end for zone ${index + 1}`}
                type="time"
                value={zone.until}
                onChange={(event) => setZoneHours(index, { until: event.target.value })}
              />
            </label>
            {hours.length > 1 && (
              <button
                type="button"
                className="ghost-button small meeting-remove-zone"
                aria-label={`Remove time zone ${index + 1}`}
                title={`Remove ${zone.timeZone}`}
                onClick={() => setHours((current) => current.filter((_, position) => position !== index))}
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="meeting-results" aria-labelledby="meeting-results-title">
        <h2 id="meeting-results-title">First available slots</h2>
        {result.error ? (
          <p className="meeting-results-message" role="status">{result.error}</p>
        ) : result.slots.length === 0 ? (
          <p className="meeting-results-message" role="status">
            No shared working hours can fit this meeting. Try a shorter duration or adjust the hours.
          </p>
        ) : (
          <ol className="meeting-slot-list" role="list" style={{ '--meeting-zone-count': hours.length } as CSSProperties}>
            {result.slots.slice(0, VISIBLE_SLOTS).map((slot, index) => {
              const feedback = copyFeedback?.slots === result.slots && copyFeedback.start === slot.start
                ? copyFeedback
                : null
              return (
                <li className="meeting-slot" key={slot.start}>
                  <dl className="meeting-slot-times">
                    {slot.zones.map((zone, position) => {
                      const time = summarizeMeetingRange(zone)
                      return (
                        <div key={position}>
                          <dt>{zone.timeZone}</dt>
                          <dd>
                            <strong>{time.time}</strong>
                            <small>{time.date} · {time.offset}</small>
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                  <div className="meeting-copy">
                    <button
                      type="button"
                      className={index === 0 ? 'primary-button small' : 'ghost-button small'}
                      onClick={() => void copyTimes(slot)}
                    >
                      <Icon name="copy" size={14} />
                      Copy times
                    </button>
                    <span role="status">{feedback?.message}</span>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'meeting-planner',
  name: 'Meeting Planner',
  description: 'Find working-hours overlap across up to four time zones.',
  icon: 'clock',
  accent: '#a79cff',
  order: 32,
  page: 'workspace',
  component: MeetingPlanner
}
