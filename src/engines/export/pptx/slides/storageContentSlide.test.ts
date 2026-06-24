import PptxGenJS from 'pptxgenjs'
import { describe, expect, it } from 'vitest'
import type { StorageContentHealth } from '@/engines/aggregation/storageContentHealth'
import { addStorageContentSlide } from './storageContentSlide'

const strings = {} as Record<string, string> // fallbacks exercised

const storage: StorageContentHealth = {
  byContent: [{ content: 'images', count: 5, totalSizeMib: 40960 }],
  byStorage: [{ storage: 'local-lvm', count: 5, totalSizeMib: 40960 }],
  backups: {
    rows: [],
    count: 0,
    guestsCovered: 0,
    totalSizeMib: 0,
    newestAgeDays: null,
    oldestAgeDays: null,
  },
  totalSizeMib: 4096,
  fileCount: 3,
}

describe('addStorageContentSlide', () => {
  it('adds exactly one slide to the deck', () => {
    const pptx = new PptxGenJS()
    addStorageContentSlide(pptx, storage, strings, 'en')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })

  it('adds exactly one slide for empty arrays', () => {
    const pptx = new PptxGenJS()
    const empty: StorageContentHealth = {
      ...storage,
      byContent: [],
      byStorage: [],
    }
    addStorageContentSlide(pptx, empty, strings, 'en')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })

  it('adds exactly one slide for a French locale', () => {
    const pptx = new PptxGenJS()
    addStorageContentSlide(pptx, storage, strings, 'fr')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })
})
