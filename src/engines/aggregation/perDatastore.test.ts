import { describe, expect, it } from 'vitest'
import { mib } from '@/engines/units'
import { first } from '@/test/arrays'
import type { VDatastoreRow } from '@/types/snapshot'
import { perDatastore } from './perDatastore'

const ds = (over: Partial<VDatastoreRow>): VDatastoreRow => ({
  name: 'datastore-1',
  capacityMib: mib(1_048_576),
  freeMib: mib(524_288),
  provisionedMib: mib(786_432),
  naa: 'naa.6000',
  type: 'VMFS',
  ...over,
})

describe('perDatastore — NAA dedupe (Moderate-11 / Pitfall 5)', () => {
  it('collapses rows sharing a naa; capacity from FIRST row, never summed', () => {
    const rows = [
      ds({ name: 'view-A', naa: 'naa.shared', capacityMib: mib(1000), freeMib: mib(400) }),
      ds({ name: 'view-B', naa: 'naa.shared', capacityMib: mib(1000), freeMib: mib(400) }),
    ]
    const out = perDatastore(rows)
    expect(out).toHaveLength(1)
    const d = first(out)
    expect(d.key).toBe('naa.shared')
    expect(d.capacityMib as number).toBe(1000) // NOT 2000
    expect(d.usedMib as number).toBe(600) // 1000 - 400, not double-counted
    expect(d.sharedDuplicateCount).toBe(2) // shared LUN surfaced
  })

  it('falls back to name when naa is null', () => {
    const d = first(perDatastore([ds({ naa: null, name: 'local-ds' })]))
    expect(d.key).toBe('local-ds')
  })

  it('usedRatio and overProvisionRatio are 0 when capacity is 0', () => {
    const d = first(
      perDatastore([ds({ capacityMib: mib(0), freeMib: mib(0), provisionedMib: mib(500) })]),
    )
    expect(d.usedRatio).toBe(0)
    expect(d.overProvisionRatio).toBe(0)
  })

  it('distinct naas produce distinct aggregates', () => {
    const out = perDatastore([ds({ naa: 'naa.a' }), ds({ naa: 'naa.b' })])
    expect(out).toHaveLength(2)
  })
})
