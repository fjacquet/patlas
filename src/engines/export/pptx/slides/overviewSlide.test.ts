import PptxGenJS from 'pptxgenjs'
import { describe, expect, it, vi } from 'vitest'
import type { AvgVmSize } from '@/engines/aggregation/avgVmSize'
import { cores, ghz, mib } from '@/engines/units'
import type { GlobalSummary, OperationalInsights, OsBreakdown } from '@/types/estate'
import { addOverviewSlide, type OverviewData } from './overviewSlide'

const strings = {} as Record<string, string> // fallbacks exercised

const globals: GlobalSummary = {
  clusterCount: 2,
  hostCount: 4,
  vmCount: 40,
  physicalCores: cores(96),
  usablePhysicalCores: cores(96),
  vcpuPerPcpu: 1.5,
  physicalGhz: ghz(240),
  consumedGhz: ghz(100),
  availableGhz: ghz(140),
  physicalRamMib: mib(2_097_152),
  consumedRamMib: mib(1_048_576),
  availableRamMib: mib(1_048_576),
  meanCpuRatio: 0.4,
  meanRamRatio: 0.5,
  vcpuAllocated: cores(144),
  vramAllocatedMib: mib(1_572_864),
  mhzPerVcpu: 1600,
  vmsAboveReadinessWarning: 0,
  datastoreCount: 3,
  totalStorageMib: mib(10_485_760),
}

const insights: OperationalInsights = {
  overcommitVcpuPerPcpu: 1.5,
  avgCpuPct: 23.4,
  avgMemPct: 51.2,
  poweredOnVms: 36,
  poweredOffVms: 4,
  suspendedVms: 0,
  templateVms: 0,
  provisionedMib: mib(4_194_304),
  inUseMib: mib(2_097_152),
  totalPhysicalCores: cores(96),
  totalHostMemoryMib: mib(2_097_152),
  guestUsedMib: null,
  usedStorageMib: mib(2_097_152),
}

const osBreakdown: OsBreakdown = { windows: 10, linux: 28, other: 2 }

const avgVmSize: AvgVmSize = {
  vmCount: 40,
  vcpu: { mean: cores(6.4), median: cores(4) },
  vramMib: { mean: mib(6553.6), median: mib(4096) },
  provisionedMib: { mean: mib(104_857.6), median: mib(40_960) },
}

const data: OverviewData = {
  globals,
  insights,
  osBreakdown,
  vmStorage: { usedMib: 500_000, capacityMib: 1_000_000 },
  avgVmSize,
}

describe('addOverviewSlide', () => {
  it('adds exactly one slide and renders without throwing', () => {
    const pptx = new PptxGenJS()
    expect(() => addOverviewSlide(pptx, data, strings, 'en')).not.toThrow()
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })

  it('emits the three avg-VM-size tiles as mean / median value strings', () => {
    const pptx = new PptxGenJS()
    const slide = {
      addText: vi.fn(),
      addShape: vi.fn(),
    } as unknown as PptxGenJS.Slide
    const addSlideSpy = vi.spyOn(pptx, 'addSlide').mockReturnValue(slide)

    addOverviewSlide(pptx, data, strings, 'en')

    const texts = (slide.addText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string)
    // vCPU: mean 6.4 / median 4 (matches the reviewed mock, e.g. "6.4 / 4").
    expect(texts).toContain('6.4 / 4')
    // RAM: mean 6553.6 MiB (6.4 GiB, rounds to 6) / median 4096 MiB (4 GiB).
    expect(texts).toContain('6 GiB / 4 GiB')
    // Disk: mean 104,857.6 MiB (102.4 GiB, rounds to 102) / median 40,960 MiB (40 GiB).
    expect(texts).toContain('102 GiB / 40 GiB')

    addSlideSpy.mockRestore()
  })

  it('real write: a deck with the overview slide serializes without throwing', async () => {
    const pptx = new PptxGenJS()
    pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 })
    pptx.layout = 'WIDE'
    addOverviewSlide(pptx, data, strings, 'en')
    const ab = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer
    const u = new Uint8Array(ab)
    expect(u[0] === 0x50 && u[1] === 0x4b).toBe(true) // PK zip magic
    expect(ab.byteLength).toBeGreaterThan(1000)
  })
})
