import { cores as coresOf, ghz as ghzOf, mib } from '@/engines/units'
import type { ClusterHostStats } from '@/types/estate'
import type { NodeRow } from '@/types/node'
import { consumedGhz as consumedGhzOf, physicalGhz as physicalGhzOf } from './ghz'

/**
 * Host-side rollup for one cluster — ported from vsizer `perCluster.ts`
 * with the mechanical brand retrofit. Deviations vs the port:
 * - `h.memoryMb` → `h.memoryMib` (Phase-1 `NodeRow` rename).
 * - `physicalGhzOf`/`consumedGhzOf` return `GHz` — unwrapped with
 *   `as number` inside `sum(...)` and re-branded on the way out.
 * - `Math.max/min` on the small per-cluster `cpuRatio`/`ramRatio` arrays
 *   are kept (V8 spread-limit concern is VM-scale only).
 * - `ClusterHostStats` lives in `@/types/estate` (branded).
 *
 * Hosts whose `cluster` field is empty are dropped before grouping —
 * orphan inventory the dashboard can't attribute. Output is NOT sorted
 * (`aggregateClusters` does the final stable sort).
 */

const groupByCluster = (rows: NodeRow[]): Map<string, NodeRow[]> => {
  const out = new Map<string, NodeRow[]>()
  for (const row of rows) {
    if (row.cluster.length === 0) continue
    const list = out.get(row.cluster) ?? []
    list.push(row)
    out.set(row.cluster, list)
  }
  return out
}

const sum = (xs: readonly number[]): number => xs.reduce((acc, n) => acc + n, 0)
const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : sum(xs) / xs.length)

/**
 * Group hosts by cluster and compute per-cluster CPU/RAM statistics plus
 * physical/consumed GHz and the host-side physical RAM sum. No DR logic
 * here — stretched-cluster reservations are applied one layer up.
 */
export const aggregateHostsPerCluster = (vhost: NodeRow[]): ClusterHostStats[] => {
  const grouped = groupByCluster(vhost)
  const out: ClusterHostStats[] = []
  for (const [cluster, hosts] of grouped) {
    const cpus = hosts.map((h) => h.cpuRatio)
    const rams = hosts.map((h) => h.ramRatio)
    const physical = sum(hosts.map((h) => physicalGhzOf(h.speedMhz, h.cores) as number))
    const consumed = sum(hosts.map((h) => consumedGhzOf(h.speedMhz, h.cores, h.cpuRatio) as number))
    const physicalRamMib = sum(hosts.map((h) => h.memoryMib as number))
    // Capacity-weighted RAM consumption: each host contributes its own
    // bytes-times-ratio, not the cluster's average ratio applied to its
    // own bytes. Matters on heterogeneous clusters; equivalent on
    // homogeneous ones.
    const consumedRamMib = sum(hosts.map((h) => (h.memoryMib as number) * h.ramRatio))
    const physicalCores = sum(hosts.map((h) => h.cores as number))
    // Capacity-weighted ratios; fallback to mean-of-ratios when the
    // capacity denominator is zero (older RVTools without `# Memory` →
    // physicalRamMib = 0). For CPU physicalGhz is always derivable from
    // cores × speedMhz so the fallback isn't needed.
    const meanCpuRatio = physical === 0 ? 0 : consumed / physical
    const meanRamRatio = physicalRamMib === 0 ? mean(rams) : consumedRamMib / physicalRamMib
    out.push({
      cluster,
      hostCount: hosts.length,
      physicalCores: coresOf(physicalCores),
      physicalGhz: ghzOf(physical),
      consumedGhz: ghzOf(consumed),
      availableGhz: ghzOf(physical - consumed),
      physicalRamMib: mib(physicalRamMib),
      consumedRamMib: mib(consumedRamMib),
      meanCpuRatio,
      maxCpuRatio: Math.max(...cpus),
      minCpuRatio: Math.min(...cpus),
      meanRamRatio,
      maxRamRatio: Math.max(...rams),
      minRamRatio: Math.min(...rams),
    })
  }
  return out
}
