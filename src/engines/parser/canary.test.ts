import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mibToGib } from '@/engines/units'
import { inferRvtoolsVersion } from './captureDate'
import { parseSnapshot } from './normalizeColumns'
import { parseXlsx } from './parseXlsx'

/**
 * PAR-04 regression. Consumes the committed MiB canary fixture (Plan 03) and
 * asserts the exact hand-computed totals documented in 01-03-SUMMARY.md.
 *
 * If a contributor reintroduces a `* 1.048576` SI inflation factor anywhere
 * in the parser, `provisionedMib` becomes 107374182.4 and these assertions
 * fail. Run WITHOUT the Worker boundary — jsdom can't drive a real Worker;
 * the worker is a thin I/O shell over `parseSnapshot(parseXlsx(buf))`.
 */
const fixturePath = resolve(__dirname, '../../__fixtures__/rvtools-mib-canary.xlsx')

const loadCanary = () => {
  const buf = readFileSync(fixturePath)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  return parseXlsx(ab)
}

describe('PAR-04: MiB canary fixture', () => {
  it('parses the canary VM row with provisionedMib === 102400 (no 1.048576 inflation)', () => {
    const { snapshot } = parseSnapshot(loadCanary())
    expect(snapshot.vinfo).toHaveLength(1)
    expect(snapshot.vinfo[0]?.vmName).toBe('canary-vm-01')
    expect(snapshot.vinfo[0]?.provisionedMib).toBe(102_400)
    expect(snapshot.vinfo[0]?.inUseMib).toBe(51_200)
    // Round-trip via the units module: 102400 MiB → 100 GiB exactly.
    const pm = snapshot.vinfo[0]?.provisionedMib
    expect(pm).toBeDefined()
    if (pm !== undefined) expect(mibToGib(pm)).toBe(100)
  })

  it('carries the canary identity keys (Phase 4 multi-vCenter merge)', () => {
    const { snapshot } = parseSnapshot(loadCanary())
    expect(snapshot.vinfo[0]?.viSdkUuid).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(snapshot.viSdkUuid).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(snapshot.vinfo[0]?.vmBiosUuid).toBe('01234567-89ab-cdef-0123-456789abcdef')
    expect(snapshot.vinfo[0]?.osConfig).toBe('Red Hat Enterprise Linux 8 (64-bit)')
    expect(snapshot.vinfo[0]?.osTools).toBe('Red Hat Enterprise Linux 8.10')
  })

  it('parses the canary host row: memoryMib 65536, cores 12, speedMhz 2600', () => {
    const { snapshot } = parseSnapshot(loadCanary())
    expect(snapshot.vhost[0]?.memoryMib).toBe(65_536)
    expect(snapshot.vhost[0]?.cores).toBe(12)
    expect(snapshot.vhost[0]?.speedMhz).toBe(2600)
    expect(snapshot.vhost[0]?.sockets).toBe(2)
  })

  it('reads RVTools Version 4.4.0 from the vMetaData sheet', () => {
    expect(inferRvtoolsVersion(loadCanary())).toBe('4.4.0')
  })
})
