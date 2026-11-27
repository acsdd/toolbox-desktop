export interface PowerBatteryReading {
  status: 'battery' | 'no-battery' | 'unavailable'
  source: 'ac' | 'battery' | null
  chargePercent: number | null
  remainingSeconds: number | null
  checkedAt: number
}
