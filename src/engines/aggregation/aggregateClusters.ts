import { cores as coresOf, ghz as ghzOf, mib } from '@/engines/units'
import type { AccountingMode, ClusterAggregate } from '@/types/estate'
import type { GuestRow } from '@/types/guest'
import type { NodeRow } from '@/types/node'
import { aggregateHostsPerCluster } from './perCluster'
import { aggregateVmsPerCluster } from './vinfoMerge'

/**
 * Join the host-side and VM-side rollups into one `ClusterAggregate` per
 * cluster — ported verbatim from vsizer `aggregateClusters.ts` with the
 * brand retrofit. The cluster set is taken from the HOST rows (a cluster
 * with VMs but no hosts cannot be sized).
 *
 * `vcpuPerPcpu` is computed against `usablePhysicalCores` — PHYSICAL cores
 * never threads (Moderate-4; structurally guaranteed — `NodeRow` has no
 * threads field).
 *
 * Output is sorted by `cluster.localeCompare` for stable render order.
 */

const computeMhzPerVcpu = (consumedGhz: number, vcpuAllocated: number): number =>
  vcpuAllocated === 0 ? 0 : (consumedGhz * 1000) / vcpuAllocated

export const aggregateClusters = ({
  guests: vinfo,
  nodes: vhost,
  mode,
  datastoreCountByCluster,
  allocRatios,
}: {
  guests: GuestRow[]
  nodes: NodeRow[]
  mode: AccountingMode
  /** vCPU:pCPU and vRAM overcommit ratios from the URL-hash sliders.
   *  Defaults to 4:1 / 1:1 (ALC-02). Changes the headroom verdict ONLY —
   *  never `vcpuPerPcpu` (ALC-04). */
  allocRatios?: { cpuRatio: number; ramRatio: number }
  /** Per-cluster NAA-deduped datastore counts (from the vDatastore
   *  `Cluster name` column). `undefined` ⇒ the vDatastore sheet was
   *  absent → each cluster's `datastoreCount` is `null` (em-dash). When
   *  present, a cluster with no matching datastore gets `0`, not null. */
  datastoreCountByCluster?: ReadonlyMap<string, number>
}): ClusterAggregate[] => {
  const cpuRatio = allocRatios?.cpuRatio ?? 4
  const ramRatio = allocRatios?.ramRatio ?? 1
  const hostStats = aggregateHostsPerCluster(vhost)
  const vmStatsByCluster = new Map(aggregateVmsPerCluster(vinfo, mode).map((s) => [s.cluster, s]))

  return hostStats
    .map((h): ClusterAggregate => {
      const v = vmStatsByCluster.get(h.cluster)
      const vcpuAllocated = (v?.vcpuAllocated as number | undefined) ?? 0

      const physicalGhz = h.physicalGhz as number
      const consumedGhz = h.consumedGhz as number
      const physicalRamMib = h.physicalRamMib as number
      const consumedRamMib = h.consumedRamMib as number
      const physicalCores = h.physicalCores as number

      const availableGhz = physicalGhz - consumedGhz
      const availableRamMib = physicalRamMib - consumedRamMib

      // usablePhysicalCores equals physicalCores (no DR reservation).
      const usablePhysicalCores = physicalCores
      const vcpuPerPcpu = usablePhysicalCores === 0 ? 0 : vcpuAllocated / usablePhysicalCores

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
        availableRamMib: mib(availableRamMib),
        meanCpuRatio: h.meanCpuRatio,
        maxCpuRatio: h.maxCpuRatio,
        minCpuRatio: h.minCpuRatio,
        meanRamRatio: h.meanRamRatio,
        maxRamRatio: h.maxRamRatio,
        minRamRatio: h.minRamRatio,
        vcpuAllocated: coresOf(vcpuAllocated),
        vramAllocatedMib: v?.vramAllocatedMib ?? mib(0),
        // Headroom verdict at the active ratios (ALC). usablePhysicalCores
        // equals physicalCores; the slider scales the verdict, NOT
        // vcpuPerPcpu (which stays physical-core-based — ALC-04).
        capacityVcpu: coresOf(usablePhysicalCores * cpuRatio),
        capacityRamMib: mib(physicalRamMib * ramRatio),
        mhzPerVcpu: computeMhzPerVcpu(consumedGhz, vcpuAllocated),
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
