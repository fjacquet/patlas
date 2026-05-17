import { cores as coresOf, ghz as ghzOf, mib } from '@/engines/units'
import type { AccountingMode, ClusterAggregate } from '@/types/estate'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import { physicalGhz as physicalGhzOf } from './ghz'
import { aggregateHostsPerCluster } from './perCluster'
import { aggregateVmsPerCluster } from './vinfoMerge'

/**
 * ADR-0007-EXT (Phase 4) — per-site stretched reservation.
 *
 * The V1 flat 50 % reservation (ADR-0007) is replaced by a PER-SITE,
 * PER-RESOURCE fraction `f = maxSiteCapacity / totalCapacity`, computed
 * INDEPENDENTLY for GHz, RAM-MiB and cores (RESEARCH Open-Question 2
 * default — per-resource, not one blended fraction). The DR factor for a
 * resource is `1 / (1 − f)` (equals 2 at the symmetric f = 0.5, matching
 * the shipped V1 behaviour exactly).
 *
 * `siteData` is a FACTUAL discriminator (UAT G1 — the stretched flag is
 * the user's declaration; the engine never judges it, only states where
 * the split came from). NO high/medium/low verdict, NO chip:
 *   - every host carries a fault domain AND ≥2 distinct domains
 *       → 'detected' (reservation from REAL per-site capacity; Site A/B set)
 *   - partial OR no fault-domain coverage
 *       → 'assumed'  (symmetric f = 0.5; per-site values null/em-dash)
 *
 * `reservedFraction` exposed on the aggregate is the GHz-basis fraction
 * (the primary DR resource; equal across resources for homogeneous hosts).
 */
const SYMMETRIC_FRACTION = 0.5

interface Reservation {
  fGhz: number
  fRam: number
  fCores: number
  siteData: 'detected' | 'assumed'
  siteACapacityGhz: number | null
  siteBCapacityGhz: number | null
  siteACapacityRamMib: number | null
  siteBCapacityRamMib: number | null
}

const hostGhz = (h: VHostRow): number => physicalGhzOf(h.speedMhz, h.cores) as number

const maxFraction = (byDomain: Map<string, number>): number => {
  let total = 0
  let max = 0
  for (const cap of byDomain.values()) {
    total += cap
    if (cap > max) max = cap
  }
  return total === 0 ? 0 : max / total
}

const sumByDomain = (hosts: VHostRow[], pick: (h: VHostRow) => number): Map<string, number> => {
  const m = new Map<string, number>()
  for (const h of hosts) m.set(h.faultDomain, (m.get(h.faultDomain) ?? 0) + pick(h))
  return m
}

const twoLargest = (byDomain: Map<string, number>): [number, number | null] => {
  const sorted = [...byDomain.values()].sort((a, b) => b - a)
  return [sorted[0] ?? 0, sorted.length >= 2 ? (sorted[1] ?? null) : null]
}

/**
 * Per-resource reservation fraction + factual confidence for one cluster's
 * hosts. See the ADR-0007-EXT block above for the decision rationale.
 */
const reservationFor = (hosts: VHostRow[]): Reservation => {
  const tagged = hosts.filter((h) => h.faultDomain !== '')
  const distinct = new Set(tagged.map((h) => h.faultDomain))

  if (tagged.length === hosts.length && hosts.length > 0 && distinct.size >= 2) {
    const ghzByFd = sumByDomain(hosts, hostGhz)
    const ramByFd = sumByDomain(hosts, (h) => h.memoryMib as number)
    const coresByFd = sumByDomain(hosts, (h) => h.cores as number)
    const [aGhz, bGhz] = twoLargest(ghzByFd)
    const [aRam, bRam] = twoLargest(ramByFd)
    return {
      fGhz: maxFraction(ghzByFd),
      fRam: maxFraction(ramByFd),
      fCores: maxFraction(coresByFd),
      siteData: 'detected',
      siteACapacityGhz: aGhz,
      siteBCapacityGhz: bGhz,
      siteACapacityRamMib: aRam,
      siteBCapacityRamMib: bRam,
    }
  }

  // Absent OR partial fault-domain coverage — assume a symmetric split.
  // UAT G1: no partial/none judgement — both collapse to the single
  // factual 'assumed'. Sites cannot be determined → null (em-dash).
  return {
    fGhz: SYMMETRIC_FRACTION,
    fRam: SYMMETRIC_FRACTION,
    fCores: SYMMETRIC_FRACTION,
    siteData: 'assumed',
    siteACapacityGhz: null,
    siteBCapacityGhz: null,
    siteACapacityRamMib: null,
    siteBCapacityRamMib: null,
  }
}

const groupHostsByCluster = (vhost: VHostRow[]): Map<string, VHostRow[]> => {
  const m = new Map<string, VHostRow[]>()
  for (const h of vhost) {
    if (h.cluster.length === 0) continue
    const list = m.get(h.cluster) ?? []
    list.push(h)
    m.set(h.cluster, list)
  }
  return m
}

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
  allocRatios,
}: {
  vinfo: VInfoRow[]
  vhost: VHostRow[]
  mode: AccountingMode
  stretchedClusters?: ReadonlySet<string>
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
  const stretched = stretchedClusters ?? new Set<string>()
  const cpuRatio = allocRatios?.cpuRatio ?? 4
  const ramRatio = allocRatios?.ramRatio ?? 1
  const hostStats = aggregateHostsPerCluster(vhost)
  const vmStatsByCluster = new Map(aggregateVmsPerCluster(vinfo, mode).map((s) => [s.cluster, s]))
  // Raw host rows per cluster — perCluster.ts intentionally discards
  // per-host fault domain, so the per-site reservation is computed here
  // from the unaggregated rows (KISS — no perCluster.ts rewrite).
  const hostsByCluster = groupHostsByCluster(vhost)

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

      // Per-site, per-resource reservation (ADR-0007-EXT). Non-stretched
      // clusters reserve nothing; siteData is 'assumed' but unused (the UI
      // gates every stretched row on `stretched`).
      const res = isStretched
        ? reservationFor(hostsByCluster.get(h.cluster) ?? [])
        : ({
            fGhz: 0,
            fRam: 0,
            fCores: 0,
            siteData: 'assumed',
            siteACapacityGhz: null,
            siteBCapacityGhz: null,
            siteACapacityRamMib: null,
            siteBCapacityRamMib: null,
          } satisfies Reservation)

      const drReservedGhz = res.fGhz * physicalGhz
      const availableGhz = physicalGhz - consumedGhz - drReservedGhz

      const drReservedRamMib = res.fRam * physicalRamMib
      const availableRamMib = physicalRamMib - consumedRamMib - drReservedRamMib

      // Cores side — same DR shape as GHz / RAM. usablePhysicalCores is the
      // denominator the consolidation ratio actually uses: physical minus
      // the reserved cores fraction (= 0.5·physical at the symmetric split,
      // preserving shipped V1 behaviour exactly).
      const usablePhysicalCores = (1 - res.fCores) * physicalCores
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
        // Headroom verdict at the active ratios (ALC). usablePhysicalCores
        // is already DR-aware; the slider scales the verdict, NOT
        // vcpuPerPcpu (which stays physical-core-based — ALC-04).
        capacityVcpu: coresOf(usablePhysicalCores * cpuRatio),
        capacityRamMib: mib(physicalRamMib * ramRatio),
        mhzPerVcpu: computeMhzPerVcpu(consumedGhz, vcpuAllocated),
        stretched: isStretched,
        drReservedGhz: ghzOf(drReservedGhz),
        siteData: res.siteData,
        reservedFraction: res.fGhz,
        siteACapacityGhz: res.siteACapacityGhz === null ? null : ghzOf(res.siteACapacityGhz),
        siteBCapacityGhz: res.siteBCapacityGhz === null ? null : ghzOf(res.siteBCapacityGhz),
        siteACapacityRamMib: res.siteACapacityRamMib === null ? null : mib(res.siteACapacityRamMib),
        siteBCapacityRamMib: res.siteBCapacityRamMib === null ? null : mib(res.siteBCapacityRamMib),
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
