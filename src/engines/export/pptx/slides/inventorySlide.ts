/** Phase 18 — inventory summary: KPI cards + a NAMED OS-family breakdown
 *  line (the donut alone had no legend — "missing text") above the donut.
 *  Factual counts, brand-free. */
import type PptxGenJS from 'pptxgenjs'
import type { EstateView } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addChartPanel, addHeader, addKpiRow, CONTENT_W, M } from './_layout'

export function addInventorySlide(
  pptx: PptxGenJS,
  view: EstateView,
  chartPng: Uint8Array | undefined,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['inventory.title'] ?? 'Inventory summary')
  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['inventory.vms'] ?? 'VM rows',
        value: pptxNumber(view.vmRows.length, locale),
      },
      {
        label: strings['inventory.hosts'] ?? 'Hosts',
        value: pptxNumber(view.hosts.length, locale),
      },
      {
        label: strings['inventory.clusters'] ?? 'Clusters',
        value: pptxNumber(view.clusters.length, locale),
      },
      {
        label: strings['inventory.datastores'] ?? 'Datastores',
        value: pptxNumber(view.datastores.length, locale),
      },
    ],
    y,
  )
  // Named OS-family breakdown line (the donut had no legend on the slide).
  const os = view.osBreakdown
  const total = os.windows + os.linux + os.other
  const share = (k: number) =>
    total > 0 ? ` (${pptxNumber(Math.round((k / total) * 100), locale)} %)` : ''
  const w = strings['os.windows'] ?? 'Windows'
  const l = strings['os.linux'] ?? 'Linux'
  const ot = strings['os.other'] ?? 'Other'
  const osLine = `${w} ${pptxNumber(os.windows, locale)}${share(os.windows)}   ·   ${l} ${pptxNumber(os.linux, locale)}${share(os.linux)}   ·   ${ot} ${pptxNumber(os.other, locale)}${share(os.other)}`
  s.addText(pptxSafeFormat(osLine), {
    x: M,
    y: y2,
    w: CONTENT_W,
    h: 0.32,
    fontFace: 'Calibri',
    fontSize: 12,
    bold: true,
    color: PPTX_COLORS.inkMuted,
    margin: 0,
  })
  addChartPanel(
    s,
    chartPng,
    { x: M, y: y2 + 0.42, w: CONTENT_W, h: 7.15 - (y2 + 0.42) },
    strings['inventory.os'] ?? 'OS family',
  )
}
