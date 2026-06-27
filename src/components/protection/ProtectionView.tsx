import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { useEstateView } from '@/hooks/useEstateView'
import { selectActiveSnapshot, useSnapshotStore } from '@/store/snapshotStore'

function ViewError({ error }: FallbackProps) {
  const { t } = useTranslation('dashboard')
  const message = error instanceof Error ? error.message : 'unknown error'
  return (
    <div
      role="alert"
      className="rounded-lg border border-util-high/40 bg-white p-6 dark:bg-surface-800"
    >
      <p className="text-sm text-slate-700 dark:text-slate-300">{t('states.error', { message })}</p>
    </div>
  )
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-mono text-2xl tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </span>
    </div>
  )
}

export function ProtectionView() {
  const { t } = useTranslation('protection')
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  const view = useEstateView('active')
  const { fsFillRisk, diskHygiene, backupCoverage } = view

  if (!snapshot) {
    return (
      <main className="flex-1 p-8">
        <section className="panel">
          <h2 className="mb-2 text-xl font-semibold text-slate-700 dark:text-slate-200">
            {t('heading')}
          </h2>
          <strong className="block text-slate-700 dark:text-slate-200">{t('empty.heading')}</strong>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('empty.body')}</p>
        </section>
      </main>
    )
  }

  const pct = (v: number | null) => (v === null ? t('na') : `${v.toFixed(1)} %`)
  const num = (v: number) => String(v)
  const gb = (v: number) => v.toFixed(2)

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={ViewError}>
        <div className="flex flex-col gap-6">
          {/* Header */}
          <section className="panel">
            <h2 className="mb-1 text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('heading')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
          </section>

          {/* Filesystem fill */}
          <section className="panel">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('fsFill.heading')}
            </h3>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              {t('fsFill.subtitle')}
            </p>
            <div className="mb-4 flex flex-wrap items-end gap-8">
              <KpiTile
                label={t('fsFill.kpi.overThreshold')}
                value={num(fsFillRisk.overThresholdCount)}
              />
              <KpiTile label={t('fsFill.kpi.totalMounts')} value={num(fsFillRisk.totalMounts)} />
              <KpiTile label={t('fsFill.kpi.totalVms')} value={num(fsFillRisk.totalVms)} />
              <KpiTile label={t('fsFill.kpi.threshold')} value={pct(fsFillRisk.threshold * 100)} />
            </div>
            {fsFillRisk.overThresholdCount === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('fsFill.none')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-surface-700 dark:text-slate-400">
                      <th className="pb-2 pr-4">{t('fsFill.col.node')}</th>
                      <th className="pb-2 pr-4">{t('fsFill.col.vmName')}</th>
                      <th className="pb-2 pr-4">{t('fsFill.col.mountPoint')}</th>
                      <th className="pb-2 pr-4">{t('fsFill.col.fsType')}</th>
                      <th className="pb-2 pr-4 text-right">{t('fsFill.col.totalGb')}</th>
                      <th className="pb-2 pr-4 text-right">{t('fsFill.col.usedGb')}</th>
                      <th className="pb-2 text-right">{t('fsFill.col.usedPct')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fsFillRisk.overThreshold.map((r) => (
                      <tr
                        key={`fs-${r.node}-${r.vmId}-${r.mountPoint}`}
                        className="border-b border-slate-100 text-slate-700 dark:border-surface-700 dark:text-slate-300"
                      >
                        <td className="py-1.5 pr-4">{r.node}</td>
                        <td className="py-1.5 pr-4">{r.vmName}</td>
                        <td className="py-1.5 pr-4 font-mono text-xs">{r.mountPoint}</td>
                        <td className="py-1.5 pr-4">{r.fsType}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{gb(r.totalGb)}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{gb(r.usedGb)}</td>
                        <td className="py-1.5 text-right tabular-nums">{pct(r.usedPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Disk hygiene */}
          <section className="panel">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('diskHygiene.heading')}
            </h3>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              {t('diskHygiene.subtitle')}
            </p>
            <div className="mb-4 flex flex-wrap items-end gap-8">
              <KpiTile
                label={t('diskHygiene.kpi.unusedCount')}
                value={num(diskHygiene.unusedCount)}
              />
              <KpiTile
                label={t('diskHygiene.kpi.reclaimableGb')}
                value={gb(diskHygiene.reclaimableGb)}
              />
              <KpiTile
                label={t('diskHygiene.kpi.strayIsoCount')}
                value={num(diskHygiene.strayIsoCount)}
              />
              <KpiTile
                label={t('diskHygiene.kpi.noBackupCount')}
                value={num(diskHygiene.noBackupCount)}
              />
              <KpiTile
                label={t('diskHygiene.kpi.riskyCacheCount')}
                value={num(diskHygiene.riskyCacheCount)}
              />
            </div>

            {/* Orphaned disks */}
            <h4 className="mb-2 mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('diskHygiene.unused.heading')}
            </h4>
            {diskHygiene.unusedCount === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('diskHygiene.unused.none')}
              </p>
            ) : (
              <DiskTable
                rows={diskHygiene.unusedDisks.map((r) => ({
                  node: r.node,
                  vmName: r.vmName,
                  vmId: r.vmId,
                  id: r.id,
                  storage: r.storage,
                  fileName: r.fileName,
                  sizeGb: r.sizeGb,
                }))}
                t={t}
              />
            )}

            {/* Stray ISOs */}
            <h4 className="mb-2 mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('diskHygiene.strayIso.heading')}
            </h4>
            {diskHygiene.strayIsoCount === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('diskHygiene.strayIso.none')}
              </p>
            ) : (
              <DiskTable
                rows={diskHygiene.strayIsos.map((r) => ({
                  node: r.node,
                  vmName: r.vmName,
                  vmId: r.vmId,
                  id: r.id,
                  storage: r.storage,
                  fileName: r.fileName,
                  sizeGb: r.sizeGb,
                }))}
                t={t}
              />
            )}

            {/* No-backup disks */}
            <h4 className="mb-2 mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('diskHygiene.noBackup.heading')}
            </h4>
            {diskHygiene.noBackupCount === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('diskHygiene.noBackup.none')}
              </p>
            ) : (
              <DiskTable
                rows={diskHygiene.noBackupDisks.map((r) => ({
                  node: r.node,
                  vmName: r.vmName,
                  vmId: r.vmId,
                  id: r.id,
                  storage: r.storage,
                  fileName: r.fileName,
                  sizeGb: r.sizeGb,
                }))}
                t={t}
              />
            )}
          </section>

          {/* Backup coverage */}
          <section className="panel">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('backupCoverage.heading')}
            </h3>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              {t('backupCoverage.subtitle')}
            </p>
            <div className="mb-4 flex flex-wrap items-end gap-8">
              <KpiTile
                label={t('backupCoverage.kpi.total')}
                value={num(backupCoverage.vzdump.totalCount)}
              />
              <KpiTile
                label={t('backupCoverage.kpi.success')}
                value={num(backupCoverage.vzdump.successCount)}
              />
              <KpiTile
                label={t('backupCoverage.kpi.failed')}
                value={num(backupCoverage.vzdump.failedCount)}
              />
              <KpiTile
                label={t('backupCoverage.kpi.coveredVmids')}
                value={num(backupCoverage.vzdump.coveredVmids)}
              />
              <KpiTile
                label={t('backupCoverage.kpi.uncoveredCount')}
                value={num(backupCoverage.vzdump.uncoveredCount)}
              />
            </div>

            <h4 className="mb-2 mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('backupCoverage.uncovered.heading')}
            </h4>
            {backupCoverage.vzdump.uncoveredCount === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('backupCoverage.uncovered.none')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-surface-700 dark:text-slate-400">
                      <th className="pb-2 pr-4">{t('backupCoverage.col.vmName')}</th>
                      <th className="pb-2">{t('backupCoverage.col.vmId')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupCoverage.vzdump.uncoveredGuests.map((g) => (
                      <tr
                        key={`uncov-${g.vmid}`}
                        className="border-b border-slate-100 text-slate-700 dark:border-surface-700 dark:text-slate-300"
                      >
                        <td className="py-1.5 pr-4">{g.vmName}</td>
                        <td className="py-1.5 font-mono text-xs">{g.vmid}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Operational health summary */}
            <h4 className="mb-2 mt-6 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('backupCoverage.operationalHealth.heading')}
            </h4>
            <div className="mb-4 flex flex-wrap items-end gap-8">
              <KpiTile
                label={t('backupCoverage.operationalHealth.kpi.totalTasks')}
                value={num(backupCoverage.operationalHealth.totalTasks)}
              />
              <KpiTile
                label={t('backupCoverage.operationalHealth.kpi.totalOk')}
                value={num(backupCoverage.operationalHealth.totalOk)}
              />
              <KpiTile
                label={t('backupCoverage.operationalHealth.kpi.totalFailed')}
                value={num(backupCoverage.operationalHealth.totalFailed)}
              />
            </div>
            {backupCoverage.operationalHealth.taskTypes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-surface-700 dark:text-slate-400">
                      <th className="pb-2 pr-4">{t('backupCoverage.col.type')}</th>
                      <th className="pb-2 pr-4 text-right">{t('backupCoverage.col.total')}</th>
                      <th className="pb-2 pr-4 text-right">{t('backupCoverage.col.ok')}</th>
                      <th className="pb-2 text-right">{t('backupCoverage.col.failed')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupCoverage.operationalHealth.taskTypes.map((tt) => (
                      <tr
                        key={tt.type}
                        className="border-b border-slate-100 text-slate-700 dark:border-surface-700 dark:text-slate-300"
                      >
                        <td className="py-1.5 pr-4 font-mono text-xs">{tt.type}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{tt.total}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{tt.ok}</td>
                        <td className="py-1.5 text-right tabular-nums">{tt.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>
      </ErrorBoundary>
    </main>
  )
}

function DiskTable({
  rows,
  t,
}: {
  rows: {
    node: string
    vmName: string
    vmId: string
    id: string
    storage: string
    fileName: string
    sizeGb: number
  }[]
  t: (k: string) => string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-surface-700 dark:text-slate-400">
            <th className="pb-2 pr-4">{t('diskHygiene.col.node')}</th>
            <th className="pb-2 pr-4">{t('diskHygiene.col.vmName')}</th>
            <th className="pb-2 pr-4">{t('diskHygiene.col.id')}</th>
            <th className="pb-2 pr-4">{t('diskHygiene.col.storage')}</th>
            <th className="pb-2 pr-4">{t('diskHygiene.col.fileName')}</th>
            <th className="pb-2 text-right">{t('diskHygiene.col.sizeGb')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`disk-${r.node}-${r.vmId}-${r.id}`}
              className="border-b border-slate-100 text-slate-700 dark:border-surface-700 dark:text-slate-300"
            >
              <td className="py-1.5 pr-4">{r.node}</td>
              <td className="py-1.5 pr-4">{r.vmName}</td>
              <td className="py-1.5 pr-4 font-mono text-xs">{r.id}</td>
              <td className="py-1.5 pr-4">{r.storage}</td>
              <td className="py-1.5 pr-4 font-mono text-xs">{r.fileName}</td>
              <td className="py-1.5 text-right tabular-nums">{r.sizeGb.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
