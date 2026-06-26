import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { useEstateView } from '@/hooks/useEstateView'
import { selectActiveSnapshot, useSnapshotStore } from '@/store/snapshotStore'
import type {
  ProxmoxAccessAclRow,
  ProxmoxAccessTokenRow,
  ProxmoxAccessUserRow,
  ProxmoxIssueRow,
} from '@/types'

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

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  )
}

function SimpleTable<T extends object>({
  headers,
  rows,
  renderRow,
  getKey,
}: {
  headers: string[]
  rows: T[]
  renderRow: (row: T, i: number) => React.ReactNode
  getKey: (row: T, i: number) => string
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-surface-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-surface-800">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={getKey(row, i)}
              className="border-t border-slate-100 dark:border-surface-700 hover:bg-slate-50 dark:hover:bg-surface-700/50"
            >
              {renderRow(row, i)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const Cell = ({ children }: { children: React.ReactNode }) => (
  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{children}</td>
)

function GovernanceContent() {
  const { t } = useTranslation('governance')
  const view = useEstateView('active')
  const gov = view.governance
  const NA = t('na')

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Issues */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
          {t('issues.heading')}
        </h2>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <KpiCard label={t('issues.kpi.total')} value={gov.issues.totalCount} />
          <KpiCard label={t('issues.kpi.errors')} value={gov.issues.errorCount} />
          <KpiCard label={t('issues.kpi.warnings')} value={gov.issues.warningCount} />
        </div>
        {gov.issues.rows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('issues.none')}</p>
        ) : (
          <SimpleTable<ProxmoxIssueRow>
            headers={[
              t('issues.col.severity'),
              t('issues.col.section'),
              t('issues.col.message'),
              t('issues.col.linkKey'),
            ]}
            rows={gov.issues.rows}
            getKey={(r, i) => `${r.section}-${r.severity}-${i}`}
            renderRow={(r) => (
              <>
                <Cell>{r.severity}</Cell>
                <Cell>{r.section}</Cell>
                <Cell>{r.message}</Cell>
                <Cell>{r.linkKey || NA}</Cell>
              </>
            )}
          />
        )}
      </section>

      {/* Access posture */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
          {t('access.heading')}
        </h2>
        <div className="mb-4 grid grid-cols-3 gap-3 lg:grid-cols-6">
          <KpiCard label={t('access.kpi.users')} value={gov.access.userCount} />
          <KpiCard label={t('access.kpi.enabled')} value={gov.access.enabledUserCount} />
          <KpiCard label={t('access.kpi.tokens')} value={gov.access.tokenCount} />
          <KpiCard label={t('access.kpi.roles')} value={gov.access.roleCount} />
          <KpiCard label={t('access.kpi.acls')} value={gov.access.aclCount} />
          <KpiCard label={t('access.kpi.rootAccounts')} value={gov.access.rootCount} />
        </div>

        <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          {t('access.users.heading')}
        </h3>
        {gov.access.users.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('access.users.none')}</p>
        ) : (
          <SimpleTable<ProxmoxAccessUserRow>
            headers={[
              t('access.users.col.id'),
              t('access.users.col.enabled'),
              t('access.users.col.email'),
              t('access.users.col.groups'),
              t('access.users.col.expire'),
            ]}
            rows={gov.access.users}
            getKey={(u) => u.id}
            renderRow={(u) => (
              <>
                <Cell>{u.id}</Cell>
                <Cell>{u.enabled ? '✓' : NA}</Cell>
                <Cell>{u.email || NA}</Cell>
                <Cell>{u.groups || NA}</Cell>
                <Cell>{u.expire || NA}</Cell>
              </>
            )}
          />
        )}

        <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
          {t('access.tokens.heading')}
        </h3>
        {gov.access.tokens.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('access.tokens.none')}</p>
        ) : (
          <SimpleTable<ProxmoxAccessTokenRow>
            headers={[
              t('access.tokens.col.user'),
              t('access.tokens.col.tokenId'),
              t('access.tokens.col.privSeparated'),
              t('access.tokens.col.expire'),
            ]}
            rows={gov.access.tokens}
            getKey={(tok) => `${tok.user}!${tok.tokenId}`}
            renderRow={(tok) => (
              <>
                <Cell>{tok.user}</Cell>
                <Cell>{tok.tokenId}</Cell>
                <Cell>{tok.privSeparated ? '✓' : NA}</Cell>
                <Cell>{tok.expire || NA}</Cell>
              </>
            )}
          />
        )}

        <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
          {t('access.acls.heading')}
        </h3>
        {gov.access.acls.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('access.acls.none')}</p>
        ) : (
          <SimpleTable<ProxmoxAccessAclRow>
            headers={[
              t('access.acls.col.path'),
              t('access.acls.col.usersOrGroup'),
              t('access.acls.col.type'),
              t('access.acls.col.role'),
              t('access.acls.col.propagate'),
            ]}
            rows={gov.access.acls}
            getKey={(acl, i) => `${acl.path}-${acl.usersOrGroup}-${i}`}
            renderRow={(acl) => (
              <>
                <Cell>{acl.path}</Cell>
                <Cell>{acl.usersOrGroup}</Cell>
                <Cell>{acl.type}</Cell>
                <Cell>{acl.roleId}</Cell>
                <Cell>{acl.propagate ? '✓' : NA}</Cell>
              </>
            )}
          />
        )}
      </section>

      {/* Resource pools */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
          {t('pools.heading')}
        </h2>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <KpiCard label={t('pools.kpi.pools')} value={gov.pools.poolCount} />
          <KpiCard label={t('pools.kpi.members')} value={gov.pools.totalMembers} />
        </div>
        {gov.pools.pools.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('pools.none')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-surface-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-surface-800">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                    {t('pools.col.pool')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                    {t('pools.col.members')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                    {t('pools.col.vms')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                    {t('pools.col.storages')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {gov.pools.pools.map((p) => (
                  <tr
                    key={p.pool}
                    className="border-t border-slate-100 dark:border-surface-700 hover:bg-slate-50 dark:hover:bg-surface-700/50"
                  >
                    <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">
                      {p.pool}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {p.memberCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {p.vmCount > 0 ? p.vmCount : NA}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {p.storageCount > 0 ? p.storageCount : NA}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export function GovernanceView() {
  const { t } = useTranslation('governance')
  const hasSnapshot = useSnapshotStore(selectActiveSnapshot) !== null

  return (
    <main className="flex flex-1 flex-col overflow-auto">
      <div className="border-b border-slate-200 px-6 py-4 dark:border-surface-700">
        <h1 className="text-lg font-semibold text-slate-700 dark:text-slate-200">{t('heading')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
      </div>
      {hasSnapshot ? (
        <ErrorBoundary FallbackComponent={ViewError}>
          <GovernanceContent />
        </ErrorBoundary>
      ) : (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center">
            <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('empty.heading')}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('empty.body')}</p>
          </div>
        </div>
      )}
    </main>
  )
}
