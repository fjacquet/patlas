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

  it('fontBuffers render <text> labels (larger PNG than fontless)', async () => {
    // resvg-wasm ships no default font → without a font the <text> glyphs draw
    // nothing (transparent), so the PNG compresses smaller. With the bundled
    // NotoSans the glyphs render real ink → a strictly larger PNG. This proves
    // the network-diagram font path works (labels no longer vanish).
    const font = new Uint8Array(readFileSync(join(process.cwd(), 'src/assets/fonts/NotoSans.ttf')))
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120">' +
      '<rect width="400" height="120" fill="#ffffff"/>' +
      '<text x="20" y="70" font-size="40" font-family="Noto Sans" fill="#000000">' +
      'Network ABCDEF 123456</text></svg>'

    const withoutFont = await chartSvgToPng(svg, 400, 120, wasmBytes)
    const withFont = await chartSvgToPng(svg, 400, 120, wasmBytes, [font])

    expect(isPng(withoutFont)).toBe(true)
    expect(isPng(withFont)).toBe(true)
    // Rendered glyphs add detail → a larger PNG payload.
    expect(withFont.length).toBeGreaterThan(withoutFont.length)
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

  it('PPT-01: addChartImage preserves chart aspect via contain sizing', () => {
    const captured: Array<Record<string, unknown>> = []
    const slide: ImageSink = { addImage: (o) => captured.push(o) }
    addChartImage(slide, new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
      x: 0.5,
      y: 1.2,
      w: 12.33,
      h: 5.3,
    })
    expect(captured[0]?.sizing).toEqual({ type: 'contain', w: 12.33, h: 5.3 })
  })

  it('chartSvg.ts source never constructs an image/svg+xml payload', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/engines/export/pptx/primitives/chartSvg.ts'),
      'utf8',
    )
    expect(src.includes('svg+xml')).toBe(false)
  })
})
