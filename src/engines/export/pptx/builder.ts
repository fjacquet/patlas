/**
 * Phase 10 — PPTX deck composition root. Shaped like the pure
 * `estateView.ts` assembler (typed params, single pass, no React/Zustand/
 * Zod). Emits slides in the FIXED PPT-03 order:
 *
 *   title → overview → one clusterSlide PER cluster (D-01, ALWAYS, no cap)
 *   → contention annex (only if readiness rows present, conditional)
 *   → eos → drSim → trends (only if trends non-null — D-09) → inventory
 *
 * Returns a valid OOXML `ArrayBuffer`. Pure: the worker pre-rasterizes the
 * app's real charts into `opts.charts` (a `PngBundle`) and injects them;
 * omitted ⇒ chart panels show a factual "—" (still valid; the golden
 * structural test stays wasm-free).
 */
import PptxGenJS from 'pptxgenjs'
import type { EstateView, TrendSeries } from '@/types/estate'
import type { PngBundle } from '../chartBundle'
import type { ExportStrings } from '../types'
import type { ExportLocale } from './format'
import { addClusterSlide } from './slides/clusterSlide'
import { addContentionAnnex, type ContentionRow } from './slides/contentionAnnex'
import { addDrSimSlide } from './slides/drSimSlide'
import { addEosSlide } from './slides/eosSlide'
import { addInventorySlide } from './slides/inventorySlide'
import { addNetworkSlide } from './slides/networkSlide'
import { addOverviewSlide } from './slides/overviewSlide'
import { addPlannedSlide } from './slides/plannedSlide'
import { addStorageSlide } from './slides/storageSlide'
import { addTitleSlide } from './slides/titleSlide'
import { addTrendsSlide } from './slides/trendsSlide'

export interface BuildPptxOpts {
  /** Worker-rasterized real app charts (osDonut/cpuGauge/ramGauge/eosBar/
   *  drBar/trendLine + per-cluster). Omitted ⇒ "—" chart panels. */
  charts?: PngBundle
  /** CPU-Ready rows; when present & non-empty the conditional annex emits. */
  contentionRows?: ReadonlyArray<ContentionRow>
  /** The active snapshot's capture date (ISO `YYYY-MM-DD`), used verbatim
   *  on the D-03 title slide — NOT the vCenter label. */
  capturedAt?: string
}

export async function buildPptx(
  view: EstateView,
  trends: TrendSeries | null,
  strings: ExportStrings,
  locale: ExportLocale,
  opts: BuildPptxOpts = {},
): Promise<ArrayBuffer> {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 })
  pptx.layout = 'WIDE'
  const shared = opts.charts?.shared
  const png = (k: string): Uint8Array | undefined => shared?.get(k)

  addTitleSlide(
    pptx,
    {
      vcenters: view.vcenters.map((v) => v.label).join(' · '),
      clusterCount: view.globals.clusterCount,
      hostCount: view.globals.hostCount,
      vmCount: view.globals.vmCount,
      capturedAt: opts.capturedAt ?? '',
    },
    strings,
    locale,
  )
  addOverviewSlide(
    pptx,
    {
      globals: view.globals,
      insights: view.operationalInsights,
      osDonut: png('osDonut'),
      cpuGauge: png('cpuGauge'),
      ramGauge: png('ramGauge'),
    },
    strings,
    locale,
  )

  // D-01: exactly one slide per cluster, ALWAYS — no top-N cap.
  for (const cluster of view.clusters) {
    addClusterSlide(
      pptx,
      { cluster, chartPng: opts.charts?.perCluster.get(cluster.cluster) },
      strings,
      locale,
    )
  }

  // F-2 (D-05): Storage + Network after the per-cluster narrative,
  // before the conditional annex. Network has no chart (D-08).
  addStorageSlide(pptx, view, png('storageTreemap'), strings, locale)
  addNetworkSlide(pptx, view, strings, locale)

  // Conditional CPU-Ready annex.
  if (opts.contentionRows && opts.contentionRows.length > 0) {
    addContentionAnnex(pptx, opts.contentionRows, strings, locale)
  }

  addEosSlide(pptx, view.eos, png('eosBar'), strings, locale)
  addDrSimSlide(pptx, view.drSim, png('drBar'), strings, locale)
  // F-1 (deck side): planned-vs-measured with the other re-aggregation.
  addPlannedSlide(pptx, view, strings, locale)

  // D-09: trends slide only when trends is non-null (<2 snapshots ⇒ omit).
  if (trends !== null) addTrendsSlide(pptx, trends, png('trendLine'), strings, locale)

  addInventorySlide(pptx, view, png('osDonut'), strings, locale)

  return pptx.write({ outputType: 'arraybuffer' }) as Promise<ArrayBuffer>
}
