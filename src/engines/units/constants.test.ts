import { describe, expect, it } from 'vitest'
import { BYTES_PER_MIB, GIB_PER_TIB, MHZ_PER_GHZ, MIB_PER_GIB } from './constants'

describe('units constants', () => {
  it('BYTES_PER_MIB equals 1_048_576 exactly (base-2, never 1_000_000)', () => {
    expect(BYTES_PER_MIB).toBe(1_048_576)
    expect(BYTES_PER_MIB).not.toBe(1_000_000)
  })

  it('MIB_PER_GIB and GIB_PER_TIB are 1024 (base-2)', () => {
    expect(MIB_PER_GIB).toBe(1024)
    expect(GIB_PER_TIB).toBe(1024)
  })

  it('MHZ_PER_GHZ is 1000 (decimal SI, MHz/GHz are decimal)', () => {
    expect(MHZ_PER_GHZ).toBe(1000)
  })

  it('all constants carry their canonical literal values (frozen by `as const`)', () => {
    // The `as const` makes the type the literal `1_048_576`, not `number` —
    // verified at compile time. At runtime the value is the primitive itself.
    expect(BYTES_PER_MIB).toBe(1_048_576)
    expect(MIB_PER_GIB).toBe(1_024)
    expect(GIB_PER_TIB).toBe(1_024)
    expect(MHZ_PER_GHZ).toBe(1_000)
  })
})
