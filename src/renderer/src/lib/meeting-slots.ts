export interface MeetingWorkHours {
  timeZone: string
  from: string
  until: string
}

interface LocalMeetingTime {
  date: string
  time: string
  offset: string
}

interface MeetingZoneTimes {
  timeZone: string
  start: LocalMeetingTime
  end: LocalMeetingTime
}

export interface MeetingSlot {
  start: number
  end: number
  zones: MeetingZoneTimes[]
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const START_STEP = 15 * MINUTE

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    era: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset'
  })
}

function localTime(instant: number, formatter: Intl.DateTimeFormat): LocalMeetingTime {
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]))
  const year = parts.year.padStart(4, '0')
  return {
    date: parts.era === 'AD' ? `${year}-${parts.month}-${parts.day}` : `${parts.era} ${year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    offset: parts.timeZoneName === 'GMT' ? 'UTC+00:00' : parts.timeZoneName.replace('GMT', 'UTC')
  }
}

export function localMeetingDate(instant: number, timeZone: string): string {
  return localTime(instant, zoneFormatter(timeZone)).date
}

export function isMeetingTimeZone(timeZone: string): boolean {
  if (!/^[a-z][\w/+-]*$/i.test(timeZone)) return false
  try {
    zoneFormatter(timeZone)
    return true
  } catch {
    return false
  }
}

export function isMeetingWorkTime(time: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
}

export function findMeetingSlots(
  date: string,
  hours: MeetingWorkHours[],
  durationMinutes: number
): MeetingSlot[] {
  const midnightUtc = Date.parse(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000') ||
      !Number.isFinite(midnightUtc) || new Date(midnightUtc).toISOString().slice(0, 10) !== date) {
    throw new RangeError('Choose a valid meeting date.')
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
    throw new RangeError('Enter a duration from 1 to 1440 minutes.')
  }
  if (hours.length < 1 || hours.length > 4) {
    throw new RangeError('Choose between one and four time zones.')
  }

  const zones = hours.map(({ timeZone, from, until }) => {
    if (!isMeetingWorkTime(from) || !isMeetingWorkTime(until) || from >= until) {
      throw new RangeError(`Set a start and later end time for ${timeZone}.`)
    }
    return { timeZone, from, until, formatter: zoneFormatter(timeZone) }
  })

  const slots: MeetingSlot[] = []
  const duration = durationMinutes * MINUTE
  let sharedStart: number | null = null

  // Allow for time zones on either side of the selected date. Scan actual
  // minutes so skipped and repeated local times use their real elapsed duration.
  for (let instant = midnightUtc - 24 * HOUR; instant < midnightUtc + 48 * HOUR; instant += MINUTE) {
    const available = zones.every(({ from, until, formatter }, index) => {
      const local = localTime(instant, formatter)
      return (index > 0 || local.date === date) && local.time >= from && local.time < until
    })
    if (!available) {
      sharedStart = null
      continue
    }

    sharedStart ??= instant
    const end = instant + MINUTE
    const start = end - duration
    if (start < sharedStart || (start - sharedStart) % START_STEP !== 0) continue

    slots.push({
      start,
      end,
      zones: zones.map(({ timeZone, formatter }) => ({
        timeZone,
        start: localTime(start, formatter),
        end: localTime(end, formatter)
      }))
    })
  }

  return slots
}

export function summarizeMeetingRange({ start, end }: MeetingZoneTimes) {
  const date = start.date === end.date ? start.date : `${start.date} → ${end.date}`
  const offset = start.offset === end.offset ? start.offset : `${start.offset} → ${end.offset}`
  return { date, time: `${start.time}–${end.time}`, offset }
}

export function formatMeetingTimes(slot: MeetingSlot): string {
  return slot.zones.map((zone) => {
    const { date, time, offset } = summarizeMeetingRange(zone)
    return `${zone.timeZone}: ${date}, ${time} (${offset})`
  }).join('\n')
}
