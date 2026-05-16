import { mib } from '@/engines/units'
import type { DatastoreAggregate } from '@/types/estate'
import type { VDatastoreRow } from '@/types/snapshot'

/**
 * NAA-deduped datastore rollup (Moderate-11 / Pitfall 5). Reuses the
 * `groupByCluster` Map-accumulate SHAPE from `perCluster.ts`, keyed on
 * `naa ?? name`.
 *
 * Critical rule: a shared LUN is identical in every cluster's view, so
 * capacity/free/provisioned are taken from the FIRST row in a key-group
 * and NEVER summed — summing would double-count a shared LUN across
 * clusters. `sharedDuplicateCount` surfaces the group size (>1 ⇒ shared).
 *
 * The Moderate-11 `provisioned ≤ capacity × 10` sanity check is a
 * TODO(diagnostics, Phase 3+) only — no panel is built here (YAGNI).
 */
/** The Moderate-11 dedupe key for a datastore row (`naa ?? name`). One
 *  shared LUN collapses to one key; reused estate-wide AND within a cluster
 *  so per-cluster and global counts use the SAME identity rule. */
const dedupeKey = (row: VDatastoreRow): string => row.naa ?? row.name

/**
 * Per-cluster datastore count, NAA-deduped WITHIN each cluster
 * (Moderate-11 preserved): a shared LUN visible from two clusters counts
 * ONCE in each of those clusters' totals. A datastore whose `clusterName`
 * is empty is host-local / unattributed — it is NOT fabricated onto any
 * cluster (it still lives in the estate-wide global count).
 *
 * Returns a `Map<cluster, distinctDatastoreCount>`. Same Map-accumulate
 * shape as `perDatastore`/`perCluster.groupByCluster` (no new mechanism).
 */
export const datastoreCountByCluster = (vdatastore: VDatastoreRow[]): Map<string, number> => {
  const keysByCluster = new Map<string, Set<string>>()
  for (const row of vdatastore) {
    if (row.clusterName === '') continue
    const set = keysByCluster.get(row.clusterName) ?? new Set<string>()
    set.add(dedupeKey(row))
    keysByCluster.set(row.clusterName, set)
  }
  const out = new Map<string, number>()
  for (const [cluster, keys] of keysByCluster) out.set(cluster, keys.size)
  return out
}

export const perDatastore = (vdatastore: VDatastoreRow[]): DatastoreAggregate[] => {
  const groups = new Map<string, VDatastoreRow[]>()
  for (const row of vdatastore) {
    const key = dedupeKey(row)
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  const out: DatastoreAggregate[] = []
  for (const [key, rows] of groups) {
    const head = rows[0]
    if (head === undefined) continue
    const capacity = head.capacityMib as number
    const free = head.freeMib as number
    const provisioned = head.provisionedMib as number
    const used = capacity - free
    out.push({
      key,
      name: head.name,
      type: head.type,
      capacityMib: head.capacityMib,
      freeMib: head.freeMib,
      usedMib: mib(used),
      usedRatio: capacity === 0 ? 0 : used / capacity,
      provisionedMib: head.provisionedMib,
      overProvisionRatio: capacity === 0 ? 0 : provisioned / capacity,
      sharedDuplicateCount: rows.length,
    })
  }
  return out
}
