import { useTranslation } from 'react-i18next'

export type AppView =
  | 'dashboard'
  | 'inventory'
  | 'hosts'
  | 'planning'
  | 'eos'
  | 'trends'
  | 'storage'
  | 'network'
  | 'rightsizing'
  | 'monstervm'
  | 'snapshots'
  | 'storagecontent'
  | 'clusterhealth'
  | 'protection'

const VIEWS = [
  'dashboard',
  'inventory',
  'hosts',
  'planning',
  'eos',
  'trends',
  'storage',
  'network',
  'rightsizing',
  'monstervm',
  'snapshots',
  'storagecontent',
  'clusterhealth',
  'protection',
] as const

export interface ViewToggleProps {
  value: AppView
  onChange: (view: AppView) => void
  /**
   * Layout. `horizontal` (default) is the legacy segmented strip.
   * `vertical` is the v2.0 right-side rail (Improvement 1) — full-width,
   * left-aligned items stacked top-to-bottom. The keyboard model is
   * unchanged (Arrow Up/Down already handled), so a11y is identical.
   */
  orientation?: 'horizontal' | 'vertical'
}

/**
 * Dashboard ↔ Inventory segmented control (Phase-3 navigation). Reuses the
 * Phase-1/2 `AccountingModeToggle` `<fieldset role="group"> + <legend
 * className="sr-only"> + map(button aria-pressed)` idiom VERBATIM-ish (DRY
 * — same interaction language, don't reinvent). Controlled: state is lifted
 * by the consumer (03-03 wires it into `App.tsx`); this component is
 * controlled and has no consumer at 03-01.
 *
 * Keyboard: Tab into the group, Arrow Left/Right (or Up/Down) move + activate
 * with wraparound, Space/Enter activate the focused segment (native button).
 * The active segment uses the UI-SPEC accent gold token (per UI-SPEC §Color
 * reserved list — the active *view* segment follows accent gold, NOT
 * `bg-primary-600`). Focus ring `ring-2 ring-primary-500`. Every color
 * utility carries its `dark:` twin.
 */
export function ViewToggle({ value, onChange, orientation = 'horizontal' }: ViewToggleProps) {
  const { t } = useTranslation('inventory')
  const label = t('nav.label')
  const vertical = orientation === 'vertical'

  const move = (delta: number) => {
    const idx = VIEWS.indexOf(value)
    const next = VIEWS[(idx + delta + VIEWS.length) % VIEWS.length]
    if (next) onChange(next)
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

  return (
    <fieldset
      // biome-ignore lint/a11y/noRedundantRoles: UI-SPEC §View Toggle mandates an explicit role="group" + the 03-PATTERNS CI grep gate asserts its literal presence; kept intentionally despite the implicit fieldset semantic
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={
        vertical
          ? 'flex w-full flex-col items-stretch gap-1 rounded-md border border-slate-200 bg-white p-1 text-sm dark:border-surface-700 dark:bg-surface-900'
          : 'flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-sm dark:border-surface-700 dark:bg-surface-900'
      }
    >
      <legend className="sr-only">{label}</legend>
      {VIEWS.map((view) => {
        const active = value === view
        return (
          <button
            key={view}
            type="button"
            onClick={() => onChange(view)}
            className={`flex h-10 items-center rounded font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              vertical ? 'w-full justify-start px-3' : 'px-3'
            } ${
              active
                ? 'bg-accent-500 text-surface-900 dark:bg-accent-500 dark:text-surface-900'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            aria-pressed={active}
          >
            {t(`nav.${view}`)}
          </button>
        )
      })}
    </fieldset>
  )
}
