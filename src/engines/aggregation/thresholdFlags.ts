import type { DatastoreAggregate } from '@/types/estate'
import type { VPartitionRow } from '@/types/snapshot'

/**
 * P9 D-04 — purely factual threshold projection.
 *
 * Emits a per-row boolean (is the row at/over the user's configured used-%
 * line) plus a count per category. It states a measured fact only: it does
 * NOT rank, score, colour, label, or pass judgement on any row. The line
 * values come from the in-memory thresholds slice (D-02), user-editable.
 *
 *  - filesystem: a `vPartition` row whose `consumedMib / capacityMib`
 *    is at or above `fsUsedPct / 100` (the `≥` boundary). `capacityMib === 0`
 *    is guarded — yields `false` (not derivable), never `Infinity`/`NaN`.
 *  - datastore: a deduped `DatastoreAggregate` whose `usedRatio * 100`
 *    is above `dsUsedPct` (the `>` boundary).
 *  - logical unit: the same NAA-keyed `DatastoreAggregate` set measured
 *    against `luUsedPct` — a second, independently-configurable line
 *    (D-03 A3 semantic), NOT a different data source.
 *
 * Pure: no React/Zustand/Zod/DOM; inputs never mutated.
 */

/** The three user-editable used-% lines (structurally the store's
 *  ThresholdConfig — kept local so the engine never imports the store). */
export interface ThresholdInput {
  fsUsedPct: number
  dsUsedPct: number
  luUsedPct: number
}

/** RVTools-Analyser-class defaults (D-03): filesystem ≥90% used, datastore
 *  >85% used, LU >85% used. The single source of truth — the store
 *  re-exports this; `buildEstateView` uses it as the `opts.thresholds`
 *  fallback. Pure-engine home so neither the store nor the engine owns a
 *  duplicate literal. */
export const DEFAULT_THRESHOLDS: ThresholdInput = {
  fsUsedPct: 90,
  dsUsedPct: 85,
  luUsedPct: 85,
}

export interface ThresholdFlags {
  /** Per `vpartition[i]` — at/over the filesystem line. */
  fsFlagged: boolean[]
  /** Per `datastores[i]` — over the datastore line. */
  dsFlagged: boolean[]
  /** Per `datastores[i]` — over the logical-unit line. */
  luFlagged: boolean[]
  counts: { fs: number; ds: number; lu: number }
}

/**
 * Shared filesystem over-line predicate (DRY — used by
 * `computeThresholdFlags` AND the per-VM partition flag in `detailIndex`).
 * `capacityMib === 0` ⇒ `false` (not derivable; never divide by zero).
 */
export const fsOver = (consumedMib: number, capacityMib: number, fsUsedPct: number): boolean =>
  capacityMib !== 0 && consumedMib / capacityMib >= fsUsedPct / 100

export const computeThresholdFlags = (
  vpartition: VPartitionRow[],
  datastores: DatastoreAggregate[],
  thresholds: ThresholdInput,
): ThresholdFlags => {
  const fsFlagged = vpartition.map((p) =>
    fsOver(p.consumedMib as number, p.capacityMib as number, thresholds.fsUsedPct),
  )

  const dsFlagged = datastores.map((d) => d.usedRatio * 100 > thresholds.dsUsedPct)
  const luFlagged = datastores.map((d) => d.usedRatio * 100 > thresholds.luUsedPct)

  const count = (xs: boolean[]): number => xs.reduce((a, x) => a + (x ? 1 : 0), 0)

  return {
    fsFlagged,
    dsFlagged,
    luFlagged,
    counts: { fs: count(fsFlagged), ds: count(dsFlagged), lu: count(luFlagged) },
  }
}
