import { cores as coresOf, ghz as ghzOf, mib } from '@/engines/units'
import type { AccountingMode, ClusterAggregate } from '@/types/estate'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import { aggregateHostsPerCluster } from './perCluster'
import { aggregateVmsPerCluster } from './vinfoMerge'

/**
 * Join the host-side and VM-side rollups into one `ClusterAggregate` per
 * cluster — ported verbatim from vsizer `aggregateClusters.ts` with the
 * brand retrofit. The cluster set is taken from the HOST rows (a cluster
 * with VMs but no hosts cannot be sized).
 *
 * Stretched-cluster DR math (ADR-0007 — 50 % reservation, cpuDrFactor /
 * ramDrFactor) ports INTACT but is DORMANT in Phase 2: callers pass
 * `stretchedClusters = new Set()`. `vcpuPerPcpu` is computed against
 * `usablePhysicalCores` — PHYSICAL cores never threads (Moderate-4;
 * structurally guaranteed — `VHostRow` has no threads field).
 *
 * Output is sorted by `cluster.localeCompare` for stable render order.
 */

const computeMhzPerVcpu = (consumedGhz: number, vcpuAllocated: number): number =>
  vcpuAllocated === 0 ? 0 : (consumedGhz * 1000) / vcpuAllocated

export const aggregateClusters = ({
  vinfo,
  vhost,
  mode,
  stretchedClusters,
  datastoreCountByCluster,
}: {
  vinfo: VInfoRow[]
  vhost: VHostRow[]
  mode: AccountingMode
  stretchedClusters?: ReadonlySet<string>
  /** Per-cluster NAA-deduped datastore counts (from the vDatastore
   *  `Cluster name` column). `undefined` ⇒ the vDatastore sheet was
   *  absent → each cluster's `datastoreCount` is `null` (em-dash). When
   *  present, a cluster with no matching datastore gets `0`, not null. */
  datastoreCountByCluster?: ReadonlyMap<string, number>
}): ClusterAggregate[] => {
  const stretched = stretchedClusters ?? new Set<string>()
  const hostStats = aggregateHostsPerCluster(vhost)
  const vmStatsByCluster = new Map(aggregateVmsPerCluster(vinfo, mode).map((s) => [s.cluster, s]))

  return hostStats
    .map((h): ClusterAggregate => {
      const v = vmStatsByCluster.get(h.cluster)
      const vcpuAllocated = (v?.vcpuAllocated as number | undefined) ?? 0
      const isStretched = stretched.has(h.cluster)

      const physicalGhz = h.physicalGhz as number
      const consumedGhz = h.consumedGhz as number
      const physicalRamMib = h.physicalRamMib as number
      const consumedRamMib = h.consumedRamMib as number
      const physicalCores = h.physicalCores as number

      const drReservedGhz = isStretched ? 0.5 * physicalGhz : 0
      const availableGhz = physicalGhz - consumedGhz - drReservedGhz

      const drReservedRamMib = isStretched ? 0.5 * physicalRamMib : 0
      const availableRamMib = physicalRamMib - consumedRamMib - drReservedRamMib

      // Cores side — same DR shape as GHz / RAM. usablePhysicalCores is the
      // denominator the consolidation ratio actually uses.
      const usablePhysicalCores = isStretched ? 0.5 * physicalCores : physicalCores
      const vcpuPerPcpu = usablePhysicalCores === 0 ? 0 : vcpuAllocated / usablePhysicalCores

      // DR-aware utilization ratios (ADR-0011). Factor = physical /
      // (physical − reserved) — equals 2 for the V1 50 % reservation,
      // 1 when not stretched.
      const cpuDrFactor =
        isStretched && physicalGhz > 0 ? physicalGhz / (physicalGhz - drReservedGhz) : 1
      const ramDrFactor =
        isStretched && physicalRamMib > 0 ? physicalRamMib / (physicalRamMib - drReservedRamMib) : 1

      return {
        cluster: h.cluster,
        hostCount: h.hostCount,
        vmCount: v?.vmCount ?? 0,
        // null only when the vDatastore sheet was absent; otherwise a
        // cluster with no attributed datastore is a real `0`.
        datastoreCount:
          datastoreCountByCluster === undefined
            ? null
            : (datastoreCountByCluster.get(h.cluster) ?? 0),
        physicalCores: h.physicalCores,
        usablePhysicalCores: coresOf(usablePhysicalCores),
        vcpuPerPcpu,
        physicalGhz: h.physicalGhz,
        consumedGhz: h.consumedGhz,
        availableGhz: ghzOf(availableGhz),
        physicalRamMib: h.physicalRamMib,
        consumedRamMib: h.consumedRamMib,
        drReservedRamMib: mib(drReservedRamMib),
        availableRamMib: mib(availableRamMib),
        meanCpuRatio: h.meanCpuRatio * cpuDrFactor,
        maxCpuRatio: h.maxCpuRatio * cpuDrFactor,
        minCpuRatio: h.minCpuRatio * cpuDrFactor,
        meanRamRatio: h.meanRamRatio * ramDrFactor,
        maxRamRatio: h.maxRamRatio * ramDrFactor,
        minRamRatio: h.minRamRatio * ramDrFactor,
        vcpuAllocated: coresOf(vcpuAllocated),
        vramAllocatedMib: v?.vramAllocatedMib ?? mib(0),
        mhzPerVcpu: computeMhzPerVcpu(consumedGhz, vcpuAllocated),
        stretched: isStretched,
        drReservedGhz: ghzOf(drReservedGhz),
        // CPU Ready aggregates are sourced from the VM-side rollup; absent
        // VM rows default to the unreported state (null / 0 / false) —
        // never imply "all healthy" from absence (ADR-0012 §2).
        meanCpuReadinessPercent: v?.meanCpuReadinessPercent ?? null,
        maxCpuReadinessPercent: v?.maxCpuReadinessPercent ?? null,
        vmsAboveReadinessWarning: v?.vmsAboveReadinessWarning ?? 0,
        readinessAvailable: v?.readinessAvailable ?? false,
      }
    })
    .sort((a, b) => a.cluster.localeCompare(b.cluster))
}
