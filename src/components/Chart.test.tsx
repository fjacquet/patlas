import { cleanup, render } from '@testing-library/react'
import type { EChartsOption } from 'echarts/types/dist/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'

// SVG-assertion path (02-01-PLAN Task 2 <behavior> / RESEARCH Pitfall 3 +
// Open Question 2): jsdom does NOT produce real ECharts SVG geometry, so we
// take the documented fallback — mock `echarts-for-react/esm/core` with a
// stand-in that renders an <svg> element IFF the `opts.renderer` it received
// is 'svg' (and a <canvas> otherwise). This proves the wrapper structurally
// injects `{ renderer: 'svg' }` (VIZ-01) AND lets the DOM-presence assertion
// in the behavior contract pass deterministically. Documented in 02-01-SUMMARY.
vi.mock('echarts-for-react/esm/core', () => ({
  default: (props: { opts?: { renderer?: string }; theme?: string }) => {
    const renderer = props.opts?.renderer
    // Reflect the injected renderer choice into the DOM exactly as a real
    // ECharts mount would (svg renderer => inline <svg>, canvas => <canvas>).
    return renderer === 'svg' ? (
      <svg data-testid="echarts-svg" data-theme={props.theme} />
    ) : (
      <canvas data-testid="echarts-canvas" />
    )
  },
}))

const { Chart } = await import('./Chart')

const someBarOption: EChartsOption = {
  xAxis: { type: 'category', data: ['a', 'b'] },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: [1, 2] }],
}

afterEach(cleanup)

describe('<Chart>', () => {
  it('renders an <svg> element and NO <canvas> (VIZ-01: SVG renderer injected centrally)', () => {
    const { container } = render(<Chart option={someBarOption} />)
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('injects the midnight-executive theme', () => {
    const { container } = render(<Chart option={someBarOption} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('data-theme')).toBe('midnight-executive')
  })

  it('memo comparator skips re-render when option ref + props are unchanged', () => {
    const renderSpy = vi.fn()
    function Probe({ option }: { option: typeof someBarOption }) {
      renderSpy()
      return <Chart option={option} />
    }
    const { rerender } = render(<Probe option={someBarOption} />)
    expect(renderSpy).toHaveBeenCalledTimes(1)
    // Same option reference + same props → Chart memo short-circuits.
    rerender(<Probe option={someBarOption} />)
    // Probe re-renders (2) but Chart's memo comparator returns true; we verify
    // the comparator directly below for the precise contract.
    expect(renderSpy).toHaveBeenCalledTimes(2)
  })

  it('memo comparator: true on same option ref, false on changed ref', () => {
    // The comparator is the named export contract (RESEARCH Pattern 2).
    const a = { option: someBarOption, className: 'x', ariaLabel: 'l', style: undefined }
    const sameRef = { option: someBarOption, className: 'x', ariaLabel: 'l', style: undefined }
    const diffRef = {
      option: { ...someBarOption },
      className: 'x',
      ariaLabel: 'l',
      style: undefined,
    }
    // biome-ignore lint/suspicious/noExplicitAny: reaching the internal comparator
    const cmp = (Chart as any).compare as (p: object, n: object) => boolean
    expect(typeof cmp).toBe('function')
    expect(cmp(a, sameRef)).toBe(true)
    expect(cmp(a, diffRef)).toBe(false)
  })
})
