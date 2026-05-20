import { useTranslation } from 'react-i18next'
import {
  ActivityIcon,
  CpuIcon,
  FileTextIcon,
  GaugeIcon,
  HardDriveIcon,
  MemoryIcon,
  PackageIcon,
  PowerIcon,
  ServerIcon,
  SplitIcon,
  ZapIcon,
} from '@/components/icons'
import { StatTile } from '@/components/StatTile'
import { TileSection } from '@/components/TileSection'
import type { ClusterDetail as Detail } from '@/types/estate'
import { fmtGhzValue, fmtInt, fmtPercentValue, fmtPercentWhole, fmtRatio } from '@/utils/format'

export interface ClusterDetailProps {
  detail: Detail
  onBack: () => void
}

/**
 * RCI per-cluster drill screen — v2.0 KPI-tile redesign (UIX-02). Reached by
 * clicking a dashboard cluster card. Pure presenter off
 * `EstateView.clusterDetail` — every value calculated upstream; factual, no
 * verdict, em-dash when a value is genuinely not derivable. `dark:` twin on
 * every color. The PPTX deck is re-derived from EstateView (not a DOM
 * snapshot), so the screen scrolls instead of forcing one-screen-fit.
 */
export function ClusterDetail({ detail, onBack }: ClusterDetailProps) {
  const { t, i18n } = useTranslation('rci')
  const { t: tStr } = useTranslation('str')
  const loc = i18n.language
  const { aggregate: a, insights: o } = detail
  const na = t('na')
  const siteGhz = (v: number | null) => (v === null ? na : fmtGhzValue(v, loc))

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="flex flex-col gap-6">
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

        <TileSection title={t('detail.groups.capacity')}>
          <StatTile
            icon={<ServerIcon />}
            label={t('hosts.col.host')}
            value={fmtInt(a.hostCount, loc)}
            accent="primary"
          />
          <StatTile icon={<PackageIcon />} label="VMs" value={fmtInt(a.vmCount, loc)} />
          <StatTile
            icon={<CpuIcon />}
            label={t('insights.totalCores')}
            value={fmtInt(a.physicalCores as number, loc)}
          />
          <StatTile
            icon={<ZapIcon />}
            label="GHz"
            value={fmtGhzValue(a.physicalGhz as number, loc)}
          />
          <StatTile
            icon={<MemoryIcon />}
            label={t('insights.totalMem')}
            value={fmtInt(a.physicalRamMib as number, loc)}
          />
        </TileSection>

        <TileSection title={t('detail.groups.utilization')}>
          <StatTile
            icon={<GaugeIcon />}
            label={t('insights.overcommit')}
            value={fmtRatio(o.overcommitVcpuPerPcpu, loc)}
            accent="primary"
          />
          <StatTile
            icon={<ActivityIcon />}
            label={t('insights.avgCpu')}
            value={fmtPercentValue(o.avgCpuPct, loc)}
          />
          <StatTile
            icon={<MemoryIcon />}
            label={t('insights.avgMem')}
            value={fmtPercentValue(o.avgMemPct, loc)}
          />
          <StatTile
            icon={<PackageIcon />}
            label={t('insights.provisioned')}
            value={fmtInt(o.provisionedMib as number, loc)}
          />
          <StatTile
            icon={<HardDriveIcon />}
            label={t('insights.inUse')}
            value={fmtInt(o.inUseMib as number, loc)}
          />
          <StatTile
            icon={<FileTextIcon />}
            label={t('insights.guestData')}
            value={o.guestUsedMib === null ? na : fmtInt(o.guestUsedMib as number, loc)}
          />
        </TileSection>

        <TileSection title={t('detail.groups.powerSite')}>
          <StatTile
            icon={<PowerIcon />}
            label={t('insights.powerState')}
            value={fmtInt(o.poweredOnVms, loc)}
            sub={[
              t('insights.power.on', { count: o.poweredOnVms }),
              t('insights.power.off', { count: o.poweredOffVms }),
              t('insights.power.suspended', { count: o.suspendedVms }),
              t('insights.power.template', { count: o.templateVms }),
            ].join(' · ')}
          />
          {a.stretched && (
            <>
              <StatTile
                icon={<SplitIcon />}
                label={tStr('site.a')}
                value={siteGhz(a.siteACapacityGhz as number | null)}
                accent="gold"
              />
              <StatTile
                icon={<SplitIcon />}
                label={tStr('site.b')}
                value={siteGhz(a.siteBCapacityGhz as number | null)}
                accent="gold"
              />
              <StatTile
                icon={<GaugeIcon />}
                label={tStr('reservation')}
                value={fmtPercentWhole(a.reservedFraction, loc)}
                sub={tStr(`siteData.${a.siteData}`)}
                accent="gold"
              />
            </>
          )}
        </TileSection>
      </div>
    </main>
  )
}
