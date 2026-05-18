/** Phase 10 — inventory summary: KPI cards + the OS-family donut (reused
 *  real chart). Factual counts. */
import type PptxGenJS from 'pptxgenjs'
import type { EstateView } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
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
  addChartPanel(
    s,
    chartPng,
    { x: M, y: y2, w: CONTENT_W, h: 7.15 - y2 },
    strings['inventory.os'] ?? 'OS family',
  )
}
