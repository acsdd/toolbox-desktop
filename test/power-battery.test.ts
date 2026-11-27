import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodePowerBattery } from '../src/main/services/power-battery.ts'

const checkedAt = 1_798_919_230_000

test('reads charge on AC without an estimated battery time', () => {
  const reading = decodePowerBattery('[1, 9, 73, 4294967295]', checkedAt)

  assert.deepEqual(reading, {
    status: 'battery', source: 'ac', chargePercent: 73, remainingSeconds: null, checkedAt
  })
})

test('reads charge and estimated time on battery power', () => {
  const reading = decodePowerBattery('[0, 1, 74, 5235]', checkedAt)

  assert.deepEqual(reading, {
    status: 'battery', source: 'battery', chargePercent: 74, remainingSeconds: 5235, checkedAt
  })
})

test('reports the absent battery flag separately from a failed read', () => {
  const reading = decodePowerBattery('[1, 128, 255, 4294967295]', checkedAt)

  assert.deepEqual(reading, {
    status: 'no-battery', source: 'ac', chargePercent: null, remainingSeconds: null, checkedAt
  })
})

test('reports unknown battery flags while preserving a known power source', () => {
  const reading = decodePowerBattery('[1, 255, 255, 4294967295]', checkedAt)

  assert.deepEqual(reading, {
    status: 'unavailable', source: 'ac', chargePercent: null, remainingSeconds: null, checkedAt
  })
})

test('reports malformed or empty responses as unavailable', () => {
  const fixtures = ['', 'Access denied', '[]', '[1, null, 80, 400]', '{"charge":80}']

  for (const fixture of fixtures) {
    assert.deepEqual(decodePowerBattery(fixture, checkedAt), {
      status: 'unavailable', source: null, chargePercent: null, remainingSeconds: null, checkedAt
    })
  }
})

test('preserves zero readings while omitting unknown or invalid metric values', () => {
  const fixtures = [
    { report: '[0, 4, 0, 0]', source: 'battery', charge: 0, remaining: 0 },
    { report: '[0, 1, 255, 4294967295]', source: 'battery', charge: null, remaining: null },
    { report: '[0, 1, 150, -1]', source: 'battery', charge: null, remaining: null },
    { report: '[1, 1, 60, 1200]', source: 'ac', charge: 60, remaining: null },
    { report: '[255, 1, 60, 1200]', source: null, charge: 60, remaining: 1200 }
  ]

  for (const { report, source, charge, remaining } of fixtures) {
    assert.deepEqual(decodePowerBattery(report, checkedAt), {
      status: 'battery', source, chargePercent: charge, remainingSeconds: remaining, checkedAt
    })
  }
})
