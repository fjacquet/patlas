/** Phase 10 — estate KPI overview (PPT-03). Pure, factual, low density. */
import type PptxGenJS from 'pptxgenjs'
import type { GlobalSummary, OperationalInsights } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addHeading, addMetricList } from './_layout'

export interface OverviewData {
  globals: GlobalSummary
  insights: OperationalInsights
}

export function addOverviewSlide(
  pptx: PptxGenJS,
  d: OverviewData,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  addHeading(s, strings['overview.title'] ?? 'Estate overview')
  addMetricList(s, [
    { label: strings['overview.vms'] ?? 'VMs', value: pptxNumber(d.globals.vmCount, locale) },
    { label: strings['overview.hosts'] ?? 'Hosts', value: pptxNumber(d.globals.hostCount, locale) },
    {
      label: strings['overview.clusters'] ?? 'Clusters',
      value: pptxNumber(d.globals.clusterCount, locale),
    },
    {
      label: strings['overview.vcpuPerPcpu'] ?? 'vCPU : pCPU',
      value: pptxNumber(Number(d.globals.vcpuPerPcpu), locale, 1),
    },
    {
      label: strings['overview.cpuPct'] ?? 'Mean CPU %',
      value: pptxNumber(Number(d.insights.avgCpuPct), locale, 0),
    },
    {
      label: strings['overview.memPct'] ?? 'Mean memory %',
      value: pptxNumber(Number(d.insights.avgMemPct), locale, 0),
    },
    {
      label: strings['overview.poweredOn'] ?? 'Powered-on VMs',
      value: pptxNumber(d.insights.poweredOnVms, locale),
    },
  ])
}
