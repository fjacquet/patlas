import type { ReactNode } from 'react'

export interface TileSectionProps {
  /** Optional uppercase group header (rendered as <h3>). */
  title?: string
  /** Tailwind grid-cols utility chain for the tile grid. */
  cols?: string
  children: ReactNode
}

/**
 * Groups `StatTile`s under an optional uppercase header — the v2.0 dashboard
 * structure (UIX-01), matching the vsizer reference's grouped sections.
 * Header is an <h3> (level 2 is reserved for the existing dashboard section
 * titles asserted by the smoke test).
 */
export function TileSection({
  title,
  cols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  children,
}: TileSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      {title ? (
        <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          {title}
        </h3>
      ) : null}
      <div className={`grid gap-3 ${cols}`}>{children}</div>
    </section>
  )
}
