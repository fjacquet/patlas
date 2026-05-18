/** Phase 10 — inventory summary slide (PPT-03, final). Factual counts. */
import type PptxGenJS from 'pptxgenjs'
import type { EstateView } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addHeading, addMetricList } from './_layout'

export function addInventorySlide(
  pptx: PptxGenJS,
  view: EstateView,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  addHeading(s, strings['inventory.title'] ?? 'Inventory summary')
  addMetricList(s, [
    { label: strings['inventory.vms'] ?? 'VM rows', value: pptxNumber(view.vmRows.length, locale) },
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
  ])
}
