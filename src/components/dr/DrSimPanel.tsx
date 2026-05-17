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
}

const MODES: readonly DrMode[] = ['server', 'site']

/** Active set + replace-never-mutate toggler for the current mode. */
const toggleIn = (set: Set<string>, value: string): Set<string> => {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
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
 * DRX-02..05 — DR what-if panel. Pure presenter: every number comes from
 * `view.drSim` (computed in the single `useEstateView` memo). The
 * two-mode (Server / Site) selector reuses the `<fieldset role="group">`
 * + aria-pressed + Arrow-key idiom verbatim. Marking a component failed
 * is a REVERSIBLE what-if input — neutral grey strike/dim + "simulated
 * failed" chip, NO red, NO alarm icon, NO confirmation dialog (locked
 * constraint: unchecking restores immediately). Physical-removed
 * (GHz/cores + MiB) is the single gold accent figure (D-09). Verdicts
 * are factual enum words, never colored. The high/med/low confidence
 * grade is RETIRED (D-10); assumptions + caveats disclose what is NOT
 * modeled (the project's #1 risk mitigation). NOTE: the dedicated
 * Server-loss stepper / Site "lost — no DR target" line / "apply
 * planned ratios" affordance + the Planning view shell land in Plans
 * 02/03 — this 06-01 edit is the minimal spine-compat rework.
 */
export function DrSimPanel({ view, drMode, onDrMode, scenario, onScenario }: DrSimPanelProps) {
  const { t } = useTranslation('dr')
  const { i18n } = useTranslation()
  const loc = i18n.language
  const { drSim } = view

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

  // The selectable components + the active failed-set for the current
  // mode. Server loss = the estate's hosts; Site loss = the distinct
  // fault-domain values declared on hosts (D-07/D-08).
  const options: { value: string; label: string }[] =
    drMode === 'server'
      ? [...new Set(view.hosts.map((h) => h.hostName))].map((v) => ({ value: v, label: v }))
      : [
          ...new Set(
            view.hosts.map((h) => h.faultDomain).filter((fd): fd is string => Boolean(fd)),
          ),
        ].map((v) => ({ value: v, label: v }))

  const activeSet = drMode === 'server' ? scenario.failedHosts : scenario.failedSites

  const toggle = (value: string) => {
    const next = toggleIn(activeSet, value)
    onScenario({
      failedHosts: drMode === 'server' ? next : scenario.failedHosts,
      failedSites: drMode === 'site' ? next : scenario.failedSites,
    })
  }

  const summary = (g: GlobalSummary) => [
    { label: t('stat.clusters'), value: fmtInt(g.clusterCount, loc) },
    { label: t('stat.hosts'), value: fmtInt(g.hostCount, loc) },
    { label: 'VMs', value: fmtInt(g.vmCount, loc) },
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

      <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
        <legend className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-400">
          {t('fail.legend')}
        </legend>
        {options.map((o) => {
          const failed = activeSet.has(o.value)
          return (
            <label
              key={o.value}
              className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
            >
              <input
                type="checkbox"
                checked={failed}
                onChange={() => toggle(o.value)}
                className="accent-primary-600"
              />
              <span
                className={failed ? 'text-slate-400 line-through dark:text-slate-500' : undefined}
              >
                {o.label}
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
              <p className="text-sm text-slate-600 dark:text-slate-400">{t('physicalRemoved')}</p>
              <p className="font-mono text-2xl font-semibold tabular-nums text-accent-500">
                {fmtGhzValue(drSim.physicalCpuRemovedGhz as number, loc)} GHz
              </p>
              <p className="font-mono text-sm tabular-nums text-accent-500">
                {fmtInt(drSim.physicalCpuRemovedCores as number, loc)} cores ·{' '}
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
