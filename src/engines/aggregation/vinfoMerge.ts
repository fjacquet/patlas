import { cores as coresOf, mib } from '@/engines/units'
import type { AccountingMode, ClusterVmStats, TopReadinessVm } from '@/types/estate'
import type { GuestRow } from '@/types/guest'
import { CONTENTION_THRESHOLDS, TOP_N_DEFAULT } from './contention'

/**
 * VM-side rollup for one cluster — ported from vsizer `vinfoMerge.ts`.
 * Deviations vs the port:
 * - The ONE genuine logic change (Critical-6): the powered-off filter is
 *   now mode-driven — `if (mode !== 'configured' && !row.poweredOn)`.
 *   `configured` keeps powered-off VMs in the vCPU/vRAM sums.
 * - `v.vramMb` → `v.vramMib: MiB`; `v.vcpu` is branded `Cores`.
 * - vsizer's active-memory sum chain is DROPPED — vatlas' Phase-1
 *   `GuestRow` does not parse active memory, so it would be dead code.
 * - `readinessStats` is EXPORTED so `perEsx` reuses it (DRY mandate) and
 *   is ALWAYS powered-on-only regardless of mode (a powered-off VM has
 *   no CPU Ready — ADR-0012).
 */

const groupByCluster = (rows: GuestRow[], mode: AccountingMode): Map<string, GuestRow[]> => {
  const out = new Map<string, GuestRow[]>()
  for (const row of rows) {
    // Configured = all VMs; Active / Storage-realistic exclude powered-off
    // from the vCPU/vRAM sums (Critical-6, RESEARCH §Three Accounting Modes).
    if (mode !== 'configured' && !row.poweredOn) continue
    if (row.cluster.length === 0) continue
    const list = out.get(row.cluster) ?? []
    list.push(row)
    out.set(row.cluster, list)
  }
  return out
}

/**
 * Powered-on-only readiness reporters for one cluster's VMs. Always
 * filtered to `poweredOn` regardless of accounting mode — a powered-off
 * VM cannot have CPU Ready (ADR-0012).
 *
 * - Reporter filter via `v != null && Number.isFinite(v)` narrowing
 *   (no `as` cast; defends against NaN/Infinity past the parser).
 * - Mean is **arithmetic** (ADR-0012 §3 — not vCPU-weighted).
 * - Max via `reduce`, NOT `Math.max(...values)` — avoids the V8 ~65 535
 *   spread-arg limit on hyperscaler-sized clusters.
 *
 * Exported for DRY reuse by `perEsx.ts` (RESEARCH §perEsx).
 */
export const readinessStats = (
  rows: GuestRow[],
): {
  mean: number | null
  max: number | null
  countAboveWarning: number
  available: boolean
} => {
  const values: number[] = []
  for (const r of rows) {
    if (!r.poweredOn) continue
    const v = r.cpuReadinessPercent
    if (v != null && Number.isFinite(v)) values.push(v)
  }
  if (values.length === 0) {
    return { mean: null, max: null, countAboveWarning: 0, available: false }
  }
  let sum = 0
  let max = Number.NEGATIVE_INFINITY
  let countAboveWarning = 0
  for (const v of values) {
    sum += v
    if (v > max) max = v
    if (v > CONTENTION_THRESHOLDS.warning) countAboveWarning += 1
  }
  return { mean: sum / values.length, max, countAboveWarning, available: true }
}

/**
 * Group VMs by cluster (accounting-mode aware) and sum allocations.
 */
export const aggregateVmsPerCluster = (
  vinfo: GuestRow[],
  mode: AccountingMode,
): ClusterVmStats[] => {
  const grouped = groupByCluster(vinfo, mode)
  const out: ClusterVmStats[] = []
  for (const [cluster, vms] of grouped) {
    const ready = readinessStats(vms)
    out.push({
      cluster,
      vmCount: vms.length,
      vcpuAllocated: coresOf(vms.reduce((acc, v) => acc + (v.vcpu as number), 0)),
      vramAllocatedMib: mib(vms.reduce((acc, v) => acc + (v.vramMib as number), 0)),
      meanCpuReadinessPercent: ready.mean,
      maxCpuReadinessPercent: ready.max,
      vmsAboveReadinessWarning: ready.countAboveWarning,
      readinessAvailable: ready.available,
    })
  }
  return out
}

/**
 * Per-cluster top-N most-contended VMs (sorted desc by
 * `cpuReadinessPercent`). Only powered-on VMs that reported a value make
 * the list. Always powered-on-only regardless of mode. See ADR-0012 §4.
 */
export const topReadinessVmsByCluster = (
  vinfo: GuestRow[],
  topN: number = TOP_N_DEFAULT,
): Map<string, TopReadinessVm[]> => {
  const grouped = groupByCluster(vinfo, 'active')
  const out = new Map<string, TopReadinessVm[]>()
  for (const [cluster, vms] of grouped) {
    const reporters: TopReadinessVm[] = []
    for (const r of vms) {
      const v = r.cpuReadinessPercent
      if (v != null && Number.isFinite(v)) {
        reporters.push({
          vmName: r.vmName,
          cluster: r.cluster,
          vcpu: r.vcpu,
          cpuReadinessPercent: v,
        })
      }
    }
    const top = reporters
      .sort((a, b) => b.cpuReadinessPercent - a.cpuReadinessPercent)
      .slice(0, topN)
    if (top.length > 0) out.set(cluster, top)
  }
  return out
}
