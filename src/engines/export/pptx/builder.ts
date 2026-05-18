/**
 * Phase 10 — PPTX deck composition root. Shaped like the pure
 * `estateView.ts` assembler (typed params, single pass, no React/Zustand/
 * Zod). Emits slides in the FIXED PPT-03 order:
 *
 *   title → overview → one clusterSlide PER cluster (D-01, ALWAYS, no cap)
 *   → contention annex (only if readiness rows present, conditional)
 *   → eos → drSim → trends (only if trends non-null — D-09) → inventory
 *
 * Returns a valid OOXML `ArrayBuffer` (`pptx.write({outputType:'arraybuffer'})`
 * — proven worker-safe in 10-SPIKE-DECISION.md; the function stays pure,
 * plan 05 wires it into the export worker).
 *
 * `opts.renderClusterChart` (async) is injected by plan 05's worker — it
 * does the ECharts-SSR → resvg-wasm raster. Omitted here ⇒ chart-less
 * cluster slides (still valid; D-01 slide count is unaffected). This keeps
 * the builder pure and the golden structural test wasm-free.
 */
import PptxGenJS from 'pptxgenjs'
import type { ClusterAggregate, EstateView, TrendSeries } from '@/types/estate'
import type { ExportStrings } from '../types'
import type { ExportLocale } from './format'
import { addClusterSlide } from './slides/clusterSlide'
import { addContentionAnnex, type ContentionRow } from './slides/contentionAnnex'
import { addDrSimSlide } from './slides/drSimSlide'
import { addEosSlide } from './slides/eosSlide'
import { addInventorySlide } from './slides/inventorySlide'
import { addOverviewSlide } from './slides/overviewSlide'
import { addTitleSlide } from './slides/titleSlide'
import { addTrendsSlide } from './slides/trendsSlide'

export interface BuildPptxOpts {
  /** Plan-05 worker injects the async ECharts→resvg raster per cluster. */
  renderClusterChart?: (cluster: ClusterAggregate) => Promise<Uint8Array | undefined>
  /** CPU-Ready rows; when present & non-empty the conditional annex emits. */
  contentionRows?: ReadonlyArray<ContentionRow>
  /** The active snapshot's capture date (ISO `YYYY-MM-DD`), injected by
   *  plan-05's worker from `req.active.capturedAt`. Used verbatim on the
   *  D-03 title slide — NOT the vCenter label (CodeRabbit — builder.ts:59). */
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
    { globals: view.globals, insights: view.operationalInsights },
    strings,
    locale,
  )

  // D-01: exactly one slide per cluster, ALWAYS — no top-N cap.
  for (const cluster of view.clusters) {
    const chartPng = opts.renderClusterChart ? await opts.renderClusterChart(cluster) : undefined
    addClusterSlide(pptx, { cluster, chartPng }, strings, locale)
  }

  // Conditional CPU-Ready annex.
  if (opts.contentionRows && opts.contentionRows.length > 0) {
    addContentionAnnex(pptx, opts.contentionRows, strings, locale)
  }

  addEosSlide(pptx, view.eos, strings, locale)
  addDrSimSlide(pptx, view.drSim, strings, locale)

  // D-09: trends slide only when trends is non-null (<2 snapshots ⇒ omit).
  if (trends !== null) addTrendsSlide(pptx, trends, strings, locale)

  addInventorySlide(pptx, view, strings, locale)

  return pptx.write({ outputType: 'arraybuffer' }) as Promise<ArrayBuffer>
}
