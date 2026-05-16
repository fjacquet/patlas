import { useTranslation } from 'react-i18next'
import { MIDNIGHT_EXECUTIVE_DARK, MIDNIGHT_EXECUTIVE_LIGHT } from '@/theme/echartsTheme'
import type { ClusterAggregate, OsBreakdown } from '@/types/estate'
import { fmtGhzValue, fmtInt, fmtPercentValue, fmtRatio } from '@/utils/format'
import { UtilizationGauge } from './UtilizationGauge'

export interface ClusterColumnProps {
  cluster: ClusterAggregate
  os: OsBreakdown
}

const isDark = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

/** Stable label/value row — labels left, values right-aligned mono so the
 *  same metric lines up vertically across columns when scanning horizontally. */
const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>
    <span className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
      {value}
    </span>
  </div>
)

/**
 * DSH-01/03 — one `min-w-[200px]` `.panel` column per cluster. Presentational
 * prop-consumer (no memo hooks, no engine/store imports). The W/L/O OS mini is a
 * CSS flex bar using the same 3 theme colors as the donut (KISS — avoids a
 * chart instance per column while keeping the OS encoding consistent). The
 * per-cluster datastore count is the em-dash sentinel `—` with a localized
 * aria-label (A1 — `ClusterAggregate` has no datastore field; Phase-3
 * carry-forward). Labels left / values right-aligned font-mono tabular-nums.
 * Footer keeps vertical room for Phase-6 per-cluster sparklines (`trends`
 * is null in Phase 2). Every color utility carries its `dark:` twin.
 */
export function ClusterColumn({ cluster, os }: ClusterColumnProps) {
  const { t, i18n } = useTranslation('dashboard')
  const loc = i18n.language
  const palette = (isDark() ? MIDNIGHT_EXECUTIVE_DARK : MIDNIGHT_EXECUTIVE_LIGHT).color
  const osTotal = os.windows + os.linux + os.other
  const pct = (n: number) => (osTotal > 0 ? `${(n / osTotal) * 100}%` : '0%')

  return (
    <section className="panel flex min-w-[200px] flex-col gap-3">
      <h3 className="break-words text-xl font-semibold text-slate-700 dark:text-slate-200">
        {cluster.cluster}
      </h3>

      <Row label={t('stats.esx')} value={fmtInt(cluster.hostCount, loc)} />
      <Row label={t('stats.vms')} value={fmtInt(cluster.vmCount, loc)} />

      {/* W/L/O OS mini stacked bar (donut token order, consistent encoding) */}
      <div
        role="img"
        className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-surface-700"
        aria-label={`${t('os.windows')} ${os.windows} · ${t('os.linux')} ${os.linux} · ${t('os.other')} ${os.other}`}
      >
        <span style={{ width: pct(os.windows), backgroundColor: palette[0] }} />
        <span style={{ width: pct(os.linux), backgroundColor: palette[1] }} />
        <span style={{ width: pct(os.other), backgroundColor: palette[2] }} />
      </div>

      <Row label={t('stats.datastores')} value="—" />
      <span className="sr-only">{t('datastoreNotPerCluster')}</span>

      <Row label={t('stats.physicalGhz')} value={fmtGhzValue(cluster.physicalGhz as number, loc)} />
      <Row label={t('stats.consumedGhz')} value={fmtGhzValue(cluster.consumedGhz as number, loc)} />

      <div className="mt-1 flex flex-wrap items-end justify-around gap-2">
        <UtilizationGauge
          value0to1={Math.min(cluster.meanCpuRatio, 1)}
          kind="cpu"
          displayLabel={fmtPercentValue(cluster.meanCpuRatio * 100, loc)}
          caption={t('stats.cpuPct')}
        />
        <UtilizationGauge
          value0to1={Math.min(cluster.meanRamRatio, 1)}
          kind="ram"
          displayLabel={fmtPercentValue(cluster.meanRamRatio * 100, loc)}
          caption={t('stats.ramPct')}
        />
        <UtilizationGauge
          value0to1={Math.min(cluster.vcpuPerPcpu / 10, 1)}
          kind="alloc"
          displayLabel={fmtRatio(cluster.vcpuPerPcpu, loc)}
          caption={t('stats.vcpuPerCore')}
        />
      </div>

      <div className="mt-1 border-t border-slate-200 pt-2 dark:border-surface-700">
        <Row
          label={t('stats.cpuReadyMean')}
          value={
            cluster.readinessAvailable && cluster.meanCpuReadinessPercent !== null
              ? fmtPercentValue(cluster.meanCpuReadinessPercent, loc)
              : t('cpuReadyNotReported')
          }
        />
        <Row
          label={t('stats.cpuReadyMax')}
          value={
            cluster.readinessAvailable && cluster.maxCpuReadinessPercent !== null
              ? fmtPercentValue(cluster.maxCpuReadinessPercent, loc)
              : t('cpuReadyNotReported')
          }
        />
        <Row
          label={t('stats.vmsAboveReady')}
          value={fmtInt(cluster.vmsAboveReadinessWarning, loc)}
        />
      </div>

      {/* Phase-6 per-cluster sparkline lands here (trends is null Phase 2). */}
    </section>
  )
}
