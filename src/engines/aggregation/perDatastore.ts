import { mib } from '@/engines/units'
import type { DatastoreAggregate } from '@/types/estate'
import type { StorageRow } from '@/types/snapshot'

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
const dedupeKey = (row: StorageRow): string => row.naa ?? row.name

/**
 * Split a RVTools `Hosts` cell into individual host names. RVTools emits
 * the mounted-host list newline- or comma-separated depending on export
 * path; split on either, trim, drop blanks.
 */
const splitHosts = (hosts: string): string[] =>
  hosts
    .split(/[\n,;]+/)
    .map((h) => h.trim())
    .filter((h) => h.length > 0)

/**
 * Per-cluster datastore count, NAA-deduped WITHIN each cluster
 * (Moderate-11 preserved): a shared LUN visible from two clusters counts
 * ONCE in each of those clusters' totals.
 *
 * Pitfall 6 (Plan 04-02): a datastore with a blank `Cluster name`
 * (vSAN / host-local — ~44 % of real rows) is NO LONGER dropped. When a
 * `hostClusterMap` (`vHost.hostName → vHost.cluster`) is supplied, the
 * datastore is attributed to the cluster(s) of the hosts in its `Hosts`
 * list (a pure join — a shared LUN counts once per owning cluster). A
 * blank-clusterName row whose hosts match NO known cluster (or when no
 * map is supplied) is still not fabricated onto any cluster — it remains
 * only in the estate-wide global count.
 *
 * Returns a `Map<cluster, distinctDatastoreCount>`. Same Map-accumulate
 * shape as `perDatastore`/`perCluster.groupByCluster` (no new mechanism).
 */
export const datastoreCountByCluster = (
  vdatastore: StorageRow[],
  hostClusterMap?: ReadonlyMap<string, string>,
): Map<string, number> => {
  const keysByCluster = new Map<string, Set<string>>()
  const attribute = (cluster: string, key: string): void => {
    const set = keysByCluster.get(cluster) ?? new Set<string>()
    set.add(key)
    keysByCluster.set(cluster, set)
  }
  for (const row of vdatastore) {
    const key = dedupeKey(row)
    if (row.clusterName !== '') {
      attribute(row.clusterName, key)
      continue
    }
    // Blank Cluster name → Hosts→cluster join (Pitfall 6).
    if (hostClusterMap === undefined || row.hosts === '') continue
    const owning = new Set<string>()
    for (const hostName of splitHosts(row.hosts)) {
      const cluster = hostClusterMap.get(hostName)
      if (cluster !== undefined && cluster !== '') owning.add(cluster)
    }
    for (const cluster of owning) attribute(cluster, key)
  }
  const out = new Map<string, number>()
  for (const [cluster, keys] of keysByCluster) out.set(cluster, keys.size)
  return out
}

export const perDatastore = (vdatastore: StorageRow[]): DatastoreAggregate[] => {
  const groups = new Map<string, StorageRow[]>()
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
