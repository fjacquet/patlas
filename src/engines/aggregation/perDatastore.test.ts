import { describe, expect, it } from 'vitest'
import { mib } from '@/engines/units'
import { first } from '@/test/arrays'
import type { VDatastoreRow } from '@/types/snapshot'
import { datastoreCountByCluster, perDatastore } from './perDatastore'

const ds = (over: Partial<VDatastoreRow>): VDatastoreRow => ({
  name: 'datastore-1',
  capacityMib: mib(1_048_576),
  freeMib: mib(524_288),
  provisionedMib: mib(786_432),
  naa: 'naa.6000',
  type: 'VMFS',
  hosts: '',
  clusterName: 'C1',
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

describe('datastoreCountByCluster — per-cluster NAA dedupe (Moderate-11)', () => {
  it('dedupes a shared LUN WITHIN each cluster (counts once per cluster)', () => {
    const map = datastoreCountByCluster([
      ds({ naa: 'naa.shared', clusterName: 'C1', name: 'view-a' }),
      ds({ naa: 'naa.shared', clusterName: 'C1', name: 'view-b' }),
      ds({ naa: 'naa.shared', clusterName: 'C2', name: 'view-c' }),
      ds({ naa: 'naa.local', clusterName: 'C1', name: 'local-1' }),
    ])
    // C1: {naa.shared, naa.local} = 2 (shared counted once, not twice).
    expect(map.get('C1')).toBe(2)
    // C2 sees the same shared LUN — it counts once there too (Moderate-11).
    expect(map.get('C2')).toBe(1)
  })

  it('does NOT attribute an empty-clusterName datastore to any cluster', () => {
    const map = datastoreCountByCluster([
      ds({ naa: 'naa.a', clusterName: '' }),
      ds({ naa: 'naa.b', clusterName: 'C1' }),
    ])
    expect(map.has('')).toBe(false)
    expect(map.get('C1')).toBe(1)
    expect([...map.keys()]).toEqual(['C1'])
  })

  it('falls back to name for the dedupe key when naa is null', () => {
    const map = datastoreCountByCluster([
      ds({ naa: null, name: 'local-ds', clusterName: 'C1' }),
      ds({ naa: null, name: 'local-ds', clusterName: 'C1' }),
    ])
    expect(map.get('C1')).toBe(1)
  })

  // ── Pitfall 6: blank-clusterName Hosts→cluster attribution (04-02) ─────
  it('attributes a blank-clusterName datastore via its Hosts list', () => {
    const hostClusterMap = new Map([
      ['esx-1', 'C1'],
      ['esx-2', 'C1'],
    ])
    const map = datastoreCountByCluster(
      [ds({ naa: 'vsan.1', clusterName: '', hosts: 'esx-1, esx-2' })],
      hostClusterMap,
    )
    expect(map.get('C1')).toBe(1)
  })

  it('a shared blank-clusterName LUN across two clusters counts once per cluster', () => {
    const hostClusterMap = new Map([
      ['esx-a', 'C1'],
      ['esx-b', 'C2'],
    ])
    const map = datastoreCountByCluster(
      [ds({ naa: 'vsan.shared', clusterName: '', hosts: 'esx-a\nesx-b' })],
      hostClusterMap,
    )
    expect(map.get('C1')).toBe(1)
    expect(map.get('C2')).toBe(1)
  })

  it('non-blank clusterName still wins even when Hosts is populated (regression)', () => {
    const hostClusterMap = new Map([['esx-9', 'OTHER']])
    const map = datastoreCountByCluster(
      [ds({ naa: 'naa.x', clusterName: 'C1', hosts: 'esx-9' })],
      hostClusterMap,
    )
    expect(map.get('C1')).toBe(1)
    expect(map.has('OTHER')).toBe(false)
  })

  it('blank-clusterName datastore whose hosts match no known cluster is not fabricated', () => {
    const map = datastoreCountByCluster(
      [ds({ naa: 'orphan', clusterName: '', hosts: 'ghost-host' })],
      new Map([['esx-1', 'C1']]),
    )
    expect([...map.keys()]).toEqual([])
  })
})
