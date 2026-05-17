import type { VDatastoreRow } from '@/types/snapshot'
import type { VInfoRow } from '@/types/vinfo'

/**
 * P9 D-09 / D-10 — the vSAN / blank-`Cluster name` datastore relink.
 *
 * `vDatastore.Hosts` is a host COUNT, not a name list (binding project
 * memory), so the ONLY valid cluster identity for a blank-`Cluster name`
 * (vSAN / host-local) datastore is the `vInfo.Path` token: a VM whose
 * `Path` is `[DS_X] vm/vm.vmx` proves `DS_X` belongs to that VM's cluster.
 * This closes the open STR-04 / Pitfall-6 vSAN under-count (the P5-deferred
 * relink — empirically resolves ~25/67 blank-cluster datastores on the real
 * 75-blank file; the mandatory real-file gate is plan 09-05).
 *
 * Minimal-inference, factual:
 *   - exactly 1 referencing cluster -> attribute the datastore to it
 *   - 0 referencing VMs            -> unrelinkable: stays estate-only, the
 *                                    caller renders an em-dash sentinel —
 *                                    NEVER a fabricated cluster identity
 *   - >1 referencing clusters      -> shared LUN (empirically 1/67): surface
 *                                    as "shared across N clusters",
 *                                    EXCLUDED from single-cluster rollups —
 *                                    no proportional split, no double-count
 *
 * Pure: no React/Zustand/Zod/DOM (engines purity invariant).
 */

/** Anchored, negated-char-class, linear regex (no catastrophic backtracking
 *  — STRIDE T-09-04). Matched with `String.prototype.match` (non-global ⇒
 *  same `[full, group1]` shape) to avoid the security-hook token gotcha. */
const BRACKET = /^\[([^\]]+)\]/

/** The shipped Moderate-11 dedupe key (`perDatastore.ts` line 21, verbatim).
 *  One blank datastore has an empty NAA so the `name` fallback is
 *  load-bearing — keep this identical to perDatastore. */
const dedupeKey = (row: VDatastoreRow): string => row.naa ?? row.name

export interface VsanRelinkResult {
  /** dedupeKey → the single resolved cluster for a blank-cluster datastore. */
  attributed: Map<string, string>
  /** dedupeKey → cluster count (>1) for a shared LUN; excluded from any
   *  single-cluster rollup, still counted once at estate scope. */
  shared: Map<string, number>
  /** dedupeKeys of blank-cluster datastores no VM references — estate-only,
   *  caller renders an em-dash (no fabricated cluster). */
  unrelinkable: Set<string>
}

/**
 * Attribute blank-`Cluster name` datastores to a cluster via the
 * `vInfo.Path` bracket token. Datastores that already carry a non-empty
 * `clusterName` are left untouched (not in any result map). Pure.
 */
export const relinkBlankClusterDatastores = (
  vinfo: VInfoRow[],
  vdatastore: VDatastoreRow[],
): VsanRelinkResult => {
  // datastore NAME (the bracket token) → set of clusters that reference it
  const dsToClusters = new Map<string, Set<string>>()
  for (const vm of vinfo) {
    const m = (vm.path ?? '').match(BRACKET)
    if (!m?.[1]) continue // unparseable Path ⇒ skip, factual (no error)
    const ds = m[1].trim()
    const cl = vm.cluster.trim()
    if (ds === '' || cl === '') continue
    const set = dsToClusters.get(ds) ?? new Set<string>()
    set.add(cl)
    dsToClusters.set(ds, set)
  }

  const attributed = new Map<string, string>()
  const shared = new Map<string, number>()
  const unrelinkable = new Set<string>()
  const seen = new Set<string>()

  for (const row of vdatastore) {
    if (row.clusterName.trim() !== '') continue // already attributed by RVTools
    const key = dedupeKey(row)
    if (seen.has(key)) continue // dedupe blank-cluster datastores once
    seen.add(key)
    const clusters = dsToClusters.get(row.name.trim())
    const size = clusters?.size ?? 0
    if (size === 0) {
      unrelinkable.add(key)
    } else if (size === 1) {
      const only = [...(clusters as Set<string>)][0] as string
      attributed.set(key, only)
    } else {
      shared.set(key, size)
    }
  }

  return { attributed, shared, unrelinkable }
}
