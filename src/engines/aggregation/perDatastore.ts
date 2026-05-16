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
export const perDatastore = (vdatastore: VDatastoreRow[]): DatastoreAggregate[] => {
  const groups = new Map<string, VDatastoreRow[]>()
  for (const row of vdatastore) {
    const key = row.naa ?? row.name
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
