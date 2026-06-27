import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { topologyTreeOption } from '@/engines/export/charts/topologyOption'
import { svgToDataUri } from '@/engines/export/svgDataUri'
import { useEstateView } from '@/hooks/useEstateView'
import { selectActiveSnapshot, useSnapshotStore } from '@/store/snapshotStore'
import { Chart } from '../Chart'
import { nodeNetworkColumns, vmNicColumns } from '../inventory/columns/networkColumns'
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
 * P5 Proxmox network view. Proxmox-native sections (replaces VMware network
 * model):
 *   1. Network topology diagram (when the zip bundle included the SVG)
 *   2. Node interfaces table (NodeNetworkStats per-node — nics/bonds/bridges/vlans)
 *   3. VM NICs table (guest NIC attachments from "VM Networks" sheet)
 *
 * When the workbook carries no network sheets all arrays are empty (the
 * trimmed 8-sheet export) — render ONE factual caption line, no error
 * styling, no icon, no crash (D-11 factual-degrade).
 */
export function NetworkView() {
  const { t } = useTranslation('network')
  const { t: tInv } = useTranslation('inventory')
  const view = useEstateView('active')
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  const n = view.network
  const topology = view.topology
  const topoLabels = {
    estate: t('topology.estate'),
    nodesWord: t('topology.nodesWord'),
    unconfigured: t('topology.unconfigured'),
    vms: t('topology.vms'),
    ofNodes: t('topology.ofNodes'),
  }

  if (!snapshot) {
    return (
      <main className="flex-1 p-8">
        <section className="panel">
          <p className="text-[12px] text-slate-500 dark:text-slate-400">{t('empty.unavailable')}</p>
        </section>
      </main>
    )
  }

  const svg = snapshot.networkSvg ?? null

  const empty = n.byNode.length === 0 && n.vmNicCount === 0

  if (empty && !svg) {
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
          {topology.hasData && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
                {t('topology.heading')}
              </h2>
              {(() => {
                const { option, height } = topologyTreeOption(topology, topoLabels)
                return <Chart option={option} style={{ height }} />
              })()}
            </section>
          )}
          {svg && (
            <details className="flex flex-col gap-2">
              <summary className="cursor-pointer text-xl font-semibold text-slate-700 dark:text-slate-200">
                {t('section.diagram')}
              </summary>
              <div
                className="overflow-auto rounded border border-slate-200 dark:border-slate-700"
                style={{ maxHeight: '70vh' }}
              >
                <img src={svgToDataUri(svg)} alt={t('img.alt')} className="max-w-full" />
              </div>
            </details>
          )}
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('section.interfaces')}
            </h2>
            <DataTable
              data={n.byNode}
              columns={nodeNetworkColumns}
              headerFor={headerFor}
              objectKind="esx"
            />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('section.vmNics')}
            </h2>
            <DataTable
              data={snapshot.vmNics}
              columns={vmNicColumns}
              headerFor={headerFor}
              objectKind="vm"
            />
          </section>
        </div>
      </ErrorBoundary>
    </main>
  )
}
