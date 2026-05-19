/** Phase 10 — estate overview: KPI cards + the app's OS donut & CPU/RAM
 *  utilization gauges (real charts, rasterized). Pure, factual. */
import type PptxGenJS from 'pptxgenjs'
import type { GlobalSummary, OperationalInsights } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxMemMib, pptxNumber } from '../format'
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
  // PPT-02: second KPI row surfaces previously-dropped estate facts
  // (utilization + physical capacity + storage), factual only.
  const o = d.insights
  const y3 = addKpiRow(
    s,
    [
      {
        label: strings['overview.avgCpu'] ?? 'Avg CPU %',
        value: pptxNumber(Number(o.avgCpuPct), locale, 1),
      },
      {
        label: strings['overview.avgMem'] ?? 'Avg memory %',
        value: pptxNumber(Number(o.avgMemPct), locale, 1),
      },
      {
        label: strings['overview.cores'] ?? 'Physical cores',
        value: pptxNumber(Number(o.totalPhysicalCores), locale),
      },
      {
        label: strings['overview.hostMem'] ?? 'Host memory',
        value: pptxMemMib(Number(o.totalHostMemoryMib), locale),
      },
      {
        label: strings['overview.provisioned'] ?? 'Provisioned',
        value: pptxMemMib(Number(o.provisionedMib), locale),
      },
      {
        label: strings['overview.inUse'] ?? 'In use',
        value: pptxMemMib(Number(o.inUseMib), locale),
      },
    ],
    y2,
  )
  const gap = 0.2
  const pw = (CONTENT_W - gap * 2) / 3
  const ph = 7.15 - y3
  addChartPanel(s, d.osDonut, { x: M, y: y3, w: pw, h: ph }, strings['overview.os'] ?? 'OS family')
  addChartPanel(
    s,
    d.cpuGauge,
    { x: M + pw + gap, y: y3, w: pw, h: ph },
    strings['overview.cpu'] ?? 'Mean CPU %',
  )
  addChartPanel(
    s,
    d.ramGauge,
    { x: M + (pw + gap) * 2, y: y3, w: pw, h: ph },
    strings['overview.mem'] ?? 'Mean memory %',
  )
}
