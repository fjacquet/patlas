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
} from '@/components/icons'
import { StatTile, type TileAccent } from '@/components/StatTile'
import type { OperationalInsights as OI } from '@/types/estate'
import { fmtInt, fmtPercentValue, fmtRatio } from '@/utils/format'

export interface OperationalInsightsProps {
  insights: OI
}

/**
 * RCI estate "Operational Insights" — v2.0 KPI-tile redesign (UIX-01).
 * Pure presenter off `EstateView.operationalInsights`; every value calculated
 * upstream. Guest data shows the em-dash sentinel when no vPartition data
 * (calc-from-real-data, never an invented 0). Factual, no editorial verbs.
 */
export function OperationalInsights({ insights: o }: OperationalInsightsProps) {
  const { t, i18n } = useTranslation('rci')
  const loc = i18n.language
  const na = t('na')

  const tiles: {
    label: string
    value: string
    icon: React.ReactNode
    sub?: string
    accent?: TileAccent
  }[] = [
    {
      label: t('insights.overcommit'),
      value: fmtRatio(o.overcommitVcpuPerPcpu, loc),
      icon: <GaugeIcon />,
      accent: 'primary',
    },
    {
      label: t('insights.avgCpu'),
      value: fmtPercentValue(o.avgCpuPct, loc),
      icon: <ActivityIcon />,
    },
    {
      label: t('insights.avgMem'),
      value: fmtPercentValue(o.avgMemPct, loc),
      icon: <MemoryIcon />,
    },
    {
      label: t('insights.powerState'),
      value: fmtInt(o.poweredOnVms, loc),
      icon: <PowerIcon />,
      sub: [
        t('insights.power.on', { count: o.poweredOnVms }),
        t('insights.power.off', { count: o.poweredOffVms }),
        t('insights.power.suspended', { count: o.suspendedVms }),
        t('insights.power.template', { count: o.templateVms }),
      ].join(' · '),
    },
    {
      label: t('insights.provisioned'),
      value: fmtInt(o.provisionedMib as number, loc),
      icon: <PackageIcon />,
    },
    {
      label: t('insights.inUse'),
      value: fmtInt(o.inUseMib as number, loc),
      icon: <HardDriveIcon />,
    },
    {
      label: t('insights.footprint'),
      value: fmtInt(o.inUseMib as number, loc),
      icon: <HardDriveIcon />,
    },
    {
      label: t('insights.guestData'),
      value: o.guestUsedMib === null ? na : fmtInt(o.guestUsedMib as number, loc),
      icon: <FileTextIcon />,
    },
    {
      label: t('insights.totalCores'),
      value: fmtInt(o.totalPhysicalCores as number, loc),
      icon: <CpuIcon />,
    },
    {
      label: t('insights.totalMem'),
      value: fmtInt(o.totalHostMemoryMib as number, loc),
      icon: <MemoryIcon />,
    },
  ]

  return (
    <section className="panel">
      <h2 className="mb-3 text-xl font-semibold text-slate-700 dark:text-slate-200">
        {t('insights.title')}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <StatTile
            key={tile.label}
            icon={tile.icon}
            label={tile.label}
            value={tile.value}
            sub={tile.sub}
            accent={tile.accent ?? 'neutral'}
          />
        ))}
      </div>
    </section>
  )
}
