import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { Chart } from '@/components/Chart'
import { StatTile } from '@/components/StatTile'
import { useEstateView } from '@/hooks/useEstateView'
import { fmtInt, fmtPercentWhole } from '@/utils/format'
import { headroomBarOption } from './rrdChartOptions'

/**
 * P8 Pack A — Node Headroom view. Neutral read-only presenter of per-node RRD
 * utilization (peak/avg/p95 CPU & memory, IO-wait, loadavg, memory-pressure,
 * net throughput). No verdict/severity (ADR-0012). Reads `view.rrdHeadroom`
 * produced by the single `buildEstateView` pass — no second memo.
 */
function HeadroomError({ error }: FallbackProps) {
  const message = error instanceof Error ? error.message : 'unknown error'
  return (
    <div
      role="alert"
      className="rounded-lg border border-util-high/40 bg-white p-6 dark:bg-surface-800"
    >
      <p className="text-sm text-slate-700 dark:text-slate-300">{message}</p>
    </div>
  )
}

export function RrdHeadroomView() {
  const { t, i18n } = useTranslation('rrd')
  const loc = i18n.language
  const view = useEstateView('active')
  const hr = view.rrdHeadroom

  const option = headroomBarOption(hr.perNode, {
    cpuPeak: t('headroom.series.cpuPeak'),
    cpuP95: t('headroom.series.cpuP95'),
    cpuAvg: t('headroom.series.cpuAvg'),
    memPeak: t('headroom.series.memPeak'),
    memP95: t('headroom.series.memP95'),
    memAvg: t('headroom.series.memAvg'),
  })

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={HeadroomError}>
        <div className="flex flex-col gap-6">
          <section className="panel">
            <h2 className="mb-1 text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('headroom.heading')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('headroom.subtitle')}</p>
          </section>

          {!hr.hasData ? (
            <section className="panel">
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('headroom.empty')}</p>
            </section>
          ) : (
            <>
              <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <StatTile
                  label={t('headroom.kpi.cpuPeak')}
                  value={fmtPercentWhole(hr.estate.cpuPeak, loc)}
                />
                <StatTile
                  label={t('headroom.kpi.cpuAvg')}
                  value={fmtPercentWhole(hr.estate.cpuAvg, loc)}
                />
                <StatTile
                  label={t('headroom.kpi.memPeak')}
                  value={fmtPercentWhole(hr.estate.memPeak, loc)}
                />
                <StatTile
                  label={t('headroom.kpi.memAvg')}
                  value={fmtPercentWhole(hr.estate.memAvg, loc)}
                />
                <StatTile
                  label={t('headroom.kpi.ioWaitPeak')}
                  value={fmtPercentWhole(hr.estate.ioWaitPeak, loc)}
                />
                <StatTile
                  label={t('headroom.kpi.psiMemPeak')}
                  value={fmtPercentWhole(hr.estate.psiMemPeak, loc)}
                />
              </section>

              <section className="panel">
                <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {t('headroom.chartTitle')}
                </h3>
                <Chart option={option} ariaLabel={t('headroom.chartTitle')} />
              </section>

              <section className="panel overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400">
                      <th className="px-2 py-1">{t('headroom.col.node')}</th>
                      <th className="px-2 py-1 text-right">{t('headroom.col.cpuPeak')}</th>
                      <th className="px-2 py-1 text-right">{t('headroom.col.cpuP95')}</th>
                      <th className="px-2 py-1 text-right">{t('headroom.col.cpuAvg')}</th>
                      <th className="px-2 py-1 text-right">{t('headroom.col.memPeak')}</th>
                      <th className="px-2 py-1 text-right">{t('headroom.col.memP95')}</th>
                      <th className="px-2 py-1 text-right">{t('headroom.col.memAvg')}</th>
                      <th className="px-2 py-1 text-right">{t('headroom.col.ioWait')}</th>
                      <th className="px-2 py-1 text-right">{t('headroom.col.loadavg')}</th>
                      <th className="px-2 py-1 text-right">{t('headroom.col.psiMem')}</th>
                      <th className="px-2 py-1 text-right">{t('headroom.col.netIn')}</th>
                      <th className="px-2 py-1 text-right">{t('headroom.col.netOut')}</th>
                      <th className="px-2 py-1 text-right">{t('headroom.col.samples')}</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                    {hr.perNode.map((n) => (
                      <tr
                        key={n.node}
                        className="border-t border-slate-100 dark:border-surface-700"
                      >
                        <td className="px-2 py-1 font-sans">{n.node}</td>
                        <td className="px-2 py-1 text-right">{fmtPercentWhole(n.cpuPeak, loc)}</td>
                        <td className="px-2 py-1 text-right">{fmtPercentWhole(n.cpuP95, loc)}</td>
                        <td className="px-2 py-1 text-right">{fmtPercentWhole(n.cpuAvg, loc)}</td>
                        <td className="px-2 py-1 text-right">{fmtPercentWhole(n.memPeak, loc)}</td>
                        <td className="px-2 py-1 text-right">{fmtPercentWhole(n.memP95, loc)}</td>
                        <td className="px-2 py-1 text-right">{fmtPercentWhole(n.memAvg, loc)}</td>
                        <td className="px-2 py-1 text-right">
                          {fmtPercentWhole(n.ioWaitPeak, loc)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {fmtInt(Math.round(n.loadavgPeak), loc)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {fmtPercentWhole(n.psiMemPeak, loc)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {fmtInt(Math.round(n.netInPeakMb), loc)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {fmtInt(Math.round(n.netOutPeakMb), loc)}
                        </td>
                        <td className="px-2 py-1 text-right">{fmtInt(n.sampleCount, loc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </div>
      </ErrorBoundary>
    </main>
  )
}
