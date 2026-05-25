import { describe, expect, it } from 'vitest'
import { VmUsageRowSchema } from './schemas'

describe('VmUsageRowSchema', () => {
  it('accepts a full row and brands the units', () => {
    const r = VmUsageRowSchema.parse({
      vmName: 'web01',
      cluster: 'C1',
      vmBiosUuid: 'b',
      vmInstanceUuid: 'i',
      activeMib: 1024,
      consumedMib: 2048,
      balloonedMib: 0,
      swappedMib: 0,
      cpuUsageMhz: 300,
    })
    expect(r.activeMib).toBe(1024)
    expect(r.cpuUsageMhz).toBe(300)
  })

  it('accepts null metrics (not-derivable) without coercing to 0', () => {
    const r = VmUsageRowSchema.parse({
      vmName: 'web01',
      cluster: 'C1',
      vmBiosUuid: '',
      vmInstanceUuid: '',
      activeMib: null,
      consumedMib: null,
      balloonedMib: null,
      swappedMib: null,
      cpuUsageMhz: null,
    })
    expect(r.activeMib).toBeNull()
    expect(r.cpuUsageMhz).toBeNull()
  })

  it('rejects a negative metric', () => {
    const res = VmUsageRowSchema.safeParse({
      vmName: 'x',
      cluster: 'C1',
      vmBiosUuid: '',
      vmInstanceUuid: '',
      activeMib: -1,
      consumedMib: null,
      balloonedMib: null,
      swappedMib: null,
      cpuUsageMhz: null,
    })
    expect(res.success).toBe(false)
  })
})
