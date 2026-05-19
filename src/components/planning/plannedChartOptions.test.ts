import { describe, expect, it } from 'vitest'
import { plannedHeadroomBarOption } from './plannedChartOptions'

const LABELS = {
  measured: 'Measured',
  planned: 'Planned',
  capacity: 'Capacity',
  demand: 'Allocated',
  axisCores: 'Cores',
  ariaTitle: 'vCPU headroom',
}

type BarSeries = {
  type: string
  data: Array<{ value: number }>
  markLine: { data: Array<{ yAxis: number }> }
}

const firstSeries = (n: number): BarSeries => {
  const opt = plannedHeadroomBarOption(1000, n, 1800, LABELS)
  const series = opt.series as BarSeries[]
  const first = series[0]
  if (!first) throw new Error('expected one bar series')
  return first
}

describe('plannedHeadroomBarOption (PLN-01)', () => {
  it('plots measured vs planned capacity with the allocated demand markLine', () => {
    const s = firstSeries(2500)
    expect(s.type).toBe('bar')
    expect(s.data.map((d) => d.value)).toEqual([1000, 2500])
    expect(s.markLine.data[0]?.yAxis).toBe(1800)
    expect(plannedHeadroomBarOption(1000, 2500, 1800, LABELS).aria).toMatchObject({
      enabled: true,
    })
  })

  it('reflects a changed planned ratio (different planned bar height)', () => {
    expect(firstSeries(2000).data[1]?.value).not.toBe(firstSeries(4000).data[1]?.value)
  })
})
