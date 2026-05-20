import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Chart } from '@/components/Chart'
import { GaugeIcon, MemoryIcon, PackageIcon } from '@/components/icons'
import { StatTile } from '@/components/StatTile'
import type { EstateView } from '@/types/estate'
import { fmtInt, fmtMemMb } from '@/utils/format'
import { plannedHeadroomBarOption } from './plannedChartOptions'

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
    <span className="font-mono text-sm tabular-nums text-slate-900 dark:text-slate-100">
      {value}
    </span>
  </div>
)

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)

/**
 * F-1 (PLN-03/04) + PLN-01 visual return. Pure presenter: every number comes
 * straight off the `view` prop (`view.globals` measured, `view.plannedView`
 * the planned re-aggregation). The estate capacity totals are a render-time
 * reduce over the already-memoized cluster arrays — NOT a second memo and NOT
 * an engine call (the single sanctioned memo stays `useEstateView`). Factual
 * only: a "headroom" is `capacity − allocated demand`; the gold demand line
 * is the factual marker, never a verdict.
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
        (() => {
          const mCapV = sum(view.clusters.map((c) => Number(c.capacityVcpu)))
          const pCapV = sum((view.plannedView?.clusters ?? []).map((c) => Number(c.capacityVcpu)))
          const allocV = Number(view.globals.vcpuAllocated)
          const mCapR = sum(view.clusters.map((c) => Number(c.capacityRamMib)))
          const pCapR = sum((view.plannedView?.clusters ?? []).map((c) => Number(c.capacityRamMib)))
          const allocR = Number(view.globals.vramAllocatedMib)
          const signedInt = (n: number) =>
            (n >= 0 ? '+' : '−') + fmtInt(Math.abs(Math.round(n)), loc)
          return (
            <>
              <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                {t('plannedEstate.headroomTitle')}
              </h3>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <StatTile
                  icon={<GaugeIcon />}
                  label={t('plannedEstate.capMeasured')}
                  value={fmtInt(Math.round(mCapV), loc)}
                  sub={`${t('plannedEstate.headroom')} ${signedInt(mCapV - allocV)}`}
                />
                <StatTile
                  icon={<GaugeIcon />}
                  label={t('plannedEstate.capPlanned')}
                  value={fmtInt(Math.round(pCapV), loc)}
                  sub={`${t('plannedEstate.headroom')} ${signedInt(pCapV - allocV)}`}
                  accent="primary"
                />
                <StatTile
                  icon={<PackageIcon />}
                  label={t('plannedEstate.vcpuDemand')}
                  value={fmtInt(Math.round(allocV), loc)}
                  accent="gold"
                />
                <StatTile
                  icon={<MemoryIcon />}
                  label={t('plannedEstate.ramCapMeasured')}
                  value={fmtMemMb(mCapR, loc)}
                />
                <StatTile
                  icon={<MemoryIcon />}
                  label={t('plannedEstate.ramCapPlanned')}
                  value={fmtMemMb(pCapR, loc)}
                  accent="primary"
                />
                <StatTile
                  icon={<PackageIcon />}
                  label={t('plannedEstate.ramDemand')}
                  value={fmtMemMb(allocR, loc)}
                  accent="gold"
                />
              </div>
              <Chart
                option={plannedHeadroomBarOption(mCapV, pCapV, allocV, {
                  measured: t('plannedEstate.catMeasured'),
                  planned: t('plannedEstate.catPlanned'),
                  capacity: t('plannedEstate.seriesCapacity'),
                  demand: t('plannedEstate.vcpuDemand'),
                  axisCores: t('plannedEstate.axisCores'),
                  ariaTitle: t('plannedEstate.headroomTitle'),
                })}
                ariaLabel={t('plannedEstate.headroomTitle')}
                style={{ height: 260 }}
              />

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
          )
        })()
      )}
    </section>
  )
}
