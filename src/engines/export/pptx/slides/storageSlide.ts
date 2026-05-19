/** Phase 11 (F-2) — Storage: KPI strip (provisioned/in-use/capacity +
 *  factual flagged-datastore count) + the app's storage treemap (real
 *  chart, rasterized). Gold rule from addHeader is the only marker. */
import type PptxGenJS from 'pptxgenjs'
import type { EstateView } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addChartPanel, addHeader, addKpiRow, CONTENT_W, M } from './_layout'

export function addStorageSlide(
  pptx: PptxGenJS,
  view: EstateView,
  chartPng: Uint8Array | undefined,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const e = view.storage.estate
  const y = addHeader(s, strings['storage.title'] ?? 'Storage')
  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['storage.provisioned'] ?? 'Provisioned (GiB)',
        value: pptxNumber(Math.round(Number(e.provisionedMib) / 1024), locale),
      },
      {
        label: strings['storage.inUse'] ?? 'In use (GiB)',
        value: pptxNumber(Math.round(Number(e.inUseMib) / 1024), locale),
      },
      {
        label: strings['storage.capacity'] ?? 'Capacity (GiB)',
        value: pptxNumber(Math.round(Number(e.capacityMib) / 1024), locale),
      },
      {
        label: strings['storage.flagged'] ?? 'Flagged datastores',
        value: pptxNumber(view.flags.counts.ds + view.flags.counts.lu, locale),
      },
    ],
    y,
  )
  addChartPanel(
    s,
    chartPng,
    { x: M, y: y2, w: CONTENT_W, h: 7.15 - y2 },
    strings['storage.byCluster'] ?? 'Storage by cluster',
  )
}
