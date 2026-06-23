import { cores as coresOf, ghz as ghzOf, mib } from '@/engines/units'
import type { ClusterAggregate, GlobalSummary } from '@/types/estate'

/**
 * Estate-wide rollup — ported from vsizer `globals.ts` with the brand
 * retrofit. Deviations vs the port:
 * - the active-memory sum field is DROPPED (vatlas `VInfoRow` lacks it).
 * - `datastoreCount` + `totalStorageMib` ADDED (DSH-02). globals.ts only
 *   CARRIES these fields on `GlobalSummary`/`emptySummary`; they are
 *   populated by the `estateView` assembler from `perDatastore` output.
 *
 * `emptySummary` is the frozen-constant idiom that also models
 * `EMPTY_VIEW.globals` for the `useEstateView` empty state.
 */

const sum = (xs: readonly number[]): number => xs.reduce((acc, n) => acc + n, 0)

export const emptySummary: GlobalSummary = Object.freeze({
  clusterCount: 0,
  hostCount: 0,
  vmCount: 0,
  physicalCores: coresOf(0),
  usablePhysicalCores: coresOf(0),
  vcpuPerPcpu: 0,
  physicalGhz: ghzOf(0),
  consumedGhz: ghzOf(0),
  availableGhz: ghzOf(0),
  physicalRamMib: mib(0),
  consumedRamMib: mib(0),
  availableRamMib: mib(0),
  meanCpuRatio: 0,
  meanRamRatio: 0,
  vcpuAllocated: coresOf(0),
  vramAllocatedMib: mib(0),
  mhzPerVcpu: 0,
  vmsAboveReadinessWarning: null,
  datastoreCount: 0,
  totalStorageMib: mib(0),
})

/**
 * Estate-wide rollup. Drives the GlobalSummaryCard (DSH-02).
 *
 * - `meanCpuRatio`/`meanRamRatio` are capacity-weighted — the divisor is
 *   the physical capacity sum (ADR-0011).
 * - `vmsAboveReadinessWarning` is `null` when no cluster reports
 *   readiness — never collapse absence to 0 (ADR-0012).
 * - `datastoreCount`/`totalStorageMib` carry through from the caller's
 *   `perDatastore`-derived totals (defaults match `emptySummary`).
 */
export const aggregateGlobals = (
  clusters: readonly ClusterAggregate[],
  datastoreCount = 0,
  totalStorageMib = mib(0),
): GlobalSummary => {
  if (clusters.length === 0) {
    return { ...emptySummary, datastoreCount, totalStorageMib }
  }

  const physicalCores = sum(clusters.map((c) => c.physicalCores as number))
  const usablePhysicalCores = sum(clusters.map((c) => c.usablePhysicalCores as number))
  const physicalGhz = sum(clusters.map((c) => c.physicalGhz as number))
  const consumedGhz = sum(clusters.map((c) => c.consumedGhz as number))
  const availableGhz = sum(clusters.map((c) => c.availableGhz as number))

  const physicalRamMib = sum(clusters.map((c) => c.physicalRamMib as number))
  const consumedRamMib = sum(clusters.map((c) => c.consumedRamMib as number))
  const availableRamMib = sum(clusters.map((c) => c.availableRamMib as number))

  const hostCount = sum(clusters.map((c) => c.hostCount))
  const vmCount = sum(clusters.map((c) => c.vmCount))
  const vcpuAllocated = sum(clusters.map((c) => c.vcpuAllocated as number))
  const vramAllocatedMib = sum(clusters.map((c) => c.vramAllocatedMib as number))

  // CPU Ready estate rollup (ADR-0012 §7). null when zero clusters
  // report — mirrors the never-collapse-absence-to-0 contract.
  const reportingReadiness = clusters.filter((c) => c.readinessAvailable)
  const vmsAboveReadinessWarning =
    reportingReadiness.length === 0
      ? null
      : reportingReadiness.reduce((acc, c) => acc + c.vmsAboveReadinessWarning, 0)

  // Capacity-weighted (ADR-0011). Divisor is the physical capacity sum.
  const meanCpuRatio = physicalGhz <= 0 ? 0 : consumedGhz / physicalGhz
  const meanRamRatio = physicalRamMib <= 0 ? 0 : consumedRamMib / physicalRamMib
  const mhzPerVcpu = vcpuAllocated === 0 ? 0 : (consumedGhz * 1000) / vcpuAllocated
  const vcpuPerPcpu = usablePhysicalCores === 0 ? 0 : vcpuAllocated / usablePhysicalCores

  return {
    clusterCount: clusters.length,
    hostCount,
    vmCount,
    physicalCores: coresOf(physicalCores),
    usablePhysicalCores: coresOf(usablePhysicalCores),
    vcpuPerPcpu,
    physicalGhz: ghzOf(physicalGhz),
    consumedGhz: ghzOf(consumedGhz),
    availableGhz: ghzOf(availableGhz),
    physicalRamMib: mib(physicalRamMib),
    consumedRamMib: mib(consumedRamMib),
    availableRamMib: mib(availableRamMib),
    meanCpuRatio,
    meanRamRatio,
    vcpuAllocated: coresOf(vcpuAllocated),
    vramAllocatedMib: mib(vramAllocatedMib),
    mhzPerVcpu,
    vmsAboveReadinessWarning,
    datastoreCount,
    totalStorageMib,
  }
}
