import type { ProxmoxDiskRow } from '@/types/snapshot'

/**
 * Pure disk hygiene extract — four risk categories from the `Disks` sheet:
 *  1. Orphaned/unused disks (`Is Unused` === 'X') → reclaimable space.
 *  2. Stray mounted ISOs (`Kind` === 'Cdrom' with a non-blank `File Name`).
 *  3. Disks excluded from backup (`Kind` === 'Disk', `Backup` is blank/not-X).
 *  4. Risky cache modes (non-empty `Cache` not in the safe set).
 *
 * Neutral measurement only — no verdict (ADR-0012). No React/Zustand/Zod/DOM.
 */

/** Cache modes considered acceptable (empty string = no cache policy set, which
 *  Proxmox treats as 'none' — safe). Modes outside this set are surfaced. */
const SAFE_CACHE_MODES = new Set(['', 'none', 'writeback', 'writethrough', 'directsync'])

export interface UnusedDiskRow {
  node: string
  vmId: string
  vmName: string
  id: string
  storage: string
  fileName: string
  sizeGb: number
}

export interface StrayIsoRow {
  node: string
  vmId: string
  vmName: string
  id: string
  storage: string
  fileName: string
  sizeGb: number
}

export interface NoBackupRow {
  node: string
  vmId: string
  vmName: string
  id: string
  storage: string
  fileName: string
  sizeGb: number
}

export interface RiskyCacheRow {
  node: string
  vmId: string
  vmName: string
  id: string
  storage: string
  cache: string
}

export interface DiskHygiene {
  unusedDisks: UnusedDiskRow[]
  unusedCount: number
  reclaimableGb: number
  strayIsos: StrayIsoRow[]
  strayIsoCount: number
  noBackupDisks: NoBackupRow[]
  noBackupCount: number
  riskyCacheDisks: RiskyCacheRow[]
  riskyCacheCount: number
}

export const computeDiskHygiene = (rows: ProxmoxDiskRow[]): DiskHygiene => {
  const unusedDisks: UnusedDiskRow[] = []
  const strayIsos: StrayIsoRow[] = []
  const noBackupDisks: NoBackupRow[] = []
  const riskyCacheDisks: RiskyCacheRow[] = []

  for (const r of rows) {
    if (r.isUnused) {
      unusedDisks.push({
        node: r.node,
        vmId: r.vmId,
        vmName: r.vmName,
        id: r.id,
        storage: r.storage,
        fileName: r.fileName,
        sizeGb: r.sizeGb,
      })
    }
    if (r.kind === 'Cdrom' && r.fileName.trim() !== '') {
      strayIsos.push({
        node: r.node,
        vmId: r.vmId,
        vmName: r.vmName,
        id: r.id,
        storage: r.storage,
        fileName: r.fileName,
        sizeGb: r.sizeGb,
      })
    }
    if (r.kind === 'Disk' && !r.isUnused && r.backup.trim() !== 'X') {
      noBackupDisks.push({
        node: r.node,
        vmId: r.vmId,
        vmName: r.vmName,
        id: r.id,
        storage: r.storage,
        fileName: r.fileName,
        sizeGb: r.sizeGb,
      })
    }
    if (r.kind === 'Disk' && !SAFE_CACHE_MODES.has(r.cache.trim().toLowerCase())) {
      riskyCacheDisks.push({
        node: r.node,
        vmId: r.vmId,
        vmName: r.vmName,
        id: r.id,
        storage: r.storage,
        cache: r.cache,
      })
    }
  }

  const reclaimableGb = unusedDisks.reduce((acc, d) => acc + d.sizeGb, 0)

  return {
    unusedDisks,
    unusedCount: unusedDisks.length,
    reclaimableGb,
    strayIsos,
    strayIsoCount: strayIsos.length,
    noBackupDisks,
    noBackupCount: noBackupDisks.length,
    riskyCacheDisks,
    riskyCacheCount: riskyCacheDisks.length,
  }
}
