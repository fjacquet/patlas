import { describe, expect, it } from 'vitest'
import { gibToTib, mhzToGhz, mibToBytes, mibToGib, mibToTib } from './converters'
import { gib, mhz, mib } from './types'

describe('units converters — round trips', () => {
  it('mibToGib(mib(1024)) === gib(1)', () => {
    expect(mibToGib(mib(1024))).toBe(1)
  })
  it('mibToGib(mib(2048)) === gib(2)', () => {
    expect(mibToGib(mib(2048))).toBe(2)
  })
  it('mibToGib(mib(102400)) === gib(100) (the canary value)', () => {
    expect(mibToGib(mib(102_400))).toBe(100)
  })
  it('gibToTib(gib(1024)) === tib(1)', () => {
    expect(gibToTib(gib(1024))).toBe(1)
  })
  it('mibToTib(mib(1024*1024)) === tib(1)', () => {
    expect(mibToTib(mib(1024 * 1024))).toBe(1)
  })
  it('mibToBytes(mib(1)) === bytes(1_048_576) — proves NO SI inflation factor', () => {
    expect(mibToBytes(mib(1))).toBe(1_048_576)
  })
  it('mhzToGhz(mhz(2600)) === ghz(2.6)', () => {
    expect(mhzToGhz(mhz(2600))).toBe(2.6)
  })
  it('mhzToGhz(mhz(1000)) === ghz(1)', () => {
    expect(mhzToGhz(mhz(1000))).toBe(1)
  })
})

describe('units converters — anti-pattern guard', () => {
  it('mibToBytes does NOT introduce a fudge factor (SI MB→MiB inflation)', () => {
    // If a contributor multiplied by the SI inflation factor as well as
    // BYTES_PER_MIB, this test would catch it: 1 MiB would become ~1_099_512
    // instead of exactly 1_048_576.
    expect(mibToBytes(mib(1))).toBe(1_048_576)
    expect(mibToBytes(mib(100))).toBe(100 * 1_048_576)
  })
})

describe('units converters — ROADMAP success criterion (62.4 GHz)', () => {
  it('2 sockets * 12 cores * mhzToGhz(mhz(2600)) === 62.4 GHz total compute', () => {
    // RVTools vHost canary row: # CPU = 2 sockets, # Cores = 12, Speed = 2600 MHz.
    // Total estate compute = sockets * cores * per-core GHz = 2 * 12 * 2.6 = 62.4 GHz.
    const perCoreGhz = mhzToGhz(mhz(2600))
    const totalGhz = 2 * 12 * perCoreGhz
    expect(totalGhz).toBeCloseTo(62.4, 10)
  })
})
