import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import PptxGenJS from 'pptxgenjs'
import { describe, expect, it, vi } from 'vitest'
import { chartSvgToPng } from '../primitives/chartSvg'
import { addNetworkSlide } from './networkSlide'

const strings = {} as Record<string, string> // fallbacks exercised

// node-fs wasm bytes injected into the browser-safe raster module — same
// pattern as chartSvg.test.ts. Produces a real PNG so the slide exercises the
// PowerPoint-safe (image/png) embed path, NOT a fabricated payload.
const require = createRequire(import.meta.url)
const wasmBytes = readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm'))

const tinyPng = async (): Promise<Uint8Array> =>
  chartSvgToPng(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="#123"/></svg>',
    20,
    20,
    wasmBytes,
  )

describe('addNetworkSlide', () => {
  it('adds exactly one slide when networkPng is null', () => {
    const pptx = new PptxGenJS()
    addNetworkSlide(pptx, null, strings, 'en')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })

  it('adds exactly one slide when networkPng is provided', async () => {
    const pptx = new PptxGenJS()
    addNetworkSlide(pptx, await tinyPng(), strings, 'en')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })

  it('embeds an image/png data URI when networkPng is provided', async () => {
    const pptx = new PptxGenJS()
    const slide = {
      addImage: vi.fn(),
      addText: vi.fn(),
      addShape: vi.fn(),
    } as unknown as PptxGenJS.Slide
    const addSlideSpy = vi.spyOn(pptx, 'addSlide').mockReturnValue(slide)

    addNetworkSlide(pptx, await tinyPng(), strings, 'en')

    expect(addSlideSpy).toHaveBeenCalledOnce()
    expect(slide.addImage).toHaveBeenCalledOnce()
    const calls = (slide.addImage as ReturnType<typeof vi.fn>).mock.calls
    const call = calls[0]?.[0] as { data?: string } | undefined
    expect(call?.data?.startsWith('image/png;base64,')).toBe(true)
    expect(call?.data).not.toContain('svg+xml')

    addSlideSpy.mockRestore()
  })

  it('shows factual Proxmox note (no addImage) when networkPng is null', () => {
    const pptx = new PptxGenJS()
    const slide = {
      addImage: vi.fn(),
      addText: vi.fn(),
      addShape: vi.fn(),
    } as unknown as PptxGenJS.Slide
    const addSlideSpy = vi.spyOn(pptx, 'addSlide').mockReturnValue(slide)

    addNetworkSlide(pptx, null, strings, 'en')

    expect(addSlideSpy).toHaveBeenCalledOnce()
    expect(slide.addImage).not.toHaveBeenCalled()

    addSlideSpy.mockRestore()
  })

  it('treats a zero-length PNG as absent (note, no image)', () => {
    const pptx = new PptxGenJS()
    const slide = {
      addImage: vi.fn(),
      addText: vi.fn(),
      addShape: vi.fn(),
    } as unknown as PptxGenJS.Slide
    const addSlideSpy = vi.spyOn(pptx, 'addSlide').mockReturnValue(slide)

    addNetworkSlide(pptx, new Uint8Array(0), strings, 'en')

    expect(slide.addImage).not.toHaveBeenCalled()
    addSlideSpy.mockRestore()
  })

  it('real write: a deck with a PNG network slide serializes without throwing', async () => {
    // Exercises the REAL pptxgenjs write path (the previous SVG-data-URI bug
    // only surfaced on a real browser write — spies hid it). A PNG embed must
    // serialize to a valid OOXML container.
    const pptx = new PptxGenJS()
    pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 })
    pptx.layout = 'WIDE'
    addNetworkSlide(pptx, await tinyPng(), strings, 'en')
    const ab = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer
    const u = new Uint8Array(ab)
    expect(u[0] === 0x50 && u[1] === 0x4b).toBe(true) // PK zip magic
    expect(ab.byteLength).toBeGreaterThan(1000)
  })

  it('adds exactly one slide for a French locale with a PNG', async () => {
    const pptx = new PptxGenJS()
    addNetworkSlide(pptx, await tinyPng(), strings, 'fr')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })

  it('oversized: shows the HTML-report note and does NOT embed the raster', async () => {
    // Fix 4 (interim): the upstream SVG is extreme-portrait; rasterized into a
    // wide-short slide box it is an unreadable blur.  Do NOT embed it — show
    // the note only.  The non-oversized path still embeds (tested above).
    const pptx = new PptxGenJS()
    const slide = {
      addImage: vi.fn(),
      addText: vi.fn(),
      addShape: vi.fn(),
    } as unknown as PptxGenJS.Slide
    const addSlideSpy = vi.spyOn(pptx, 'addSlide').mockReturnValue(slide)

    const png = await tinyPng()
    addNetworkSlide(
      pptx,
      png,
      { 'network.oversizedNote': 'Full network diagram available in the HTML report.' },
      'en',
      true,
    )

    expect(addSlideSpy).toHaveBeenCalledOnce()
    // No image embed in the oversized branch.
    expect(slide.addImage).not.toHaveBeenCalled()
    // Note text is shown instead.
    const textCalls = (slide.addText as ReturnType<typeof vi.fn>).mock.calls
    const noteCall = textCalls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('HTML report'),
    )
    expect(noteCall).toBeDefined()

    addSlideSpy.mockRestore()
  })

  it('oversized: when no PNG, still shows absent note (no image)', () => {
    const pptx = new PptxGenJS()
    const slide = {
      addImage: vi.fn(),
      addText: vi.fn(),
      addShape: vi.fn(),
    } as unknown as PptxGenJS.Slide
    const addSlideSpy = vi.spyOn(pptx, 'addSlide').mockReturnValue(slide)

    addNetworkSlide(pptx, null, strings, 'en', true)

    expect(slide.addImage).not.toHaveBeenCalled()

    addSlideSpy.mockRestore()
  })
})
