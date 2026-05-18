import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EChartsOption } from 'echarts/types/dist/shared'
import { describe, expect, it } from 'vitest'
import { chartToSvg } from './renderCharts'

const barOption: EChartsOption = {
  xAxis: { type: 'category', data: ['c-a', 'c-b', 'c-c'] },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: [120, 240, 90] }],
}

const treemapOption: EChartsOption = {
  series: [
    {
      type: 'treemap',
      breadcrumb: { show: false },
      data: [
        { name: 'ds-01', value: 2200 },
        { name: 'ds-02', value: 1700 },
      ],
    },
  ],
}

describe('chartToSvg — DOM-free ECharts SSR', () => {
  it('bar option renders an inline SVG string', () => {
    const svg = chartToSvg(barOption, 640, 360)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('</svg>')
  })

  it('treemap option renders an inline SVG string carrying series data', () => {
    const svg = chartToSvg(treemapOption, 640, 360)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('ds-01')
  })

  it('many sequential renders do not throw (each instance disposed)', () => {
    for (let i = 0; i < 25; i++) {
      expect(chartToSvg(barOption, 320, 200).startsWith('<svg')).toBe(true)
    }
  })

  it('source touches no DOM global and uses no echarts barrel / dark theme', () => {
    const src = readFileSync(join(process.cwd(), 'src/engines/export/html/renderCharts.ts'), 'utf8')
    // No top-level barrel import (subpath imports like echarts/core are fine).
    const barrelImports = src
      .split('\n')
      .filter((l) => /from 'echarts'/.test(l) && !/echarts\//.test(l))
    expect(barrelImports).toHaveLength(0)
    expect(src).not.toContain('midnight-executive-dark')
    expect(src).not.toMatch(/\bdocument\./)
    expect(src).not.toMatch(/\bwindow\./)
  })
})
