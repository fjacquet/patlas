/** Phase 11 (F-2) — Network: KPI-only slide (vSwitch / dvSwitch /
 *  portgroup / VM-adjacency counts). No chart (D-08: network has no
 *  natural executive visual). Absent optional sheets ⇒ factual 0. */
import type PptxGenJS from 'pptxgenjs'
import type { EstateView } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addHeader, addKpiRow } from './_layout'

export function addNetworkSlide(
  pptx: PptxGenJS,
  view: EstateView,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const n = view.network
  const y = addHeader(s, strings['network.title'] ?? 'Network')
  addKpiRow(
    s,
    [
      {
        label: strings['network.vswitches'] ?? 'vSwitches',
        value: pptxNumber(n.vswitches.length, locale),
      },
      {
        label: strings['network.dvswitches'] ?? 'dvSwitches',
        value: pptxNumber(n.dvswitches.length, locale),
      },
      {
        label: strings['network.portgroups'] ?? 'Portgroups',
        value: pptxNumber(n.portgroups.length, locale),
      },
      {
        label: strings['network.vnetwork'] ?? 'VM adjacencies',
        value: pptxNumber(n.vmPortgroupCount, locale),
      },
    ],
    y,
  )
}
