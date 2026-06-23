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

/**
 * Chart-internal labels (axis categories, donut buckets, series names).
 * Inline EN/FR map — these are chart-image strings, not UI i18n keys, so
 * baking them here (mirroring the existing inline EOS categories) keeps
 * chartBundle pure and avoids needless i18n-namespace/key-parity churn.
 * Active-locale-only exports (D-07) ⇒ FR exports must not show EN charts.
 */
interface ChartLabels {
  os: { windows: string; linux: string; other: string; title: string }
  cpuTitle: string
  ramTitle: string
  clusterCpu: (name: string) => string
  eosCats: string[]
  trend: { vmCount: string; poweredOnVms: string }
}

const LABELS = (l: 'en' | 'fr'): ChartLabels =>
  l === 'fr'
    ? {
        os: { windows: 'Windows', linux: 'Linux', other: 'Autre', title: "Familles d'OS" },
        cpuTitle: 'Utilisation CPU moyenne',
        ramTitle: 'Utilisation mémoire moyenne',
        clusterCpu: (n) => `Utilisation CPU — ${n}`,
        eosCats: ['En retard', '≤3 m', '3–6 m', '6–9 m', '9–12 m', '>12 m', 'Inconnu'],
        trend: { vmCount: 'VM', poweredOnVms: 'Allumées' },
      }
    : {
        os: { windows: 'Windows', linux: 'Linux', other: 'Other', title: 'OS family' },
        cpuTitle: 'Mean CPU utilization',
        ramTitle: 'Mean memory utilization',
        clusterCpu: (n) => `${n} CPU utilization`,
        eosCats: ['Overdue', '≤3m', '3–6m', '6–9m', '9–12m', '>12m', 'Unknown'],
        trend: { vmCount: 'VMs', poweredOnVms: 'Powered-on' },
      }

/** Estate-wide CPU/RAM utilization gauges + the OS-family donut — the
 *  literal dashboard charts. */
function overviewCharts(view: EstateView, L: ChartLabels): Record<string, EChartsOption> {
  const oi = view.operationalInsights
  return {
    osDonut: osDonutOption(
      view.osBreakdown,
      { windows: L.os.windows, linux: L.os.linux, other: L.os.other },
      L.os.title,
    ),
    cpuGauge: utilizationGaugeOption(
      Number(oi.avgCpuPct) / 100,
      'cpu',
      pct(Number(oi.avgCpuPct)),
      L.cpuTitle,
    ),
    ramGauge: utilizationGaugeOption(
      Number(oi.avgMemPct) / 100,
      'ram',
      pct(Number(oi.avgMemPct)),
      L.ramTitle,
    ),
  }
}

/** EOS forecast bucket bar — same shape EosView renders. */
function eosBar(view: EstateView, L: ChartLabels): EChartsOption {
  const p = view.eos.partition
  return {
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    xAxis: { type: 'category', data: L.eosCats },
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

/** storageTreemap — storage consumption treemap, the SAME series shape
 *  StorageView renders for the consumption lens (D-07). `g.key` is the
 *  cluster name (user data, locale-independent), so no ChartLabels field
 *  is needed. */
function storageTreemap(view: EstateView, _L: ChartLabels): EChartsOption {
  return {
    tooltip: {},
    series: [
      {
        type: 'treemap',
        breadcrumb: { show: false },
        data: view.storage.byCluster.map((g) => ({
          name: g.key,
          value: g.provisionedMib as number,
        })),
      },
    ],
  }
}

/** A per-cluster CPU-utilization gauge (the app's real gauge), keyed by
 *  cluster name — used on every per-cluster slide + the HTML report. */
function perClusterCharts(view: EstateView, L: ChartLabels): Map<string, EChartsOption> {
  const out = new Map<string, EChartsOption>()
  for (const c of view.clusters) {
    const ins: OperationalInsights | undefined = view.clusterInsights.get(c.cluster)
    const cpu = ins ? Number(ins.avgCpuPct) : 0
    out.set(c.cluster, utilizationGaugeOption(cpu / 100, 'cpu', pct(cpu), L.clusterCpu(c.cluster)))
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
  const L = LABELS(locale)
  const shared: Record<string, EChartsOption> = {
    ...overviewCharts(view, L),
    eosBar: eosBar(view, L),
    storageTreemap: storageTreemap(view, L),
  }
  if (trends) {
    shared.trendLine = trendLineOption(
      trends,
      {
        vmCount: L.trend.vmCount,
        poweredOnVms: L.trend.poweredOnVms,
        tooltipDate: '{{date}}',
        tooltipMeta: '{{cluster}} · {{version}}',
      },
      locale === 'fr' ? 'fr-FR' : 'en-US',
    )
  }
  return { shared, perCluster: perClusterCharts(view, L) }
}
