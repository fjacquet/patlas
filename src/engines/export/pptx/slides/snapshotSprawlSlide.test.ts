import PptxGenJS from 'pptxgenjs'
import { describe, expect, it } from 'vitest'
import type { SnapshotSprawl } from '@/engines/aggregation/snapshotSprawl'
import { addSnapshotSprawlSlide } from './snapshotSprawlSlide'

const strings = {} as Record<string, string> // fallbacks exercised

const sprawl: SnapshotSprawl = {
  rows: [
    {
      guestName: 'web-01',
      guestId: '100',
      guestType: 'qemu',
      node: 'pve1',
      name: 'pre-patch',
      ageDays: 42,
      sizeMib: 2048,
      includeRam: false,
    },
  ],
  count: 1,
  guestsWithSnapshots: 1,
  totalSizeMib: 2048,
  oldestAgeDays: 42,
}

describe('addSnapshotSprawlSlide', () => {
  it('adds exactly one slide to the deck', () => {
    const pptx = new PptxGenJS()
    addSnapshotSprawlSlide(pptx, sprawl, strings, 'en')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })

  it('adds exactly one slide when oldestAgeDays is null', () => {
    const pptx = new PptxGenJS()
    const noDate: SnapshotSprawl = { ...sprawl, oldestAgeDays: null }
    addSnapshotSprawlSlide(pptx, noDate, strings, 'en')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })

  it('adds exactly one slide for a French locale', () => {
    const pptx = new PptxGenJS()
    addSnapshotSprawlSlide(pptx, sprawl, strings, 'fr')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })
})
