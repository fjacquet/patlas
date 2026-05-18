/**
 * Phase 10 — one slide per cluster (D-01, ALWAYS, no top-N cap). Optional
 * pre-rasterized chart PNG (the builder does the async chartToSvg →
 * chartSvgToPng; the slide stays pure & sync). Factual, low density.
 */
import type PptxGenJS from 'pptxgenjs'
import type { ClusterAggregate } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addChartImage } from '../primitives/chartSvg'
import { SLIDE } from '../theme'
import { addHeading, addMetricList } from './_layout'

const EM_DASH = String.fromCharCode(0x2014)

export interface ClusterSlideData {
  cluster: ClusterAggregate
  /** Pre-rasterized PNG bytes from the builder (resvg-wasm). Optional —
   *  a chart-less cluster slide is valid. */
  chartPng?: Uint8Array
}

export function addClusterSlide(
  pptx: PptxGenJS,
  d: ClusterSlideData,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const c = d.cluster
  const s = pptx.addSlide()
  addHeading(s, c.cluster)
  addMetricList(s, [
    { label: strings['cluster.hosts'] ?? 'Hosts', value: pptxNumber(c.hostCount, locale) },
    { label: strings['cluster.vms'] ?? 'VMs', value: pptxNumber(c.vmCount, locale) },
    {
      label: strings['cluster.vcpuPerPcpu'] ?? 'vCPU : pCPU',
      value: pptxNumber(Number(c.vcpuPerPcpu), locale, 1),
    },
    {
      label: strings['cluster.datastores'] ?? 'Datastores',
      value: c.datastoreCount === null ? EM_DASH : pptxNumber(c.datastoreCount, locale),
    },
  ])
  if (d.chartPng) {
    addChartImage(s, d.chartPng, { x: SLIDE.w - 6, y: 1.3, w: 5.4, h: 3.2 })
  }
}
