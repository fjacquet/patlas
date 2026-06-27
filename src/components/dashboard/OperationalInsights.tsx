import { useTranslation } from 'react-i18next'
import {
  ActivityIcon,
  CpuIcon,
  GaugeIcon,
  HardDriveIcon,
  MemoryIcon,
  PowerIcon,
} from '@/components/icons'
import { StatTile, type TileAccent } from '@/components/StatTile'
import type { OperationalInsights as OI } from '@/types/estate'
import { fmtInt, fmtMemMb, fmtPercentValue, fmtRatio } from '@/utils/format'

/** Em-dash sentinel — a figure that is not derivable, never a fabricated 0. */
const NA = '—'

export interface OperationalInsightsProps {
  insights: OI
  /**
   * Estate VM-data datastore used / capacity (the `vmdata` storage-role
   * group), or `null` when no VM-data datastore exists. Sourced from the
   * Storages sheet — cv4pve leaves the per-VM `Disk Size`/`Disk Usage`
   * columns largely empty, so the estate storage headline comes from real
   * datastores, never the per-VM `provisionedMib`/`inUseMib` columns.
   */
  vmStorage: { usedMib: number; capacityMib: number } | null
}

/**
 * RCI estate "Operational Insights" — v2.0 KPI-tile redesign (UIX-01).
 * Pure presenter off `EstateView.operationalInsights`; every value calculated
 * upstream. Guest data shows the em-dash sentinel when no vPartition data
 * (calc-from-real-data, never an invented 0). Factual, no editorial verbs.
 */
export function OperationalInsights({ insights: o, vmStorage }: OperationalInsightsProps) {
  const { t, i18n } = useTranslation('rci')
  const loc = i18n.language

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
      label: t('insights.usedStorage'),
      value: vmStorage ? fmtMemMb(vmStorage.usedMib, loc) : NA,
      icon: <HardDriveIcon />,
    },
    {
      label: t('insights.vmCapacity'),
      value: vmStorage ? fmtMemMb(vmStorage.capacityMib, loc) : NA,
      icon: <HardDriveIcon />,
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
