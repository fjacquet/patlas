/**
 * Phase 10 — final single self-contained `.html` assembly.
 *
 * This is the ONE file where string assembly is the chosen approach
 * (RESEARCH No-Analog): it wraps the `renderReport` static markup in a
 * `<!doctype html>` shell with the inlined CSP meta + `<style>`, and splices
 * the TRUSTED ECharts-SSR chart SVGs into the `data-chart-slot` placeholders
 * `renderReport` emitted. The chart SVG is a trusted generator's output
 * (never a user-assembled string — T-10-09), so string-splicing it here is
 * the sanctioned raw-markup boundary; `renderReport` itself stays free of
 * any raw-HTML React prop.
 *
 * The result is offline-safe (HTM-02): no `<script>`, no `<link>`, no
 * network reference of any kind — opens with JS disabled.
 */
import type { EstateView, TrendSeries } from '@/types/estate'
import type { ExportStrings } from '../types'
import { inlineAssets } from './inlineAssets'
import { renderReport } from './renderReport'

type Locale = 'en' | 'fr'

/** slotId → trusted ECharts-SSR SVG string (from `chartToSvg`). */
export type ChartMap = ReadonlyMap<string, string>

const SLOT_RE = /<div data-chart-slot="([^"]+)" class="chart-slot"><\/div>/g

export interface AssembleInput {
  view: EstateView
  trends: TrendSeries | null
  charts: ChartMap
  strings: ExportStrings
  locale: Locale
}

/**
 * Produce the single self-contained HTML document string. Blob creation
 * stays in plan 05's main-thread hook — this is a pure string function.
 */
export function assembleHtml(input: AssembleInput): string {
  const { view, trends, charts, strings, locale } = input
  const body = renderReport({ view, trends, strings, locale }).replace(
    SLOT_RE,
    (_match, id: string) => {
      const svg = charts.get(id)
      // Trusted ECharts-SSR SVG only; unknown slot ⇒ leave an empty,
      // valid container (chart-less cluster — never inject anything else).
      return svg ? `<div class="chart-slot">${svg}</div>` : '<div class="chart-slot"></div>'
    },
  )
  const { style, cspMeta } = inlineAssets()
  return (
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">` +
    `${cspMeta}${style}</head><body>${body}</body></html>`
  )
}
