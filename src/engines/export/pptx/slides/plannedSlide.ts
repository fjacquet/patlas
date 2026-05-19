/** Phase 11 (F-1, deck side) — Planned vs measured estate: header +
 *  measured-vs-planned KPI row. Executive-tight, one screen-fit slide
 *  (D-02/D-03); the per-cluster delta lives in the HTML report. Factual
 *  "—" note when plannedView is null. */
import type PptxGenJS from 'pptxgenjs'
import type { EstateView } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addHeader, addKpiRow, addNote } from './_layout'

export function addPlannedSlide(
  pptx: PptxGenJS,
  view: EstateView,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['planned.title'] ?? 'Planned vs measured estate')
  if (view.plannedView === null) {
    addNote(s, strings['planned.none'] ?? '—', y)
    return
  }
  addKpiRow(
    s,
    [
      {
        label: strings['planned.vcpuMeasured'] ?? 'vCPU:pCPU measured',
        value: pptxNumber(Number(view.globals.vcpuPerPcpu), locale),
      },
      {
        label: strings['planned.vcpuPlanned'] ?? 'vCPU:pCPU planned',
        value: pptxNumber(Number(view.plannedView.globals.vcpuPerPcpu), locale),
      },
      {
        label: strings['planned.vmMeasured'] ?? 'VMs measured',
        value: pptxNumber(view.globals.vmCount, locale),
      },
      {
        label: strings['planned.vmPlanned'] ?? 'VMs planned',
        value: pptxNumber(view.plannedView.globals.vmCount, locale),
      },
    ],
    y,
  )
}
