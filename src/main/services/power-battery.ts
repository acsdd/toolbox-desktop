import { execFile } from 'node:child_process'
import { win32 } from 'node:path'
import { promisify } from 'node:util'
import type { PowerBatteryReading } from '../../shared/power-battery'

const execFileAsync = promisify(execFile)

// Read a single native snapshot so the power source and charge describe the same instant.
const POWER_STATUS_SCRIPT = String.raw`$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;

public static class ToolboxPowerStatus {
    [StructLayout(LayoutKind.Sequential)]
    public struct Snapshot {
        public byte ACLineStatus;
        public byte BatteryFlag;
        public byte BatteryLifePercent;
        public byte SystemStatusFlag;
        public uint BatteryLifeTime;
        public uint BatteryFullLifeTime;
    }

    [DllImport("kernel32.dll")]
    public static extern bool GetSystemPowerStatus(out Snapshot status);
}
'@
$status = New-Object ToolboxPowerStatus+Snapshot
if (-not [ToolboxPowerStatus]::GetSystemPowerStatus([ref]$status)) {
    exit 1
}
ConvertTo-Json -Compress -InputObject @(
    $status.ACLineStatus, $status.BatteryFlag, $status.BatteryLifePercent, $status.BatteryLifeTime
)
`

const encodedPowerStatusScript = Buffer.from(POWER_STATUS_SCRIPT, 'utf16le').toString('base64')
const UNKNOWN_BATTERY_FLAG = 255
const NO_SYSTEM_BATTERY = 128
const UNKNOWN_REMAINING_SECONDS = 0xffffffff

export function decodePowerBattery(stdout: string, checkedAt: number): PowerBatteryReading {
  const reading: PowerBatteryReading = {
    status: 'unavailable', source: null, chargePercent: null, remainingSeconds: null, checkedAt
  }

  let fields: unknown
  try {
    fields = JSON.parse(stdout)
  } catch {
    return reading
  }
  if (!Array.isArray(fields) || fields.length !== 4 || !fields.every(Number.isInteger)) return reading

  const [lineStatus, batteryFlag, percent, seconds] = fields as number[]
  if (lineStatus === 1) reading.source = 'ac'
  if (lineStatus === 0) reading.source = 'battery'
  if (batteryFlag < 0 || batteryFlag >= UNKNOWN_BATTERY_FLAG) return reading

  if (batteryFlag & NO_SYSTEM_BATTERY) {
    reading.status = 'no-battery'
    return reading
  }

  reading.status = 'battery'
  if (percent >= 0 && percent <= 100) reading.chargePercent = percent
  if (reading.source !== 'ac' && seconds >= 0 && seconds < UNKNOWN_REMAINING_SECONDS) {
    reading.remainingSeconds = seconds
  }
  return reading
}

async function readPowerBattery(): Promise<PowerBatteryReading> {
  let stdout = ''
  const windows = process.env.SystemRoot
  if (process.platform === 'win32' && windows && win32.isAbsolute(windows)) {
    try {
      const executable = win32.join(windows, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      const result = await execFileAsync(
        executable,
        ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedPowerStatusScript],
        { timeout: 5000, windowsHide: true, maxBuffer: 8192 }
      )
      stdout = result.stdout
    } catch {
      // A failed or timed-out query leaves the reading unavailable.
    }
  }
  return decodePowerBattery(stdout, Date.now())
}

let pendingReading: Promise<PowerBatteryReading> | undefined

export function getPowerBattery(): Promise<PowerBatteryReading> {
  pendingReading ??= readPowerBattery().finally(() => {
    pendingReading = undefined
  })
  return pendingReading
}
