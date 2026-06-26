import type { ProxmoxPartitionRow } from '@/types/snapshot'

/**
 * Pure in-guest filesystem fill risk extract — mounts over a configurable
 * used-% threshold. Neutral measurement only — no verdict (ADR-0012).
 * No React/Zustand/Zod/DOM.
 *
 * `usedFraction` is a 0–1 fraction from the Proxmox report (cv4pve stores
 * "Used %" as a fraction). `null` means not derivable; those rows are
 * included with `usedPct: null` so the caller can display "—".
 */

export const FS_FILL_DEFAULT_THRESHOLD = 0.8

export interface FsRiskRow {
  node: string
  vmId: string
  vmName: string
  vmType: string
  mountPoint: string
  fsType: string
  totalGb: number
  usedGb: number
  /** 0–100 percentage; `null` when not derivable. */
  usedPct: number | null
  /** True when `usedFraction >= threshold`. False when fraction is null. */
  overThreshold: boolean
}

export interface FsFillRisk {
  /** All mounts at or above `threshold`, sorted by usedPct desc (null last). */
  overThreshold: FsRiskRow[]
  overThresholdCount: number
  /** Total distinct mount-point rows (all fill levels). */
  totalMounts: number
  /** Total distinct VMs with at least one mount point. */
  totalVms: number
  threshold: number
}

export const computeFsFillRisk = (
  rows: ProxmoxPartitionRow[],
  threshold = FS_FILL_DEFAULT_THRESHOLD,
): FsFillRisk => {
  const vmIds = new Set<string>()
  const riskRows: FsRiskRow[] = []

  for (const r of rows) {
    if (r.vmId) vmIds.add(`${r.node}:${r.vmId}`)
    const usedPct = r.usedFraction === null ? null : r.usedFraction * 100
    const overThreshold = r.usedFraction !== null && r.usedFraction >= threshold
    riskRows.push({
      node: r.node,
      vmId: r.vmId,
      vmName: r.vmName,
      vmType: r.vmType,
      mountPoint: r.mountPoint,
      fsType: r.fsType,
      totalGb: r.totalGb,
      usedGb: r.usedGb,
      usedPct,
      overThreshold,
    })
  }

  const over = riskRows
    .filter((r) => r.overThreshold)
    .sort((a, b) => {
      if (a.usedPct === null && b.usedPct === null) return 0
      if (a.usedPct === null) return 1
      if (b.usedPct === null) return -1
      return b.usedPct - a.usedPct
    })

  return {
    overThreshold: over,
    overThresholdCount: over.length,
    totalMounts: rows.length,
    totalVms: vmIds.size,
    threshold,
  }
}
