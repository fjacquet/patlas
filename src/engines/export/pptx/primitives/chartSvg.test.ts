import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { chartToSvg } from '../../html/renderCharts'
import { addChartImage, chartSvgToPng, type ImageSink } from './chartSvg'

// node-fs wasm bytes injected into the browser-safe module (the module
// itself never imports node:* — keeps tsc -b / the app build green).
const require = createRequire(import.meta.url)
const wasmBytes = readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm'))

const isPng = (b: Uint8Array): boolean =>
  b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47

describe('chartSvgToPng — PowerPoint-safe raster', () => {
  it('rasterizes an ECharts-SSR SVG to a valid PNG (no DOM)', async () => {
    const svg = chartToSvg(
      {
        xAxis: { type: 'category', data: ['a', 'b'] },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: [3, 7] }],
      },
      480,
      240,
    )
    const png = await chartSvgToPng(svg, 480, 240, wasmBytes)
    expect(png).toBeInstanceOf(Uint8Array)
    expect(png.length).toBeGreaterThan(1000)
    expect(isPng(png)).toBe(true)
  })

  it('addChartImage emits an image/png data URI, never image/svg+xml', () => {
    const captured: { data: string }[] = []
    const slide: ImageSink = { addImage: (o) => captured.push(o) }
    addChartImage(slide, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]), {
      x: 0.5,
      y: 1.2,
      w: 6,
      h: 3.4,
    })
    expect(captured).toHaveLength(1)
    const [img] = captured
    expect(img?.data.startsWith('image/png;base64,')).toBe(true)
    expect(img?.data).not.toContain('svg+xml')
  })

  it('chartSvg.ts source never constructs an image/svg+xml payload', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/engines/export/pptx/primitives/chartSvg.ts'),
      'utf8',
    )
    expect(src.includes('svg+xml')).toBe(false)
  })
})
