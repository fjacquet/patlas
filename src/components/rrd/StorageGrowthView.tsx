import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { Chart } from '@/components/Chart'
import { StatTile } from '@/components/StatTile'
import { useEstateView } from '@/hooks/useEstateView'
import { fmtInt, fmtPercentWhole } from '@/utils/format'
import { storageGrowthBarOption } from './rrdChartOptions'

/**
 * P8 Pack A — Storage time-to-full view. Neutral read-only presenter of
 * per-storage capacity growth (GiB/day) and projected days-to-full from the
 * RRD-Storage time-series. `daysToFull` is `—` when not growing / already full
 * (never fabricated). No verdict/severity (ADR-0012). Reads
 * `view.rrdStorageGrowth` from the single `buildEstateView` pass.
 */
function GrowthError({ error }: FallbackProps) {
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

const round1 = (n: number): number => Math.round(n * 10) / 10

export function StorageGrowthView() {
  const { t, i18n } = useTranslation('rrd')
  const loc = i18n.language
  const view = useEstateView('active')
  const g = view.rrdStorageGrowth
  const growingCount = g.rows.filter((r) => r.growthGibPerDay > 0).length

  const option = storageGrowthBarOption(
    g.rows.filter((r) => r.growthGibPerDay > 0),
    t('storageGrowth.series.growth'),
    t('storageGrowth.unit.gibPerDay'),
  )

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={GrowthError}>
        <div className="flex flex-col gap-6">
          <section className="panel">
            <h2 className="mb-1 text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('storageGrowth.heading')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('storageGrowth.subtitle')}
            </p>
          </section>

          {!g.hasData ? (
            <section className="panel">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('storageGrowth.empty')}
              </p>
            </section>
          ) : (
            <>
              <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile
                  label={t('storageGrowth.kpi.storages')}
                  value={fmtInt(g.rows.length, loc)}
                />
                <StatTile
                  label={t('storageGrowth.kpi.soonest')}
                  value={
                    g.soonestDaysToFull === null
                      ? '—'
                      : fmtInt(Math.round(g.soonestDaysToFull), loc)
                  }
                />
                <StatTile
                  label={t('storageGrowth.kpi.window')}
                  value={fmtInt(Math.round(g.windowDays), loc)}
                />
                <StatTile
                  label={t('storageGrowth.kpi.growing')}
                  value={fmtInt(growingCount, loc)}
                />
              </section>

              {growingCount > 0 && (
                <section className="panel">
                  <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {t('storageGrowth.chartTitle')}
                  </h3>
                  <Chart option={option} ariaLabel={t('storageGrowth.chartTitle')} />
                </section>
              )}

              <section className="panel overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400">
                      <th className="px-2 py-1">{t('storageGrowth.col.storage')}</th>
                      <th className="px-2 py-1">{t('storageGrowth.col.node')}</th>
                      <th className="px-2 py-1 text-right">{t('storageGrowth.col.used')}</th>
                      <th className="px-2 py-1 text-right">{t('storageGrowth.col.size')}</th>
                      <th className="px-2 py-1 text-right">{t('storageGrowth.col.usage')}</th>
                      <th className="px-2 py-1 text-right">{t('storageGrowth.col.growth')}</th>
                      <th className="px-2 py-1 text-right">{t('storageGrowth.col.daysToFull')}</th>
                      <th className="px-2 py-1 text-right">{t('storageGrowth.col.samples')}</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                    {g.rows.map((r) => (
                      <tr key={r.key} className="border-t border-slate-100 dark:border-surface-700">
                        <td className="px-2 py-1 font-sans">{r.storage}</td>
                        <td className="px-2 py-1 font-sans">{r.node}</td>
                        <td className="px-2 py-1 text-right">
                          {fmtInt(Math.round(r.usedGib), loc)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {fmtInt(Math.round(r.sizeGib), loc)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {fmtPercentWhole(r.usageRatio, loc)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {fmtInt(round1(r.growthGibPerDay), loc)}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {r.daysToFull === null ? '—' : fmtInt(Math.round(r.daysToFull), loc)}
                        </td>
                        <td className="px-2 py-1 text-right">{fmtInt(r.sampleCount, loc)}</td>
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
