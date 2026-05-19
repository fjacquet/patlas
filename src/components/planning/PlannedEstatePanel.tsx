import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import type { EstateView } from '@/types/estate'
import { fmtInt } from '@/utils/format'

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
    <span className="font-mono text-sm tabular-nums text-slate-900 dark:text-slate-100">
      {value}
    </span>
  </div>
)

/**
 * F-1 (PLN-03/04) — planned-vs-measured estate. Pure presenter: every
 * number comes straight off the `view` prop (`view.globals` is the
 * measured estate, `view.plannedView` the planned re-aggregation),
 * exactly as DrSimPanel reads `view.drSim`/`view.plannedDrSim`. It does
 * not call the view-model hook, does not memoize, and imports no engine
 * module — every value is read straight off the prop. Factual only.
 */
export function PlannedEstatePanel({ view }: { view: EstateView }) {
  const { t } = useTranslation('alloc')
  const { i18n } = useTranslation()
  const loc = i18n.language

  return (
    <section className="panel flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
        {t('plannedEstate.title')}
      </h2>
      {view.plannedView === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('plannedEstate.none')}</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Stat
              label={t('plannedEstate.vmMeasured')}
              value={fmtInt(Number(view.globals.vmCount), loc)}
            />
            <Stat
              label={t('plannedEstate.vmPlanned')}
              value={fmtInt(Number(view.plannedView.globals.vmCount), loc)}
            />
            <Stat
              label={t('plannedEstate.vcpuMeasured')}
              value={fmtInt(Number(view.globals.vcpuPerPcpu), loc)}
            />
            <Stat
              label={t('plannedEstate.vcpuPlanned')}
              value={fmtInt(Number(view.plannedView.globals.vcpuPerPcpu), loc)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {t('plannedEstate.clusterDelta')}
            </h3>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                {t('plannedEstate.colCluster')}
              </span>
              <span className="text-right text-slate-500 dark:text-slate-400">
                {t('plannedEstate.colMeasured')}
              </span>
              <span className="text-right text-slate-500 dark:text-slate-400">
                {t('plannedEstate.colPlanned')}
              </span>
              {view.plannedView.clusters.map((pc) => {
                const measured = view.clusters.find((c) => c.cluster === pc.cluster)
                return (
                  <Fragment key={pc.cluster}>
                    <span className="text-slate-900 dark:text-slate-100">{pc.cluster}</span>
                    <span className="text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {measured ? fmtInt(Number(measured.vcpuPerPcpu), loc) : '—'}
                    </span>
                    <span className="text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {fmtInt(Number(pc.vcpuPerPcpu), loc)}
                    </span>
                  </Fragment>
                )
              })}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
