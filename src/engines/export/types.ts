/**
 * Phase 10 export-engine shared types. Pure data only — no React, no Zustand,
 * no DOM. Mirrors `parseInWorker.ts`'s ParseRequest/ParseResponse discipline:
 * a discriminated-union response whose error branch is a HAND-BUILT explicit
 * field list — never a spread `err`, never `cause`, never parsed rows
 * (T-10-06 / T-04-04 privacy: no workbook bytes leak via an error).
 */
import type { buildEstateView } from '@/engines/aggregation'
import type { AccountingMode } from '@/types/estate'
import type { Snapshot } from '@/types/snapshot'

export type ExportKind = 'html' | 'pptx'

/** The opts slices threaded into `buildEstateView` — reuse the engine's own
 *  optional-param type so this never drifts from the aggregation contract. */
export type ExportOpts = NonNullable<Parameters<typeof buildEstateView>[4]>

/** A resolved, locale-formatted i18n string bag. Numbers are interpolated by
 *  the caller via `@/utils/format` (Moderate-2) — never pre-formatted here. */
export type ExportStrings = Record<string, string>

export interface ExportRequest {
  kind: ExportKind
  /** D-08: the report BODY is this snapshot's estate (not the merged view). */
  active: Snapshot
  /** D-08/D-09: ALL loaded snapshots — the cross-snapshot trend source. */
  all: Snapshot[]
  mode: AccountingMode
  /** Epoch ms (worker-serializable; the single sanctioned clock-injection
   *  point, sampled on the main thread before postMessage). */
  today: number
  opts?: ExportOpts
  strings: ExportStrings
  locale: 'en' | 'fr'
  /** D-05: vatlas_{vCenter}_{captureDate}.{ext} — composed on the main thread. */
  filename: string
}

export type ExportResponse =
  | { kind: 'ok'; bytes: ArrayBuffer; filename: string }
  | { kind: 'err'; error: { name: string; message: string } }
