import { useTranslation } from 'react-i18next'
import { Chart } from '@/components/Chart'
import type { TrendSeries } from '@/types/estate'
import { trendLineOption } from './trendsChartOptions'

/**
 * Trend line chart — renders through the single shipped `<Chart>` (SVG,
 * LineChart registered in plan 08-02). Real temporal axis; D-05 category
 * fallback handled inside the pure option builder. Plain prop-consumer of
 * the memoized `view.trends` — no memo, no engine import.
 */
export function TrendChart({ trends }: { trends: TrendSeries }) {
  const { t, i18n } = useTranslation('trends')
  const option = trendLineOption(
    trends,
    {
      vmCount: t('delta.vmCount'),
      poweredOnVms: t('delta.poweredOnVms'),
      tooltipDate: t('tooltip.date'),
      tooltipMeta: t('tooltip.meta'),
    },
    i18n.language,
  )
  return <Chart option={option} ariaLabel={t('heading')} />
}
