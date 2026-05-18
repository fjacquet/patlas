/**
 * Phase 10 — one slide per cluster (D-01, ALWAYS, no cap). Header band +
 * KPI cards + the cluster's real CPU-utilization gauge (rasterized by the
 * worker). Pure & sync (the worker did the async raster).
 */
import type PptxGenJS from 'pptxgenjs'
import type { ClusterAggregate } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addChartPanel, addHeader, addKpiRow, CONTENT_W, M } from './_layout'

const EM_DASH = String.fromCharCode(0x2014)

export interface ClusterSlideData {
  cluster: ClusterAggregate
  /** Per-cluster CPU gauge PNG (worker resvg raster). Optional. */
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
  const y = addHeader(s, c.cluster, strings['cluster.subtitle'] ?? 'Cluster detail')
  const y2 = addKpiRow(
    s,
    [
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
    ],
    y,
  )
  addChartPanel(
    s,
    d.chartPng,
    { x: M, y: y2, w: CONTENT_W, h: 7.15 - y2 },
    strings['cluster.cpu'] ?? 'CPU utilization',
  )
}
