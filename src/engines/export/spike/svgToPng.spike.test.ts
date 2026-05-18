/**
 * Phase 10 Wave-0 spike test (jsdom). Proves candidate (A) @resvg/resvg-wasm
 * rasterizes ECharts SSR SVG → PNG with NO DOM, on the two visually-hardest
 * charts (treemap + heatmap). Candidate (B) OffscreenCanvas is browser-only
 * (validated by the Playwright probe); here we assert it fails CLOSED in
 * jsdom with a clear message rather than a cryptic ReferenceError.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  heatmapOption,
  isPng,
  renderChartSvg,
  svgToPngOffscreen,
  svgToPngResvg,
  treemapOption,
} from './svgToPng.spike'

const W = 800
const H = 480

describe('Phase 10 spike — ECharts SSR (DOM-free) SVG source', () => {
  it('treemap renders a non-empty SVG string with no DOM', () => {
    const svg = renderChartSvg(treemapOption(), W, H)
    expect(svg.length).toBeGreaterThan(200)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('heatmap renders a non-empty SVG string with no DOM', () => {
    const svg = renderChartSvg(heatmapOption(), W, H)
    expect(svg.length).toBeGreaterThan(200)
    expect(svg).toContain('<svg')
  })
})

describe('Phase 10 spike — candidate A: @resvg/resvg-wasm (no DOM)', () => {
  it('rasterizes the treemap SVG to a valid PNG byte array', async () => {
    const svg = renderChartSvg(treemapOption(), W, H)
    const png = await svgToPngResvg(svg, W, H)
    expect(png).toBeInstanceOf(Uint8Array)
    expect(png.length).toBeGreaterThan(1000)
    expect(isPng(png)).toBe(true) // 0x89 0x50 0x4E 0x47 …
  })

  it('rasterizes the heatmap SVG to a valid PNG byte array', async () => {
    const svg = renderChartSvg(heatmapOption(), W, H)
    const png = await svgToPngResvg(svg, W, H)
    expect(png.length).toBeGreaterThan(1000)
    expect(isPng(png)).toBe(true)
  })

  it('the resvg branch references no document/window in source (DOM-free)', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/engines/export/spike/svgToPng.spike.ts'),
      'utf8',
    )
    const resvgFn = src.slice(
      src.indexOf('export async function svgToPngResvg'),
      src.indexOf('// --- Candidate (B)'),
    )
    expect(resvgFn.length).toBeGreaterThan(0)
    expect(resvgFn).not.toMatch(/\bdocument\./)
    expect(resvgFn).not.toMatch(/\bwindow\./)
  })
})

describe('Phase 10 spike — candidate B: OffscreenCanvas (browser-only)', () => {
  it('fails closed with a clear message under jsdom (validated via Playwright instead)', async () => {
    const svg = renderChartSvg(treemapOption(), W, H)
    await expect(svgToPngOffscreen(svg, W, H)).rejects.toThrow(/OffscreenCanvas/)
  })
})
