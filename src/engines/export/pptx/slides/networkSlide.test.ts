import PptxGenJS from 'pptxgenjs'
import { describe, expect, it, vi } from 'vitest'
import { addNetworkSlide } from './networkSlide'

const strings = {} as Record<string, string> // fallbacks exercised

describe('addNetworkSlide', () => {
  it('adds exactly one slide when networkSvg is null', () => {
    const pptx = new PptxGenJS()
    addNetworkSlide(pptx, null, strings, 'en')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })

  it('adds exactly one slide when networkSvg is a non-empty string', () => {
    const pptx = new PptxGenJS()
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>'
    addNetworkSlide(pptx, svg, strings, 'en')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })

  it('embeds an image with svg+xml data URI when networkSvg is provided', () => {
    const pptx = new PptxGenJS()
    const slide = {
      addImage: vi.fn(),
      addText: vi.fn(),
      addShape: vi.fn(),
    } as unknown as PptxGenJS.Slide
    const addSlideSpy = vi.spyOn(pptx, 'addSlide').mockReturnValue(slide)

    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>'
    addNetworkSlide(pptx, svg, strings, 'en')

    expect(addSlideSpy).toHaveBeenCalledOnce()
    expect(slide.addImage).toHaveBeenCalledOnce()
    const calls = (slide.addImage as ReturnType<typeof vi.fn>).mock.calls
    const call = calls[0]?.[0] as { data?: string } | undefined
    expect(call?.data).toMatch(/^data:image\/svg\+xml;base64,/)

    addSlideSpy.mockRestore()
  })

  it('shows factual Proxmox note (no addImage) when networkSvg is null', () => {
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

  it('adds exactly one slide for a French locale with SVG', () => {
    const pptx = new PptxGenJS()
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'
    addNetworkSlide(pptx, svg, strings, 'fr')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })
})
