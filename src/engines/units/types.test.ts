import { describe, expect, it } from 'vitest'
import {
  bytes,
  cores,
  type GHz,
  type GiB,
  ghz,
  gib,
  type MHz,
  type MiB,
  mhz,
  mib,
  sockets,
  tib,
} from './types'

describe('units types — constructors are identity at runtime', () => {
  it('mib(n) is the same number n at runtime', () => {
    expect(mib(2048)).toBe(2048)
  })
  it('gib(n), tib(n), bytes(n), mhz(n), ghz(n), cores(n), sockets(n) are identity at runtime', () => {
    expect(gib(2)).toBe(2)
    expect(tib(1)).toBe(1)
    expect(bytes(1_048_576)).toBe(1_048_576)
    expect(mhz(2600)).toBe(2600)
    expect(ghz(2.6)).toBe(2.6)
    expect(cores(12)).toBe(12)
    expect(sockets(2)).toBe(2)
  })
})

describe('units types — compile-time brand discrimination', () => {
  it('GiB cannot be passed where MiB is expected', () => {
    const oneGib: GiB = gib(1)
    // The next line is verified by tsc, not vitest. We place it here so a
    // future erroneous suppression surfaces in `npm run typecheck`.
    // @ts-expect-error — GiB is not assignable to MiB (brand mismatch)
    const _bad: MiB = oneGib
    expect(_bad).toBeDefined() // runtime is fine — branding is compile-time only
  })

  it('raw number cannot be passed where MiB is expected', () => {
    // @ts-expect-error — number is not assignable to MiB (brand missing)
    const _bad: MiB = 1024
    expect(_bad).toBeDefined()
  })

  it('MiB cannot be passed where MHz is expected (cross-domain)', () => {
    const oneMib: MiB = mib(1)
    // @ts-expect-error — MiB is not assignable to MHz
    const _bad: MHz = oneMib
    expect(_bad).toBeDefined()
  })

  it('MHz cannot be passed where GHz is expected (same domain, different scale)', () => {
    const x: MHz = mhz(2600)
    // @ts-expect-error — MHz is not assignable to GHz (use mhzToGhz)
    const _bad: GHz = x
    expect(_bad).toBeDefined()
  })
})
