import { useEffect, useState } from 'react'
import type { PowerBatteryReading } from '@shared/power-battery'
import { Icon } from '../../components/Icon'
import { formatUptime } from '../../lib/format'
import type { ToolDefinition } from '../types'
import './power-battery.css'

const sourceLabels = { ac: 'AC power', battery: 'Battery power' }
const checkedTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium', timeStyle: 'medium'
})

function PowerBatteryTool() {
  const [reading, setReading] = useState<PowerBatteryReading | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)
  const [refreshing, setRefreshing] = useState(true)

  useEffect(() => {
    let active = true

    async function read() {
      try {
        const result = await window.api.powerBattery.read()
        if (active) setReading(result)
      } catch {
        if (active) {
          setReading({
            status: 'unavailable', source: null, chargePercent: null, remainingSeconds: null,
            checkedAt: Date.now()
          })
        }
      } finally {
        if (active) setRefreshing(false)
      }
    }

    void read()
    return () => { active = false }
  }, [refreshCount])

  const charge = reading?.chargePercent ?? null
  const remaining = reading?.remainingSeconds ?? null

  return (
    <div className="power-battery">
      <section className="power-battery__summary" aria-label="Power and battery reading" aria-busy={refreshing}>
        {reading?.status === 'battery' && (
          <>
            <span className="power-battery__label">Battery charge</span>
            <strong className="power-battery__charge">{charge === null ? 'Unavailable' : `${charge}%`}</strong>
            {charge !== null && (
              <div className="power-battery__meter" aria-hidden="true">
                <span style={{ width: `${charge}%` }} />
              </div>
            )}
          </>
        )}
        {reading?.status === 'no-battery' && <p className="power-battery__message">No system battery detected</p>}
        {reading?.status === 'unavailable' && <p className="power-battery__message">Battery reading unavailable</p>}
        {!reading && <p className="power-battery__message">Reading power status…</p>}
      </section>

      {reading && (
        <dl className="power-battery__metrics">
          <div>
            <dt>Power source</dt>
            <dd>{reading.source ? sourceLabels[reading.source] : 'Unavailable'}</dd>
          </div>
          {reading.status === 'battery' && reading.source !== 'ac' && (
            <div>
              <dt>Estimated time remaining</dt>
              <dd>{remaining === null ? 'Unavailable' : formatUptime(remaining)}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="power-battery__actions">
        <button
          className="primary-button"
          type="button"
          aria-disabled={refreshing}
          onClick={() => {
            if (refreshing) return
            setRefreshing(true)
            setRefreshCount((count) => count + 1)
          }}
        >
          <Icon name="refresh" size={15} /> Refresh
        </button>
        <p className="power-battery__checked" role="status">
          {reading && (
            <>
              Last checked{' '}
              <time dateTime={new Date(reading.checkedAt).toISOString()}>
                {checkedTimeFormat.format(reading.checkedAt)}
              </time>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

export const manifest: ToolDefinition = {
  id: 'power-battery',
  name: 'Power & Battery',
  description: 'Check your Windows power source, battery charge, and estimated time remaining.',
  icon: 'gauge',
  accent: '#50b898',
  order: 35,
  page: 'workspace',
  component: PowerBatteryTool
}
