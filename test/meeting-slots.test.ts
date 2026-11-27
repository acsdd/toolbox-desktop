import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  findMeetingSlots,
  formatMeetingTimes,
  localMeetingDate
} from '../src/renderer/src/lib/meeting-slots.ts'

test('uses the calendar date of the selected time zone', () => {
  assert.equal(
    localMeetingDate(Date.parse('2026-11-28T01:00:00Z'), 'America/Los_Angeles'),
    '2026-11-27'
  )
})

test('finds the first start that fits half-hour-offset working hours', () => {
  const slots = findMeetingSlots('2026-01-15', [
    { timeZone: 'UTC', from: '09:00', until: '10:00' },
    { timeZone: 'Asia/Kolkata', from: '14:45', until: '15:45' }
  ], 30)

  assert.deepEqual(slots.map(({ start }) => start), [
    Date.parse('2026-01-15T09:15:00Z'),
    Date.parse('2026-01-15T09:30:00Z')
  ])
  assert.equal(formatMeetingTimes(slots[0]), [
    'UTC: 2026-01-15, 09:15–09:45 (UTC+00:00)',
    'Asia/Kolkata: 2026-01-15, 14:45–15:15 (UTC+05:30)'
  ].join('\n'))
})

test('uses the first zone as the date anchor when a zone is on the next day', () => {
  const slots = findMeetingSlots('2026-11-27', [
    { timeZone: 'America/Los_Angeles', from: '15:00', until: '17:00' },
    { timeZone: 'Asia/Tokyo', from: '09:00', until: '09:30' }
  ], 30)

  assert.equal(slots.length, 1)
  assert.equal(formatMeetingTimes(slots[0]), [
    'America/Los_Angeles: 2026-11-27, 16:00–16:30 (UTC-08:00)',
    'Asia/Tokyo: 2026-11-28, 09:00–09:30 (UTC+09:00)'
  ].join('\n'))
})

test('counts elapsed minutes across a spring-forward clock change', () => {
  const slots = findMeetingSlots('2026-03-08', [
    { timeZone: 'America/New_York', from: '01:30', until: '03:30' }
  ], 60)

  assert.equal(slots.length, 1)
  assert.equal(slots[0].end - slots[0].start, 60 * 60_000)
  assert.equal(
    formatMeetingTimes(slots[0]),
    'America/New_York: 2026-03-08, 01:30–03:30 (UTC-05:00 → UTC-04:00)'
  )
})

test('omits starts in the hour skipped by spring-forward', () => {
  assert.deepEqual(findMeetingSlots('2026-03-08', [
    { timeZone: 'America/New_York', from: '02:00', until: '03:00' }
  ], 15), [])
})

test('preserves both fall-back occurrences as distinct slots with their offsets', () => {
  const slots = findMeetingSlots('2026-11-01', [
    { timeZone: 'America/New_York', from: '01:15', until: '01:45' }
  ], 30)

  assert.deepEqual(slots.map(formatMeetingTimes), [
    'America/New_York: 2026-11-01, 01:15–01:45 (UTC-04:00)',
    'America/New_York: 2026-11-01, 01:15–01:45 (UTC-05:00)'
  ])
})

test('requires uninterrupted availability throughout a meeting', () => {
  assert.deepEqual(findMeetingSlots('2026-11-01', [
    { timeZone: 'America/New_York', from: '01:15', until: '01:45' }
  ], 45), [])
})

test('returns no slots when the zones have no shared working hours', () => {
  assert.deepEqual(findMeetingSlots('2026-01-15', [
    { timeZone: 'UTC', from: '09:00', until: '10:00' },
    { timeZone: 'Europe/London', from: '10:00', until: '11:00' }
  ], 15), [])
})

test('retains the minute at which a working window starts', () => {
  const slots = findMeetingSlots('2026-01-15', [
    { timeZone: 'UTC', from: '09:04', until: '09:34' }
  ], 30)

  assert.equal(slots.length, 1)
  assert.equal(slots[0].start, Date.parse('2026-01-15T09:04:00Z'))
})

test('rejects invalid dates instead of rolling them forward', () => {
  assert.throws(() => findMeetingSlots('2026-02-29', [
    { timeZone: 'UTC', from: '09:00', until: '10:00' }
  ], 30), RangeError)
})
