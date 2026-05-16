import { useTranslation } from 'react-i18next'
import { Chart } from '@/components/Chart'
import type { OsBreakdown } from '@/types/estate'
import { osDonutOption } from './chartOptions'

export interface OsBreakdownDonutProps {
  osBreakdown: OsBreakdown
}

/**
 * DSH-04 — estate-level OS-family donut. Thin `.panel`-wrapped host: builds
 * the ECharts `option` in the pure `osDonutOption` selector (NOT inline, NOT
 * a component-level memo hook) and routes it through the central `<Chart>`
 * wrapper (SVG + theme injected there). Every color utility carries its
 * `dark:` twin.
 */
export function OsBreakdownDonut({ osBreakdown }: OsBreakdownDonutProps) {
  const { t } = useTranslation('dashboard')
  const title = t('sections.os')
  const option = osDonutOption(
    osBreakdown,
    {
      windows: t('os.windows'),
      linux: t('os.linux'),
      other: t('os.other'),
    },
    title,
  )

  return (
    <section className="panel">
      <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
      <Chart option={option} ariaLabel={title} style={{ height: 320 }} />
    </section>
  )
}
