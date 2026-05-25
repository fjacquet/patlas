/**
 * Phase 10 D-08/D-09 export entrypoint — PURE. No React, no Zustand, no hook.
 *
 * Clones the dashboard estate-view hook's orchestration (src/hooks/, the
 * single sanctioned aggregation memo, lines ~50-62) so the export Web Worker
 * computes the same `EstateView` the dashboard shows, WITHOUT that hook (a
 * worker has no React). D-08: the report BODY is the
 * **active** snapshot's estate (deliberately NOT the merged multi-vCenter
 * view). D-09: the trend series spans ALL loaded snapshots, and is `null`
 * when fewer than two are loaded (the trends section/slide is omitted
 * downstream — there is nothing to trend with one snapshot).
 *
 * A2 (must_have): for a single snapshot, `buildExportView(...).view`
 * deep-equals the direct single-snapshot `buildEstateView` call — i.e. the
 * exported body is identical to that snapshot's dashboard view.
 */
import { buildEstateView, type EstateSizing } from '@/engines/aggregation'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import type { AccountingMode, EstateView, TrendSeries } from '@/types/estate'
import type { Snapshot } from '@/types/snapshot'
import type { ExportOpts } from './types'

export interface ExportView {
  /** D-08: the ACTIVE snapshot's estate (not the merged P4 view). */
  view: EstateView
  /** D-08/D-09: cross-snapshot trends; `null` when <2 snapshots loaded. */
  trends: TrendSeries | null
  /** P-RS right-sizing computed over ALL loaded snapshots (max-of-N), so the
   *  deck reflects the full set rather than only the active body. */
  sizing: EstateSizing
}

export function buildExportView(
  active: Snapshot,
  all: Snapshot[],
  mode: AccountingMode,
  today: Date,
  opts?: ExportOpts,
): ExportView {
  // D-08 body — the active snapshot only, through the production merge path
  // (single snapshot = degenerate merge case, exactly like the dashboard).
  const view = buildEstateView(mergeSnapshotsToEstate([active]), [active], mode, today, opts)

  // The all-snapshots view feeds BOTH the D-09 trend series AND the P-RS
  // right-sizing extract (max-of-N). Computed once; reused. With <2 snapshots
  // it is the active view, so sizing degenerates to the single reading.
  const allView =
    all.length >= 2 ? buildEstateView(mergeSnapshotsToEstate(all), all, mode, today, opts) : view

  // D-09 — trends need ≥2 snapshots; otherwise omit entirely.
  const trends = all.length >= 2 ? allView.trends : null

  return { view, trends, sizing: allView.sizing }
}
