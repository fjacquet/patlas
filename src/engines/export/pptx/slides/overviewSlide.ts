/** Phase 18 — estate overview: KPI cards (counts + utilization + capacity)
 *  and a factual OS-family breakdown. The rasterized OS donut had no legend
 *  ("missing text") and the CPU/RAM gauges rendered giant + verdict-colored
 *  (off-brand) and were redundant with the Avg CPU/Mem cards — both dropped
 *  for readable text. Pure, factual, brand-free. */
import type PptxGenJS from 'pptxgenjs'
import type { AvgVmSize } from '@/engines/aggregation/avgVmSize'
import type { GlobalSummary, OperationalInsights, OsBreakdown } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxMemMib, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, M } from './_layout'

export interface OverviewData {
  globals: GlobalSummary
  insights: OperationalInsights
  osBreakdown: OsBreakdown
  /** VM-data datastore used/capacity (from `view.storage.byRole` vmdata group),
   *  in MiB. `null` when no vmdata storage role is present → cards show "—".
   *  Replaces the unreliable per-VM `Provisioned`/`Used storage` columns. */
  vmStorage: { usedMib: number; capacityMib: number } | null
  /** Mean/median VM size (vCPU, vRAM, provisioned storage) over the
   *  accounting-mode-filtered guest population. PPTX KPI tiles have no
   *  sub-caption, so mean and median are folded into one value string
   *  (`mean / median`). */
  avgVmSize: AvgVmSize
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
        label: strings['overview.vmStorageUsed'] ?? 'VM storage used',
        value: d.vmStorage ? pptxMemMib(d.vmStorage.usedMib, locale) : '—',
      },
      {
        label: strings['overview.vmStorageCapacity'] ?? 'VM storage capacity',
        value: d.vmStorage ? pptxMemMib(d.vmStorage.capacityMib, locale) : '—',
      },
    ],
    y2,
  )
  // Avg VM size — mean/median folded into one value string since KPI tiles
  // have no sub-caption (matches the reviewed mock, e.g. "6.4 / 4.0").
  const a = d.avgVmSize
  const y4 = addKpiRow(
    s,
    [
      {
        label: strings['overview.avgVcpu'] ?? 'Avg vCPU (mean / median)',
        value: `${pptxNumber(Number(a.vcpu.mean), locale, 1)} / ${pptxNumber(Number(a.vcpu.median), locale, 1)}`,
      },
      {
        label: strings['overview.avgRam'] ?? 'Avg RAM (mean / median)',
        value: `${pptxMemMib(Number(a.vramMib.mean), locale)} / ${pptxMemMib(Number(a.vramMib.median), locale)}`,
      },
      {
        label: strings['overview.avgDisk'] ?? 'Avg disk (mean / median)',
        value: `${pptxMemMib(Number(a.provisionedMib.mean), locale)} / ${pptxMemMib(Number(a.provisionedMib.median), locale)}`,
      },
    ],
    y3,
  )
  // OS-family breakdown as factual text (counts + share). Replaces the
  // unlabeled donut so the families are actually named on the slide.
  const os = d.osBreakdown
  const total = os.windows + os.linux + os.other
  const share = (k: number) =>
    total > 0 ? ` (${pptxNumber(Math.round((k / total) * 100), locale)} %)` : ''
  s.addText(pptxSafeFormat(strings['os.title'] ?? 'Operating systems'), {
    x: M,
    y: y4 + 0.05,
    w: 6,
    h: 0.3,
    fontFace: 'Arial',
    fontSize: 13,
    bold: true,
    color: PPTX_COLORS.ink,
    margin: 0,
  })
  addKpiRow(
    s,
    [
      {
        label: strings['os.windows'] ?? 'Windows',
        value: pptxNumber(os.windows, locale) + share(os.windows),
      },
      {
        label: strings['os.linux'] ?? 'Linux',
        value: pptxNumber(os.linux, locale) + share(os.linux),
      },
      {
        label: strings['os.other'] ?? 'Other',
        value: pptxNumber(os.other, locale) + share(os.other),
      },
    ],
    y4 + 0.45,
  )
}
