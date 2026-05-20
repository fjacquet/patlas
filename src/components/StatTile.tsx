import type { ReactNode } from 'react'

/**
 * Semantic accent for a KPI tile's top edge. Reuses the existing Midnight
 * Executive tokens — `primary` (default brand), the `util-*` status trio
 * (low/mid/high — never a verdict, just a status hue), `gold` (the factual
 * accent marker), `neutral` (no emphasis).
 */
export type TileAccent = 'primary' | 'low' | 'mid' | 'high' | 'gold' | 'neutral'

const ACCENT: Record<TileAccent, string> = {
  primary: 'border-t-primary-500',
  low: 'border-t-util-low',
  mid: 'border-t-util-mid',
  high: 'border-t-util-high',
  gold: 'border-t-accent-500',
  neutral: 'border-t-slate-300 dark:border-t-surface-700',
}

export interface StatTileProps {
  /** Optional inline-SVG icon (currentColor) from `components/icons`. */
  icon?: ReactNode
  label: string
  value: string
  /** Optional factual sub-caption (no editorial verbs). */
  sub?: string
  accent?: TileAccent
}

/**
 * The v2.0 KPI tile (UIX-01). Card with a semantic top accent, an uppercase
 * label, a large mono value, and an optional sub-caption.
 *
 * DOM contract: icon, label, and value are FLAT sibling spans (icon first,
 * then label, then value). Consumers and the dashboard smoke test rely on
 * `getByText(label).nextElementSibling` being the value — do not nest the
 * label or value inside a wrapper.
 */
export function StatTile({ icon, label, value, sub, accent = 'neutral' }: StatTileProps) {
  return (
    <div
      className={`relative flex flex-col gap-1 rounded-lg border border-t-2 border-slate-200 bg-white p-3 dark:border-surface-700 dark:bg-surface-800 ${ACCENT[accent]}`}
    >
      {icon ? (
        <span
          className="absolute top-3 right-3 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
      <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {label}
      </span>
      <span className="font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </span>
      {sub ? <span className="text-xs text-slate-500 dark:text-slate-400">{sub}</span> : null}
    </div>
  )
}
