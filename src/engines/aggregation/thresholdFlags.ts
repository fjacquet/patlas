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

export interface ThresholdFlags {
  /** Per `vpartition[i]` — at/over the filesystem line. */
  fsFlagged: boolean[]
  /** Per `datastores[i]` — over the datastore line. */
  dsFlagged: boolean[]
  /** Per `datastores[i]` — over the logical-unit line. */
  luFlagged: boolean[]
  counts: { fs: number; ds: number; lu: number }
}

export const computeThresholdFlags = (
  vpartition: VPartitionRow[],
  datastores: DatastoreAggregate[],
  thresholds: ThresholdInput,
): ThresholdFlags => {
  const fsLine = thresholds.fsUsedPct / 100

  const fsFlagged = vpartition.map((p) => {
    const cap = p.capacityMib as number
    if (cap === 0) return false // not derivable — never divide by zero
    return (p.consumedMib as number) / cap >= fsLine
  })

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
