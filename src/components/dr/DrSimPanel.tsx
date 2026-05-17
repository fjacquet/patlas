import type React from 'react'
import { useTranslation } from 'react-i18next'
import type { DrMode, DrScenario, EstateView, GlobalSummary } from '@/types/estate'
import { fmtGhzValue, fmtInt } from '@/utils/format'

export interface DrSimPanelProps {
  view: EstateView
  drMode: DrMode
  onDrMode: (m: DrMode) => void
  scenario: DrScenario
  onScenario: (s: DrScenario) => void
  /** Declared-stretched cluster names — the Site-loss picker is over the
   *  fault-domain values of THESE clusters only (D-08). */
  declaredStretched: ReadonlySet<string>
  /** D-11 Custom Failover: when true the presenter reads
   *  `view.plannedDrSim`; when false `view.drSim`. NOT a third mode. */
  applyPlannedToDr: boolean
  onApplyPlannedToDr: (v: boolean) => void
}

const MODES: readonly DrMode[] = ['server', 'site']

/** Replace-never-mutate single-value toggler (host checkbox). */
const toggleIn = (set: Set<string>, value: string): Set<string> => {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

/** Replace-never-mutate set-replace for the per-cluster host-count stepper:
 *  drop every prior name of `cluster`, add the first `n` of `clusterHosts`. */
const replaceClusterHosts = (
  set: ReadonlySet<string>,
  clusterHosts: readonly string[],
  n: number,
): Set<string> => {
  const others = new Set([...set].filter((h) => !clusterHosts.includes(h)))
  for (const h of clusterHosts.slice(0, Math.max(0, Math.min(n, clusterHosts.length)))) {
    others.add(h)
  }
  return others
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
    <span className="font-mono text-sm tabular-nums text-slate-900 dark:text-slate-100">
      {value}
    </span>
  </div>
)

/**
 * DRX-01..06 — the two-mode DR what-if panel. Pure presenter: every result
 * number comes from `view.drSim` / `view.plannedDrSim` (computed in the
 * single `useEstateView` memo — NO second memo, NO component recompute).
 *
 * G3 / D-07/D-08/D-09/D-10/D-11:
 *  - Exactly two modes — Server loss + Site loss (no third segment).
 *  - Server loss = individual host multi-select AND a per-cluster
 *    "N of M" host-count stepper, both feeding the kept reversible/neutral
 *    failed-selection UI (grey strike + "simulated failed" chip; NO red,
 *    NO alarm icon, NO confirmation dialog — unchecking restores instantly).
 *  - Site loss = a picker over the fault-domain values of the user's
 *    declared-stretched clusters; the Site segment is ALWAYS shown, the
 *    picker is disabled with a factual note when none are declared. The
 *    non-stretched workload physically at the lost site is surfaced as an
 *    explicit factual "lost — no DR target" line.
 *  - The single gold accent figure is PHYSICAL CPU (GHz/cores) + PHYSICAL
 *    RAM (MiB) removed, never vCPU. Survivor verdict = the factual `Verdict`
 *    enum word + numbers, neutral text (no color/traffic-light).
 *  - The high/med/low scenario grade is RETIRED entirely (the tool does
 *    not grade the user's scenario — D-10); assumptions + caveats are kept
 *    as the factual "what this does / does not model" disclosure.
 *  - Custom Failover is a single in-panel checkbox switching the presented
 *    result between the measured `drSim` and the planned-ratios
 *    `plannedDrSim` — never a third DR mode, never conflated.
 */
export function DrSimPanel({
  view,
  drMode,
  onDrMode,
  scenario,
  onScenario,
  declaredStretched,
  applyPlannedToDr,
  onApplyPlannedToDr,
}: DrSimPanelProps) {
  const { t } = useTranslation('dr')
  const { i18n } = useTranslation()
  const loc = i18n.language
  const drSim = applyPlannedToDr ? view.plannedDrSim : view.drSim

  const move = (delta: number) => {
    const idx = MODES.indexOf(drMode)
    const next = MODES[(idx + delta + MODES.length) % MODES.length]
    if (next) onDrMode(next)
  }
  const onKeyDown = (e: React.KeyboardEvent<HTMLFieldSetElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    }
  }

  // Hosts grouped by cluster (Server loss host multi-select + the
  // per-cluster "N of M" stepper). Plain presenter projection of
  // `view.hosts` — same in-render derivation idiom the shipped panel
  // already used; NOT a memo.
  const hostNames = [...new Set(view.hosts.map((h) => h.hostName))]
  const clusters = [...new Set(view.hosts.map((h) => h.cluster))].map((cluster) => ({
    cluster,
    hosts: view.hosts
      .filter((h) => h.cluster === cluster)
      .map((h) => h.hostName)
      .filter((v, i, a) => a.indexOf(v) === i),
  }))

  // Site loss is over the fault-domain values of the user's
  // declared-stretched clusters ONLY (D-08).
  const stretchedSites = [
    ...new Set(
      view.hosts
        .filter((h) => declaredStretched.has(h.cluster))
        .map((h) => h.faultDomain)
        .filter((fd): fd is string => fd !== ''),
    ),
  ]
  const noStretched = stretchedSites.length === 0

  const toggleHost = (value: string) => {
    onScenario({
      failedHosts: toggleIn(scenario.failedHosts, value),
      failedSites: scenario.failedSites,
    })
  }

  const stepCluster = (clusterHosts: readonly string[], n: number) => {
    onScenario({
      failedHosts: replaceClusterHosts(scenario.failedHosts, clusterHosts, n),
      failedSites: scenario.failedSites,
    })
  }

  const pickSite = (site: string) => {
    onScenario({
      failedHosts: scenario.failedHosts,
      // Single site selection (radio semantics); reversible — picking the
      // same site again clears it (neutral, no destructive styling).
      failedSites: scenario.failedSites.has(site) ? new Set() : new Set([site]),
    })
  }

  // The explicit factual "lost — no DR target" figures: non-stretched
  // workload physically at the picked site (hosts whose cluster is NOT
  // declared stretched but which sit in the lost fault domain).
  const pickedSite = [...scenario.failedSites][0]
  const lostHosts = pickedSite
    ? view.hosts.filter((h) => h.faultDomain === pickedSite && !declaredStretched.has(h.cluster))
    : []
  const lostVms = lostHosts.reduce((a, h) => a + h.vmCount, 0)
  const lostGhz = lostHosts.reduce((a, h) => a + (h.physicalGhz as number), 0)
  const lostRamMib = lostHosts.reduce((a, h) => a + (h.memoryMib as number), 0)

  const summary = (g: GlobalSummary) => [
    { label: t('stat.clusters'), value: fmtInt(g.clusterCount, loc) },
    { label: t('stat.hosts'), value: fmtInt(g.hostCount, loc) },
    { label: t('stat.vms'), value: fmtInt(g.vmCount, loc) },
    { label: 'GHz', value: fmtGhzValue(g.availableGhz as number, loc) },
    { label: 'RAM MiB', value: fmtInt(g.availableRamMib as number, loc) },
  ]

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">{t('title')}</h2>
        <fieldset
          // biome-ignore lint/a11y/noRedundantRoles: UI-SPEC §DR mandates an explicit role="group" + the CI grep gate asserts its literal presence; kept intentionally despite the implicit fieldset semantic
          role="group"
          aria-label={t('mode.label')}
          onKeyDown={onKeyDown}
          className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-sm dark:border-surface-700 dark:bg-surface-900"
        >
          <legend className="sr-only">{t('mode.label')}</legend>
          {MODES.map((m) => {
            const active = drMode === m
            return (
              <button
                key={m}
                type="button"
                onClick={() => onDrMode(m)}
                className={`flex h-9 items-center rounded px-3 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  active
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                aria-pressed={active}
              >
                {t(`mode.${m}`)}
              </button>
            )
          })}
        </fieldset>
      </div>

      {drMode === 'server' ? (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
            <legend className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">
              {t('server.legend')}
            </legend>
            {hostNames.map((name) => {
              const failed = scenario.failedHosts.has(name)
              return (
                <label
                  key={name}
                  className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={failed}
                    onChange={() => toggleHost(name)}
                    className="accent-primary-600"
                  />
                  <span
                    className={
                      failed ? 'text-slate-400 line-through dark:text-slate-500' : undefined
                    }
                  >
                    {name}
                  </span>
                  {failed && (
                    <span className="rounded bg-surface-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-surface-700 dark:text-slate-300">
                      {t('failed.chip')}
                    </span>
                  )}
                </label>
              )
            })}
          </fieldset>

          <div className="flex flex-col gap-2">
            {clusters.map(({ cluster, hosts }) => {
              const n = hosts.filter((h) => scenario.failedHosts.has(h)).length
              return (
                <label
                  key={cluster}
                  className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <span className="font-semibold">{t('server.clusterStep', { cluster })}</span>
                  <input
                    type="number"
                    min={0}
                    max={hosts.length}
                    value={n}
                    onChange={(e) => stepCluster(hosts, Number(e.target.value))}
                    className="h-9 w-16 rounded border border-slate-200 bg-white px-2 font-mono tabular-nums dark:border-surface-700 dark:bg-surface-900"
                    aria-label={t('server.clusterStep', { cluster })}
                  />
                  <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {t('server.ofM', { n, m: hosts.length })}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            {t('site.legend')}
          </span>
          {noStretched ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('empty.noStretched')}</p>
          ) : (
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {stretchedSites.map((site) => {
                const failed = scenario.failedSites.has(site)
                return (
                  <label
                    key={site}
                    className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <input
                      type="radio"
                      name="dr-site"
                      checked={failed}
                      onChange={() => pickSite(site)}
                      className="accent-primary-600"
                    />
                    <span
                      className={
                        failed ? 'text-slate-400 line-through dark:text-slate-500' : undefined
                      }
                    >
                      {site}
                    </span>
                    {failed && (
                      <span className="rounded bg-surface-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-surface-700 dark:text-slate-300">
                        {t('failed.chip')}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}
          {pickedSite && lostHosts.length > 0 && (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {t('site.lost', {
                site: pickedSite,
                n: fmtInt(lostVms, loc),
                cpu: `${fmtGhzValue(lostGhz, loc)} GHz`,
                ram: `${fmtInt(lostRamMib, loc)} MiB`,
              })}
            </p>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={applyPlannedToDr}
          onChange={(e) => onApplyPlannedToDr(e.target.checked)}
          className="accent-primary-600"
        />
        <span className="font-semibold">{t('applyPlanned.label')}</span>
      </label>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {applyPlannedToDr ? t('applyPlanned.on') : t('applyPlanned.off')}
      </p>

      {drSim === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('empty.noSelection')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-8">
            <div className="panel min-w-[200px] flex-1">
              <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t('before')}
              </h3>
              {summary(drSim.before).map((s) => (
                <Stat key={s.label} label={s.label} value={s.value} />
              ))}
            </div>
            <div className="panel min-w-[200px] flex-1">
              <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t('after')}
              </h3>
              {summary(drSim.after).map((s) => (
                <Stat key={s.label} label={s.label} value={s.value} />
              ))}
            </div>
            <div className="min-w-[160px]">
              <p className="text-sm text-slate-600 dark:text-slate-400">{t('impact.cpuLabel')}</p>
              <p className="font-mono text-2xl font-semibold tabular-nums text-accent-500">
                {fmtGhzValue(drSim.physicalCpuRemovedGhz as number, loc)} GHz
              </p>
              <p className="font-mono text-sm tabular-nums text-accent-500">
                {fmtInt(drSim.physicalCpuRemovedCores as number, loc)} {t('impact.cores')}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {t('impact.ramLabel')}
              </p>
              <p className="font-mono text-sm tabular-nums text-accent-500">
                {fmtInt(drSim.physicalRamRemovedMib as number, loc)} MiB
              </p>
            </div>
          </div>

          <ul className="flex flex-col gap-1">
            {drSim.perSurvivor.map((p) => (
              <li
                key={p.cluster}
                className="flex items-baseline justify-between gap-2 text-sm text-slate-700 dark:text-slate-300"
              >
                <span>{p.cluster}</span>
                <span className="text-slate-600 dark:text-slate-400">
                  {t(`verdict.${p.verdict}`)}
                </span>
              </li>
            ))}
          </ul>

          {drSim.caveats.length > 0 && (
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <p className="font-semibold">{t('caveats.label')}</p>
              <ul className="ml-4 list-disc">
                {drSim.caveats.map((k) => (
                  <li key={k}>{t(k)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="panel bg-slate-50 text-xs text-slate-600 dark:bg-surface-900 dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-300">{t('assumptions.title')}</p>
        <p className="mt-1">{t('assumptions.models')}</p>
        <p className="mt-1">{t('assumptions.doesNotModel')}</p>
      </div>
    </section>
  )
}
