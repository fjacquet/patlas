import { useMemo } from 'react'
import { buildEstateView, EMPTY_VIEW } from '@/engines/aggregation'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import {
  selectMonsterThresholds,
  selectPlannedRatios,
  selectScenario,
  selectSelectedSnapshotIds,
  selectSizingThresholds,
  selectSnapshots,
  selectStretchedClusters,
  selectThresholds,
  useSnapshotStore,
} from '@/store/snapshotStore'
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
 * The store reads return referentially-stable inputs (`snapshots` Map,
 * `selectedSnapshotIds` and `stretchedClusters` Sets are REPLACED never
 * mutated), so the memo recomputes only when a selection identity, the
 * stretched set, or `mode` actually changes.
 * The `Snapshot[]` is derived INSIDE this memo — never in a selector (a
 * fresh array there loops Zustand's `Object.is`) and never in a SECOND
 * `useMemo` (grep-gated single-memo invariant).
 *
 * This hook ONLY orchestrates + memoizes — it contains no aggregation or
 * merge logic (those live in the pure engines). Dashboard components consume
 * its output as plain props and must NOT introduce their own `useMemo`.
 *
 * D-06 / WR-01: the retired URL-hash ratio path (`useAllocationHash`) is
 * gone — no ratio input is persisted to the URL. The measured lens uses the
 * engine's default allocation ratio (`buildEstateView` defaults
 * `allocRatios` to 4:1 / 1:1); the only user-tunable ratios are the planned
 * lens's in-memory Zustand `plannedRatios` slice (D-05/D-06).
 */
export function useEstateView(mode: AccountingMode): EstateView {
  const snapshots = useSnapshotStore(selectSnapshots)
  const selectedIds = useSnapshotStore(selectSelectedSnapshotIds)
  const stretchedClusters = useSnapshotStore(selectStretchedClusters)
  const scenario = useSnapshotStore(selectScenario)
  const planned = useSnapshotStore(selectPlannedRatios)
  const thresholds = useSnapshotStore(selectThresholds)
  const sizingThresholds = useSnapshotStore(selectSizingThresholds)
  const monsterThresholds = useSnapshotStore(selectMonsterThresholds)
  return useMemo(() => {
    const selected = [...snapshots.values()].filter((s) => selectedIds.has(s.id))
    if (selected.length === 0) return EMPTY_VIEW
    // The single sanctioned clock-injection site (D-07): the engine is pure;
    // the wall clock is sampled here at recompute time and threaded in. Not a
    // memo dep — `today` is read when inputs change, not on time passing.
    const today = new Date()
    return buildEstateView(mergeSnapshotsToEstate(selected), selected, mode, today, {
      stretchedClusters,
      scenario,
      plannedRatios: { cpuRatio: planned.cpu, ramRatio: planned.ram },
      thresholds,
      sizingThresholds,
      monsterThresholds,
    })
  }, [
    snapshots,
    selectedIds,
    stretchedClusters,
    scenario,
    mode,
    planned.cpu,
    planned.ram,
    thresholds,
    sizingThresholds,
    monsterThresholds,
  ])
}
