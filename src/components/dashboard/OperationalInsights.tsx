import { useTranslation } from 'react-i18next'
import type { OperationalInsights as OI } from '@/types/estate'
import { fmtInt, fmtPercentValue, fmtRatio } from '@/utils/format'

export interface OperationalInsightsProps {
  insights: OI
}

/**
 * RCI estate "Operational Insights" tile row (RVTools-Analyser style),
 * rendered alongside the shipped `GlobalSummaryCard`. Pure presenter off
 * `EstateView.operationalInsights` — every value calculated upstream;
 * guest data shows the em-dash sentinel when no vPartition data
 * (calc-from-real-data, never an invented 0). Factual, no editorial verbs.
 */
export function OperationalInsights({ insights: o }: OperationalInsightsProps) {
  const { t, i18n } = useTranslation('rci')
  const loc = i18n.language
  const na = t('na')

  const tiles: { label: string; value: string }[] = [
    { label: t('insights.overcommit'), value: fmtRatio(o.overcommitVcpuPerPcpu, loc) },
    { label: t('insights.avgCpu'), value: fmtPercentValue(o.avgCpuPct, loc) },
    { label: t('insights.avgMem'), value: fmtPercentValue(o.avgMemPct, loc) },
    {
      label: t('insights.powerState'),
      value: [
        t('insights.power.on', { count: o.poweredOnVms }),
        t('insights.power.off', { count: o.poweredOffVms }),
        t('insights.power.suspended', { count: o.suspendedVms }),
        t('insights.power.template', { count: o.templateVms }),
      ].join(' · '),
    },
    { label: t('insights.provisioned'), value: fmtInt(o.provisionedMib as number, loc) },
    { label: t('insights.inUse'), value: fmtInt(o.inUseMib as number, loc) },
    { label: t('insights.footprint'), value: fmtInt(o.inUseMib as number, loc) },
    {
      label: t('insights.guestData'),
      value: o.guestUsedMib === null ? na : fmtInt(o.guestUsedMib as number, loc),
    },
    { label: t('insights.totalCores'), value: fmtInt(o.totalPhysicalCores as number, loc) },
    { label: t('insights.totalMem'), value: fmtInt(o.totalHostMemoryMib as number, loc) },
  ]

  return (
    <section className="panel">
      <h2 className="mb-3 text-xl font-semibold text-slate-700 dark:text-slate-200">
        {t('insights.title')}
      </h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col">
            <span className="text-xs text-slate-500 dark:text-slate-400">{tile.label}</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {tile.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
