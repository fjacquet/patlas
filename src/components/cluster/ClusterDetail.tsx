import { useTranslation } from 'react-i18next'
import type { ClusterDetail as Detail } from '@/types/estate'
import { fmtGhzValue, fmtInt, fmtPercentValue, fmtPercentWhole, fmtRatio } from '@/utils/format'

export interface ClusterDetailProps {
  detail: Detail
  onBack: () => void
}

/**
 * RCI per-cluster drill screen. Reached by clicking a dashboard cluster
 * card (the entry point). ONE-SCREEN-FIT by construction: a fixed grid,
 * NO internal scroll, sized for a 16:9 area so Phase 10 can snapshot it
 * as exactly one PPTX slide per cluster (P5 makes it export-ready; P5
 * does NOT generate the deck). Pure presenter off `EstateView.clusterDetail`
 * — every value calculated upstream; factual, no verdict, em-dash when a
 * value is genuinely not derivable. `dark:` twin on every color.
 */
export function ClusterDetail({ detail, onBack }: ClusterDetailProps) {
  const { t, i18n } = useTranslation('rci')
  const { t: tStr } = useTranslation('str')
  const loc = i18n.language
  const { aggregate: a, insights: o } = detail
  const na = t('na')
  const siteGhz = (v: number | null) => (v === null ? na : fmtGhzValue(v, loc))

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 dark:border-surface-800">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </span>
    </div>
  )

  return (
    <main className="flex-1 overflow-hidden p-8">
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="break-words text-2xl font-semibold text-slate-700 dark:text-slate-200">
            {a.cluster}
          </h2>
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded px-3 py-1 text-sm font-semibold text-primary-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400 dark:hover:bg-surface-800"
          >
            ← {t('detail.back')}
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-x-10 gap-y-0 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <Row label={t('hosts.col.host')} value={fmtInt(a.hostCount, loc)} />
            <Row label="VMs" value={fmtInt(a.vmCount, loc)} />
            <Row label={t('insights.totalCores')} value={fmtInt(a.physicalCores as number, loc)} />
            <Row label="GHz" value={fmtGhzValue(a.physicalGhz as number, loc)} />
            <Row label={t('insights.totalMem')} value={fmtInt(a.physicalRamMib as number, loc)} />
          </div>
          <div>
            <Row label={t('insights.overcommit')} value={fmtRatio(o.overcommitVcpuPerPcpu, loc)} />
            <Row label={t('insights.avgCpu')} value={fmtPercentValue(o.avgCpuPct, loc)} />
            <Row label={t('insights.avgMem')} value={fmtPercentValue(o.avgMemPct, loc)} />
            <Row
              label={t('insights.provisioned')}
              value={fmtInt(o.provisionedMib as number, loc)}
            />
            <Row label={t('insights.inUse')} value={fmtInt(o.inUseMib as number, loc)} />
            <Row
              label={t('insights.guestData')}
              value={o.guestUsedMib === null ? na : fmtInt(o.guestUsedMib as number, loc)}
            />
          </div>
          <div>
            <Row label={t('insights.power.on', { count: o.poweredOnVms })} value="" />
            <Row label={t('insights.power.off', { count: o.poweredOffVms })} value="" />
            <Row label={t('insights.power.suspended', { count: o.suspendedVms })} value="" />
            <Row label={t('insights.power.template', { count: o.templateVms })} value="" />
            {a.stretched && (
              <>
                <Row label={tStr('site.a')} value={siteGhz(a.siteACapacityGhz as number | null)} />
                <Row label={tStr('site.b')} value={siteGhz(a.siteBCapacityGhz as number | null)} />
                <Row label={tStr('reservation')} value={fmtPercentWhole(a.reservedFraction, loc)} />
                <p className="pt-1 text-xs text-slate-600 dark:text-slate-400">
                  {tStr(`siteData.${a.siteData}`)}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
