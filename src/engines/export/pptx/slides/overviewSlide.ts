/** Phase 10 — estate overview: KPI cards + the app's OS donut & CPU/RAM
 *  utilization gauges (real charts, rasterized). Pure, factual. */
import type PptxGenJS from 'pptxgenjs'
import type { GlobalSummary, OperationalInsights } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addChartPanel, addHeader, addKpiRow, CONTENT_W, M } from './_layout'

export interface OverviewData {
  globals: GlobalSummary
  insights: OperationalInsights
  osDonut?: Uint8Array
  cpuGauge?: Uint8Array
  ramGauge?: Uint8Array
}

export function addOverviewSlide(
  pptx: PptxGenJS,
  d: OverviewData,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['overview.title'] ?? 'Estate overview')
  const y2 = addKpiRow(
    s,
    [
      { label: strings['overview.vms'] ?? 'VMs', value: pptxNumber(d.globals.vmCount, locale) },
      {
        label: strings['overview.hosts'] ?? 'Hosts',
        value: pptxNumber(d.globals.hostCount, locale),
      },
      {
        label: strings['overview.clusters'] ?? 'Clusters',
        value: pptxNumber(d.globals.clusterCount, locale),
      },
      {
        label: strings['overview.vcpuPerPcpu'] ?? 'vCPU : pCPU',
        value: pptxNumber(Number(d.globals.vcpuPerPcpu), locale, 1),
      },
    ],
    y,
  )
  const gap = 0.2
  const pw = (CONTENT_W - gap * 2) / 3
  const ph = 7.15 - y2
  addChartPanel(s, d.osDonut, { x: M, y: y2, w: pw, h: ph }, strings['overview.os'] ?? 'OS family')
  addChartPanel(
    s,
    d.cpuGauge,
    { x: M + pw + gap, y: y2, w: pw, h: ph },
    strings['overview.cpu'] ?? 'Mean CPU %',
  )
  addChartPanel(
    s,
    d.ramGauge,
    { x: M + (pw + gap) * 2, y: y2, w: pw, h: ph },
    strings['overview.mem'] ?? 'Mean memory %',
  )
}
