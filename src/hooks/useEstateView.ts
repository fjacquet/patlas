import { useMemo } from 'react'
import { buildEstateView, EMPTY_VIEW } from '@/engines/aggregation'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { selectSelectedSnapshotIds, selectSnapshots, useSnapshotStore } from '@/store/snapshotStore'
import type { AccountingMode, EstateView } from '@/types/estate'

/**
 * The project's SINGLE sanctioned `useMemo` site for estate aggregation
 * (PROJECT.md binding; reaffirmed 01-05-SUMMARY). Phase-4 contract change:
 * it now reads the SELECTED snapshots off the inputs-only store, merges
 * them into one logical estate (`mergeSnapshotsToEstate` — the primary
 * multi-FILE path; a single snapshot is the degenerate case), then derives
 * the `EstateView` via the pure `buildEstateView` assembler — ALL inside
 * the ONE `useMemo`. Returns the frozen `EMPTY_VIEW` when nothing is
 * selected.
 *
 * The two store reads return referentially-stable inputs (`snapshots` Map
 * and `selectedSnapshotIds` Set are REPLACED never mutated), so the memo
 * recomputes only when the selection identity or `mode` actually changes.
 * The `Snapshot[]` is derived INSIDE this memo — never in a selector (a
 * fresh array there loops Zustand's `Object.is`) and never in a SECOND
 * `useMemo` (grep-gated single-memo invariant).
 *
 * This hook ONLY orchestrates + memoizes — it contains no aggregation or
 * merge logic (those live in the pure engines). Dashboard components consume
 * its output as plain props and must NOT introduce their own `useMemo`.
 */
export function useEstateView(mode: AccountingMode): EstateView {
  const snapshots = useSnapshotStore(selectSnapshots)
  const selectedIds = useSnapshotStore(selectSelectedSnapshotIds)
  return useMemo(() => {
    const selected = [...snapshots.values()].filter((s) => selectedIds.has(s.id))
    if (selected.length === 0) return EMPTY_VIEW
    return buildEstateView(mergeSnapshotsToEstate(selected), mode)
  }, [snapshots, selectedIds, mode])
}
