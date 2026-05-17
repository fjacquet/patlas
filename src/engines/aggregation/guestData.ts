import type { MiB } from '@/engines/units'
import { mib } from '@/engines/units'
import type { VInfoRow, VPartitionRow } from '@/types'

/** In-guest disk totals (P5). Calculated only from real vPartition rows. */
export interface GuestData {
  capacityMib: MiB
  consumedMib: MiB
}

export interface GuestDataResult {
  /** `null` when no vPartition sheet was present — factual "not available",
   *  NEVER an invented 0 (calc-from-real-data principle). */
  estate: GuestData | null
  byCluster: Map<string, GuestData>
}

/**
 * Aggregate guest-disk partitions to estate + per-cluster totals. A
 * partition row is attributed to its VM's cluster via `vmName`
 * (first-seen wins; partitions of an unmatched VM are dropped from the
 * per-cluster split but still counted estate-wide). Pure: no React /
 * Zustand / Zod; inputs never mutated.
 */
export const aggregateGuestData = (
  vpartition: VPartitionRow[],
  vinfo: VInfoRow[],
): GuestDataResult => {
  if (vpartition.length === 0) return { estate: null, byCluster: new Map() }

  const vmCluster = new Map<string, string>()
  for (const v of vinfo) if (!vmCluster.has(v.vmName)) vmCluster.set(v.vmName, v.cluster)

  let capTotal = 0
  let usedTotal = 0
  const byCluster = new Map<string, GuestData>()
  for (const p of vpartition) {
    const cap = p.capacityMib as number
    const used = p.consumedMib as number
    capTotal += cap
    usedTotal += used
    const cluster = vmCluster.get(p.vmName)
    if (cluster === undefined) continue
    const acc = byCluster.get(cluster)
    if (acc) {
      byCluster.set(cluster, {
        capacityMib: mib((acc.capacityMib as number) + cap),
        consumedMib: mib((acc.consumedMib as number) + used),
      })
    } else {
      byCluster.set(cluster, { capacityMib: mib(cap), consumedMib: mib(used) })
    }
  }
  return { estate: { capacityMib: mib(capTotal), consumedMib: mib(usedTotal) }, byCluster }
}
