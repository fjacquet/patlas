import { useTranslation } from 'react-i18next'
import {
  CpuIcon,
  DatabaseIcon,
  GridIcon,
  HardDriveIcon,
  LayersIcon,
  MemoryIcon,
  ServerIcon,
} from '@/components/icons'
import { StatTile } from '@/components/StatTile'
import type { AccountingMode, GlobalSummary } from '@/types/estate'
import { fmtInt, fmtMemMb } from '@/utils/format'

export interface GlobalSummaryCardProps {
  globals: GlobalSummary
  mode: AccountingMode
  /** Already-localized capture date string (formatted by the caller). */
  capturedDate: string
}

/** Maps the accounting union member to its i18n key segment. */
const MODE_KEY: Record<AccountingMode, string> = {
  configured: 'configured',
  active: 'active',
  'storage-realistic': 'storageRealistic',
}

/**
 * DSH-02 — full-width estate stat block, v2.0 KPI-tile redesign (UIX-01).
 * Presentational: consumes `EstateView.globals` as plain props (no memo
 * hooks, no engine/store imports). Section keeps `aria-label` =
 * `sections.summary` (the dashboard smoke test reads it via getByLabelText).
 * Each tile keeps label/value as adjacent siblings (StatTile contract).
 */
export function GlobalSummaryCard({ globals, mode, capturedDate }: GlobalSummaryCardProps) {
  const { t, i18n } = useTranslation('dashboard')
  const loc = i18n.language

  const tiles: ReadonlyArray<{ label: string; value: string; icon: React.ReactNode }> = [
    { label: t('stats.clusters'), value: fmtInt(globals.clusterCount, loc), icon: <LayersIcon /> },
    { label: t('stats.esx'), value: fmtInt(globals.hostCount, loc), icon: <ServerIcon /> },
    { label: t('stats.vms'), value: fmtInt(globals.vmCount, loc), icon: <GridIcon /> },
    {
      label: t('stats.datastores'),
      value: fmtInt(globals.datastoreCount, loc),
      icon: <DatabaseIcon />,
    },
    {
      label: t('stats.vcpu'),
      value: fmtInt(globals.vcpuAllocated as number, loc),
      icon: <CpuIcon />,
    },
    {
      label: t('stats.vram'),
      value: fmtMemMb(globals.vramAllocatedMib as number, loc),
      icon: <MemoryIcon />,
    },
    {
      label: t('stats.storage'),
      value: fmtMemMb(globals.totalStorageMib as number, loc),
      icon: <HardDriveIcon />,
    },
  ]

  const modeLabel = t(`accountingMode.${MODE_KEY[mode]}`)

  return (
    <section className="panel" aria-label={t('sections.summary')}>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        <span>{t('accountingMode.echo', { mode: modeLabel })}</span>
        {' · '}
        <span>{t('capturedAt', { date: capturedDate })}</span>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {tiles.map((tile) => (
          <StatTile
            key={tile.label}
            icon={tile.icon}
            label={tile.label}
            value={tile.value}
            accent="primary"
          />
        ))}
      </div>
    </section>
  )
}
