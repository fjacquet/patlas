/**
 * buildHtmlCharts — pure function that constructs the slot→SVG map for the
 * HTML report export. Extracted from the worker's HTML branch so the seam
 * between "chart-map construction" and "slot injection" is unit-testable
 * (the worker's `onmessage` handler is a Web Worker and cannot be imported
 * by jsdom-based tests).
 *
 * No React / Zustand / i18n — takes the TopologyLabels struct as a param,
 * same discipline as topologyTreeOption itself.
 */
import type { EstateView } from '@/types/estate'
import type { ChartOptionBundle } from '../chartBundle'
import type { TopologyLabels } from '../charts/topologyOption'
import { topologyTreeOption } from '../charts/topologyOption'
import { chartToSvg } from './renderCharts'
import { exportChartSlots } from './renderReport'

/**
 * Build the `charts` Map<slotId, svgString> used by `assembleHtml`.
 *
 * @param view        - the EstateView for this export
 * @param optBundle   - pre-built ECharts option bundle (from buildChartBundle)
 * @param topoLabels  - resolved topology label strings (caller's responsibility)
 * @param width       - render width in px (CHART_W in the worker)
 * @param height      - render height in px for fixed-size charts (CHART_H);
 *                      topology uses its own dynamic height from topologyTreeOption
 */
export function buildHtmlCharts(
  view: EstateView,
  optBundle: ChartOptionBundle,
  topoLabels: TopologyLabels,
  width: number,
  height: number,
): Map<string, string> {
  const charts = new Map<string, string>()

  // Per-cluster gauge slots — ids match data-chart-slot values emitted by
  // renderReport.tsx (single source of truth via exportChartSlots).
  for (const slot of exportChartSlots(view)) {
    const opt = optBundle.perCluster.get(slot.cluster)
    if (opt) charts.set(slot.id, chartToSvg(opt, width, height))
  }

  // Estate-level storage treemap (fixed slot id — matches
  // data-chart-slot="storage-treemap" in renderReport.tsx).
  const treemap = optBundle.shared.storageTreemap
  if (treemap) charts.set('storage-treemap', chartToSvg(treemap, width, height))

  // Topology tree — dynamic height from the option builder; slot id matches
  // data-chart-slot="topology-tree" in renderReport.tsx.
  // Fix for C1: this slot was missing from the HTML branch of the worker,
  // leaving an empty container in every real HTML export.
  if (view.topology.hasData) {
    const { option, height: topoHeight } = topologyTreeOption(view.topology, topoLabels)
    charts.set('topology-tree', chartToSvg(option, width, topoHeight))
  }

  return charts
}
