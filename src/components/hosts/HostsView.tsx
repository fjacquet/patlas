import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEstateView } from '@/hooks/useEstateView'
import type { EsxAggregate } from '@/types/estate'
import { fmtInt, fmtPercentValue } from '@/utils/format'
import { EsxDetail } from './EsxDetail'

/** Group hosts by cluster, preserving the engine's stable order. */
const byCluster = (hosts: EsxAggregate[]): Map<string, EsxAggregate[]> => {
  const m = new Map<string, EsxAggregate[]>()
  for (const h of hosts) {
    const list = m.get(h.cluster) ?? []
    list.push(h)
    m.set(h.cluster, list)
  }
  return m
}

/**
 * RCI / RVTools-Analyser #7 — "all ESX in one window". Estate host-rollup
 * on top, expandable per-cluster host lists below (globally AND
 * per-cluster). Thin `useEstateView` consumer (the project's single memo);
 * all values calculated upstream — model/vendor/ESXi are plain factual
 * text (em-dash when absent), NEVER a lifecycle verdict (Phase 7 owns
 * ESXi support-state). Every color utility carries its `dark:` twin.
 */
export function HostsView() {
  const { t, i18n } = useTranslation('rci')
  const loc = i18n.language
  const view = useEstateView('active')
  const oi = view.operationalInsights
  const grouped = byCluster(view.hosts)
  const na = t('na')
  // P9 LC-4: ESX storage+network drill — lifted in-Hosts view-state (the
  // GlobalDashboard cluster-drill precedent). NOT a router, NOT a 2nd memo,
  // NOT App.tsx state, NOT a duplicate of the P5 cluster-detail drill.
  const [drilledHost, setDrilledHost] = useState<string | null>(null)

  const txt = (s: string) => (s === '' ? na : s)

  const host = drilledHost ? view.hosts.find((x) => x.hostName === drilledHost) : undefined
  if (host) {
    return (
      <EsxDetail
        detail={{
          host,
          vswitches: view.network.vswitches.filter((s) => s.host === host.hostName),
          dvswitches: view.network.dvswitches.filter((dv) =>
            dv.hostMembers.includes(host.hostName),
          ),
        }}
        onBack={() => setDrilledHost(null)}
      />
    )
  }

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="flex flex-col gap-6">
        <section className="panel">
          <h2 className="mb-3 text-xl font-semibold text-slate-700 dark:text-slate-200">
            {t('hosts.rollup.title')}
          </h2>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <Stat label={t('hosts.rollup.hosts')} value={fmtInt(view.hosts.length, loc)} />
            <Stat
              label={t('hosts.rollup.cores')}
              value={fmtInt(oi.totalPhysicalCores as number, loc)}
            />
            <Stat
              label={t('hosts.rollup.memMib')}
              value={fmtInt(oi.totalHostMemoryMib as number, loc)}
            />
            <Stat label={t('hosts.rollup.avgCpu')} value={fmtPercentValue(oi.avgCpuPct, loc)} />
            <Stat label={t('hosts.rollup.avgMem')} value={fmtPercentValue(oi.avgMemPct, loc)} />
            <Stat label={t('hosts.rollup.poweredOnVms')} value={fmtInt(oi.poweredOnVms, loc)} />
          </div>
        </section>

        {[...grouped.entries()].map(([cluster, hosts]) => (
          <details key={cluster} className="panel" open>
            <summary className="cursor-pointer text-base font-semibold text-slate-700 dark:text-slate-200">
              {cluster} ({fmtInt(hosts.length, loc)})
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-1 pr-4">{t('hosts.col.host')}</th>
                    <th className="py-1 pr-4">{t('hosts.col.cores')}</th>
                    <th className="py-1 pr-4">{t('hosts.col.memMib')}</th>
                    <th className="py-1 pr-4">{t('hosts.col.cpuPct')}</th>
                    <th className="py-1 pr-4">{t('hosts.col.ramPct')}</th>
                    <th className="py-1 pr-4">{t('hosts.col.poweredOnVms')}</th>
                    <th className="py-1 pr-4">{t('hosts.col.esxVersion')}</th>
                    <th className="py-1 pr-4">{t('hosts.col.faultDomain')}</th>
                    <th className="py-1 pr-4">{t('hosts.col.model')}</th>
                    <th className="py-1">{t('hosts.col.vendor')}</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {hosts.map((h) => (
                    <tr
                      key={h.hostName}
                      className="border-t border-slate-100 dark:border-surface-800"
                    >
                      <td className="break-all py-1 pr-4 font-sans">
                        <button
                          type="button"
                          onClick={() => setDrilledHost(h.hostName)}
                          className="text-left text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400"
                        >
                          {h.hostName}
                        </button>
                      </td>
                      <td className="py-1 pr-4">{fmtInt(h.cores as number, loc)}</td>
                      <td className="py-1 pr-4">{fmtInt(h.memoryMib as number, loc)}</td>
                      <td className="py-1 pr-4">{fmtPercentValue(h.cpuRatio * 100, loc)}</td>
                      <td className="py-1 pr-4">{fmtPercentValue(h.ramRatio * 100, loc)}</td>
                      <td className="py-1 pr-4">{fmtInt(h.poweredOnVms, loc)}</td>
                      <td className="py-1 pr-4 font-sans">{txt(h.esxVersion)}</td>
                      <td className="py-1 pr-4 font-sans">{txt(h.faultDomain)}</td>
                      <td className="py-1 pr-4 font-sans">{txt(h.model)}</td>
                      <td className="py-1 font-sans">{txt(h.vendor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </main>
  )
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <span className="flex items-baseline gap-1.5">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
      {value}
    </span>
  </span>
)
