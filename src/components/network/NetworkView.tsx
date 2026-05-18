import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { useEstateView } from '@/hooks/useEstateView'
import { selectActiveSnapshot, useSnapshotStore } from '@/store/snapshotStore'
import {
  dvswitchColumns,
  vnetworkColumns,
  vswitchColumns,
} from '../inventory/columns/networkColumns'
import { DataTable } from '../inventory/DataTable'

function NetworkError({ error }: FallbackProps) {
  const message = error instanceof Error ? error.message : 'unknown error'
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 dark:bg-surface-800">
      <p className="text-sm text-slate-700 dark:text-slate-300">{message}</p>
    </div>
  )
}

/**
 * P9 LC-3 Network view. The single `useEstateView` consumer; three P3
 * `DataTable` sections (standard vSwitch / distributed dvSwitch / VM
 * portgroups) consuming `view.network` as plain props (no child memo).
 * When the workbook carries no network sheets the four arrays are empty
 * (the trimmed 8-sheet export) — render ONE factual caption line, no
 * error styling, no icon, no crash, no editorial verb (D-11 degrade).
 */
export function NetworkView() {
  const { t } = useTranslation('network')
  const { t: tInv } = useTranslation('inventory')
  const view = useEstateView('active')
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  const n = view.network

  if (!snapshot) {
    return (
      <main className="flex-1 p-8">
        <section className="panel">
          <p className="text-[12px] text-slate-500 dark:text-slate-400">{t('empty.unavailable')}</p>
        </section>
      </main>
    )
  }

  const empty =
    n.vswitches.length === 0 &&
    n.dvswitches.length === 0 &&
    n.portgroups.length === 0 &&
    n.vmPortgroupCount === 0

  if (empty) {
    return (
      <main className="flex-1 p-8">
        <p className="text-[12px] text-slate-500 dark:text-slate-400">{t('empty.unavailable')}</p>
      </main>
    )
  }

  const headerFor = (id: string) => tInv(`col.${id}`)

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={NetworkError}>
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('section.vswitch')}
            </h2>
            <DataTable
              data={n.vswitches}
              columns={vswitchColumns}
              headerFor={headerFor}
              objectKind="esx"
            />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('section.dvswitch')}
            </h2>
            <DataTable
              data={n.dvswitches}
              columns={dvswitchColumns}
              headerFor={headerFor}
              objectKind="esx"
            />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('section.vnetwork')}
            </h2>
            <DataTable
              data={n.portgroups}
              columns={vnetworkColumns}
              headerFor={headerFor}
              objectKind="vm"
            />
          </section>
        </div>
      </ErrorBoundary>
    </main>
  )
}
