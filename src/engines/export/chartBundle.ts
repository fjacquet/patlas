/**
 * Phase 10 (PPTX polish) — the deck/report chart set, built from the app's
 * OWN chart-option builders so the exported visuals ARE the app's visuals
 * (not a placeholder). PURE: returns `EChartsOption`s only; the worker
 * rasterizes them via the locked `chartToSvg → chartSvgToPng` path. No
 * React/DOM/Zustand.
 */
import type { EChartsOption } from 'echarts/types/dist/shared'
import { osDonutOption, utilizationGaugeOption } from '@/components/dashboard/chartOptions'
import { trendLineOption } from '@/components/trends/trendsChartOptions'
import type { EstateView, OperationalInsights, TrendSeries } from '@/types/estate'

const pct = (v: number): string => `${Number.isFinite(v) ? Math.round(v) : 0} %`

/** Estate-wide CPU/RAM utilization gauges + the OS-family donut — the
 *  literal dashboard charts. */
function overviewCharts(view: EstateView): Record<string, EChartsOption> {
  const oi = view.operationalInsights
  return {
    osDonut: osDonutOption(
      view.osBreakdown,
      { windows: 'Windows', linux: 'Linux', other: 'Other' },
      'OS family breakdown',
    ),
    cpuGauge: utilizationGaugeOption(
      Number(oi.avgCpuPct) / 100,
      'cpu',
      pct(Number(oi.avgCpuPct)),
      'Mean CPU utilization',
    ),
    ramGauge: utilizationGaugeOption(
      Number(oi.avgMemPct) / 100,
      'ram',
      pct(Number(oi.avgMemPct)),
      'Mean memory utilization',
    ),
  }
}

/** EOS forecast bucket bar — same shape EosView renders. */
function eosBar(view: EstateView): EChartsOption {
  const p = view.eos.partition
  return {
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: ['Overdue', '≤3m', '3–6m', '6–9m', '9–12m', '>12m', 'Unknown'],
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        type: 'bar',
        data: [
          p.overdue.length,
          p.w3.length,
          p.w3to6.length,
          p.w6to9.length,
          p.w9to12.length,
          p.beyond12.length,
          p.unknown.length,
        ],
      },
    ],
  }
}

/** DR physical-impact before/after bar (factual magnitude, no verdict). */
function drBar(view: EstateView): EChartsOption | null {
  const dr = view.drSim
  if (!dr) return null
  return {
    grid: { left: 8, right: 8, top: 24, bottom: 24, containLabel: true },
    legend: { bottom: 0 },
    xAxis: { type: 'category', data: ['Phys. cores', 'Phys. RAM (GiB)'] },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        name: 'Before',
        data: [
          Number(dr.before.physicalCores),
          Math.round(Number(dr.before.physicalRamMib) / 1024),
        ],
      },
      {
        type: 'bar',
        name: 'After',
        data: [Number(dr.after.physicalCores), Math.round(Number(dr.after.physicalRamMib) / 1024)],
      },
    ],
  }
}

/** A per-cluster CPU-utilization gauge (the app's real gauge), keyed by
 *  cluster name — used on every per-cluster slide + the HTML report. */
function perClusterCharts(view: EstateView): Map<string, EChartsOption> {
  const out = new Map<string, EChartsOption>()
  for (const c of view.clusters) {
    const ins: OperationalInsights | undefined = view.clusterInsights.get(c.cluster)
    const cpu = ins ? Number(ins.avgCpuPct) : 0
    out.set(
      c.cluster,
      utilizationGaugeOption(cpu / 100, 'cpu', pct(cpu), `${c.cluster} CPU utilization`),
    )
  }
  return out
}

export interface ChartOptionBundle {
  shared: Record<string, EChartsOption>
  perCluster: Map<string, EChartsOption>
}

/** Rasterized counterpart threaded into `buildPptx` (worker → builder →
 *  slides). `shared` keyed by purpose (osDonut/cpuGauge/ramGauge/eosBar/
 *  drBar/trendLine); `perCluster` keyed by cluster name. */
export interface PngBundle {
  shared: Map<string, Uint8Array>
  perCluster: Map<string, Uint8Array>
}

export function buildChartBundle(
  view: EstateView,
  trends: TrendSeries | null,
  locale: 'en' | 'fr',
): ChartOptionBundle {
  const shared: Record<string, EChartsOption> = { ...overviewCharts(view), eosBar: eosBar(view) }
  const dr = drBar(view)
  if (dr) shared.drBar = dr
  if (trends) {
    shared.trendLine = trendLineOption(
      trends,
      {
        vmCount: 'VMs',
        poweredOnVms: 'Powered-on',
        tooltipDate: '{{date}}',
        tooltipMeta: '{{vcenter}} · {{version}}',
      },
      locale === 'fr' ? 'fr-FR' : 'en-US',
    )
  }
  return { shared, perCluster: perClusterCharts(view) }
}
