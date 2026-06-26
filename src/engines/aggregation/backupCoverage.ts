import type { GuestRow } from '@/types/guest'
import type { ProxmoxTaskRow } from '@/types/snapshot'
import { excelSerialToUnixMs } from './snapshotSprawl'

/**
 * Pure backup coverage + operational health extract from the `Cluster Tasks`
 * sheet. Neutral measurement only — no verdict (ADR-0012). No React/Zustand/
 * Zod/DOM. `today` is the injected reference clock.
 *
 * Backup coverage keyed by extracting the guest VMID from the vzdump task
 * `taskId` UPID string. Format: `UPID:<node>:<pid>:<pstart>:<starttime>:vzdump:<vmid>:<user>:`
 * The vmid segment is index 5 (0-based) or empty when vzdump ran for all guests.
 */

const MS_PER_DAY = 86_400_000

const extractVmidFromUpid = (taskId: string): string => {
  const parts = taskId.split(':')
  return parts[6] ?? ''
}

export interface BackupTaskRow {
  node: string
  taskId: string
  user: string
  status: string
  statusOk: boolean
  vmid: string
  /** Days since backup start; `null` when serial is absent. */
  ageDays: number | null
}

export interface GuestBackupStatus {
  vmid: string
  vmName: string
  /** Most recent successful vzdump age in days; `null` = never backed up. */
  lastSuccessAgeDays: number | null
  /** True when at least one recent successful vzdump task targets this guest. */
  covered: boolean
}

export interface TaskTypeSummary {
  type: string
  total: number
  ok: number
  failed: number
}

export interface BackupCoverage {
  vzdump: {
    tasks: BackupTaskRow[]
    totalCount: number
    successCount: number
    failedCount: number
    /** Distinct VMIDs with at least one successful vzdump. */
    coveredVmids: number
    /** Guests from the inventory with NO successful vzdump found. */
    uncoveredGuests: GuestBackupStatus[]
    uncoveredCount: number
    /** Per-guest last-backup age for all guests in the inventory. */
    guestStatuses: GuestBackupStatus[]
  }
  operationalHealth: {
    taskTypes: TaskTypeSummary[]
    totalTasks: number
    totalOk: number
    totalFailed: number
  }
}

const ageDaysOf = (serial: number | null, today: Date): number | null =>
  serial === null
    ? null
    : Math.max(0, Math.floor((today.getTime() - excelSerialToUnixMs(serial)) / MS_PER_DAY))

export const computeBackupCoverage = (
  tasks: ProxmoxTaskRow[],
  guests: GuestRow[],
  today: Date,
): BackupCoverage => {
  // Build vzdump rows with age
  const vzdumpRows: BackupTaskRow[] = tasks
    .filter((t) => t.type === 'vzdump')
    .map((t) => ({
      node: t.node,
      taskId: t.taskId,
      user: t.user,
      status: t.status,
      statusOk: t.statusOk,
      vmid: extractVmidFromUpid(t.taskId),
      ageDays: ageDaysOf(t.startSerial, today),
    }))

  // For each guest VMID, find the most recent successful vzdump age
  const bestAgeByVmid = new Map<string, number | null>()
  for (const r of vzdumpRows) {
    if (!r.statusOk || r.vmid === '') continue
    const prev = bestAgeByVmid.get(r.vmid)
    if (prev === undefined) {
      bestAgeByVmid.set(r.vmid, r.ageDays)
    } else if (r.ageDays !== null && (prev === null || r.ageDays < prev)) {
      bestAgeByVmid.set(r.vmid, r.ageDays)
    }
  }

  // Guest statuses keyed by vmInstanceUuid (which holds the Proxmox VMID)
  const guestStatuses: GuestBackupStatus[] = guests.map((g) => {
    const vmid = g.vmInstanceUuid
    const lastSuccessAgeDays = bestAgeByVmid.get(vmid) ?? null
    return {
      vmid,
      vmName: g.vmName,
      lastSuccessAgeDays,
      covered: lastSuccessAgeDays !== null,
    }
  })

  const uncoveredGuests = guestStatuses.filter((s) => !s.covered)

  const coveredVmids = [...bestAgeByVmid.keys()].length
  const successCount = vzdumpRows.filter((r) => r.statusOk).length
  const failedCount = vzdumpRows.filter((r) => !r.statusOk).length

  // Operational health: per-type task summary
  const typeMap = new Map<string, { total: number; ok: number; failed: number }>()
  for (const t of tasks) {
    const acc = typeMap.get(t.type) ?? { total: 0, ok: 0, failed: 0 }
    acc.total += 1
    if (t.statusOk) acc.ok += 1
    else acc.failed += 1
    typeMap.set(t.type, acc)
  }
  const taskTypes: TaskTypeSummary[] = [...typeMap.entries()]
    .map(([type, s]) => ({ type, ...s }))
    .sort((a, b) => b.total - a.total)

  const totalOk = tasks.filter((t) => t.statusOk).length
  const totalFailed = tasks.length - totalOk

  return {
    vzdump: {
      tasks: vzdumpRows,
      totalCount: vzdumpRows.length,
      successCount,
      failedCount,
      coveredVmids,
      uncoveredGuests,
      uncoveredCount: uncoveredGuests.length,
      guestStatuses,
    },
    operationalHealth: {
      taskTypes,
      totalTasks: tasks.length,
      totalOk,
      totalFailed,
    },
  }
}
