import type { EChartsOption } from 'echarts/types/dist/shared'
import { excelSerialToUnixMs } from '@/engines/aggregation'
import type { RrdEstateTimePoint, RrdNodeStat, RrdStorageProjection } from '@/types/estate'

/**
 * Pure ECharts option builders for the P8 Pack A RRD views (no hooks, no memo
 * — called with the memoized `view.rrdHeadroom` / `view.rrdStorageGrowth`).
 * SVG renderer is injected by `<Chart>`. Neutral measurement: theme palette
 * only, no verdict colour. All ratio inputs are 0-1 fractions rendered as
 * whole-percent axes.
 */

const pct = (r: number): number => Math.round(r * 1000) / 10

interface HeadroomCopy {
  cpuPeak: string
  cpuP95: string
  cpuAvg: string
  memPeak: string
  memP95: string
  memAvg: string
}

/** Grouped bar: per-node CPU & memory peak / p95 / mean (whole-percent axis). */
export const headroomBarOption = (nodes: RrdNodeStat[], copy: HeadroomCopy): EChartsOption => {
  const names = nodes.map((n) => n.node)
  const legend = [copy.cpuPeak, copy.cpuP95, copy.cpuAvg, copy.memPeak, copy.memP95, copy.memAvg]
  return {
    grid: { left: 8, right: 8, top: 32, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (v) => `${v} %` },
    legend: { data: legend, type: 'scroll' },
    xAxis: { type: 'category', data: names },
    yAxis: { type: 'value', axisLabel: { formatter: '{value} %' } },
    series: [
      { name: copy.cpuPeak, type: 'bar', data: nodes.map((n) => pct(n.cpuPeak)) },
      { name: copy.cpuP95, type: 'bar', data: nodes.map((n) => pct(n.cpuP95)) },
      { name: copy.cpuAvg, type: 'bar', data: nodes.map((n) => pct(n.cpuAvg)) },
      { name: copy.memPeak, type: 'bar', data: nodes.map((n) => pct(n.memPeak)) },
      { name: copy.memP95, type: 'bar', data: nodes.map((n) => pct(n.memP95)) },
      { name: copy.memAvg, type: 'bar', data: nodes.map((n) => pct(n.memAvg)) },
    ],
  }
}

/** Horizontal bar: used-capacity growth rate (GiB/day) per storage, top-N. */
export const storageGrowthBarOption = (
  rows: RrdStorageProjection[],
  seriesName: string,
  unit: string,
): EChartsOption => {
  const top = rows.slice(0, 16)
  // Highest growth at the top of a horizontal bar (category axis renders
  // bottom-up, so reverse for visual descending order).
  const ordered = [...top].sort((a, b) => a.growthGibPerDay - b.growthGibPerDay)
  return {
    grid: { left: 8, right: 16, top: 16, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (v) => `${v} ${unit}` },
    xAxis: { type: 'value', axisLabel: { formatter: `{value} ${unit}` } },
    yAxis: { type: 'category', data: ordered.map((r) => r.key) },
    series: [
      {
        name: seriesName,
        type: 'bar',
        data: ordered.map((r) => Math.round(r.growthGibPerDay * 100) / 100),
      },
    ],
  }
}

interface TrendCopy {
  cpu: string
  mem: string
}

/** Line over the RRD window: estate-wide mean CPU & memory (whole-percent). */
export const singleFileTrendOption = (
  timeline: RrdEstateTimePoint[],
  copy: TrendCopy,
): EChartsOption => ({
  grid: { left: 8, right: 8, top: 32, bottom: 24, containLabel: true },
  tooltip: { trigger: 'axis', valueFormatter: (v) => `${v} %` },
  legend: { data: [copy.cpu, copy.mem] },
  xAxis: { type: 'time' },
  yAxis: { type: 'value', axisLabel: { formatter: '{value} %' } },
  series: [
    {
      name: copy.cpu,
      type: 'line',
      showSymbol: false,
      data: timeline.map((p) => [excelSerialToUnixMs(p.timeSerial), pct(p.cpuAvg)]),
    },
    {
      name: copy.mem,
      type: 'line',
      showSymbol: false,
      data: timeline.map((p) => [excelSerialToUnixMs(p.timeSerial), pct(p.memAvg)]),
    },
  ],
})
