import { describe, expect, it } from 'vitest'
import { cores, mhz } from '@/engines/units'
import { consumedGhz, physicalGhz } from './ghz'

describe('physicalGhz', () => {
  it('multiplies nominal speed by physical core count', () => {
    // 24 cores × 2.4 GHz = 57.6 GHz nominal capacity.
    expect(physicalGhz(mhz(2400), cores(24))).toBeCloseTo(57.6)
  })

  it('returns zero when either dimension is zero', () => {
    expect(physicalGhz(mhz(0), cores(24))).toBe(0)
    expect(physicalGhz(mhz(2400), cores(0))).toBe(0)
  })

  // ROADMAP success criterion #6 — the 62.4 GHz canary, branded-fixture
  // style mirroring src/engines/units/converters.test.ts:42-50.
  it('2 sockets × 12 cores × 2600 MHz composes to 62.4 GHz', () => {
    // RVTools vHost canary row: # CPU = 2 sockets, # Cores = 12,
    // Speed = 2600 MHz. Per-socket physical GHz = 12 cores × 2.6 GHz.
    const perSocketGhz = physicalGhz(mhz(2600), cores(12)) as number
    const totalGhz = 2 * perSocketGhz
    expect(totalGhz).toBeCloseTo(62.4, 10)
  })
})

describe('consumedGhz', () => {
  it('applies the cpuRatio to physical capacity', () => {
    // 57.6 GHz × 25 % = 14.4 GHz consumed.
    expect(consumedGhz(mhz(2400), cores(24), 0.25)).toBeCloseTo(14.4)
  })

  it('returns zero for an idle host', () => {
    expect(consumedGhz(mhz(2400), cores(24), 0)).toBe(0)
  })
})
