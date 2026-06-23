import { describe, expect, it } from 'vitest'
import { cores, mib } from '@/engines/units'
import type { VDatastoreRow } from '@/types/snapshot'
import type { VInfoRow } from '@/types/vinfo'
import { relinkBlankClusterDatastores } from './vsanRelink'

const vm = (over: Partial<VInfoRow>): VInfoRow => ({
  vmName: 'vm-1',
  cluster: 'CL_1',
  host: 'esx-1',
  vcpu: cores(4),
  vramMib: mib(8192),
  cpuReadinessPercent: null,
  poweredOn: true,
  powerState: 'poweredOn',
  template: false,
  osConfig: '',
  osTools: '',
  vmBiosUuid: '',
  vmInstanceUuid: '',
  viSdkUuid: '',
  viSdkServer: '',
  guestType: 'qemu',
  provisionedMib: mib(40_960),
  inUseMib: mib(20_480),
  path: '',
  ...over,
})

const ds = (over: Partial<VDatastoreRow>): VDatastoreRow => ({
  name: 'DS_X',
  capacityMib: mib(1000),
  freeMib: mib(400),
  provisionedMib: mib(600),
  naa: null,
  type: 'vSAN',
  hosts: '3',
  clusterName: '',
  ...over,
})

describe('relinkBlankClusterDatastores — vInfo.Path attribution (D-09)', () => {
  it('attributes a blank-cluster datastore to the single referencing VM cluster', () => {
    const res = relinkBlankClusterDatastores(
      [vm({ path: '[DS_A] vm-1/vm-1.vmx', cluster: 'CL_1' })],
      [ds({ name: 'DS_A', clusterName: '' })],
    )
    expect(res.attributed.get('DS_A')).toBe('CL_1')
    expect(res.shared.size).toBe(0)
    expect(res.unrelinkable.size).toBe(0)
  })

  it('leaves a zero-reference blank-cluster datastore unrelinkable (estate-only, no fabricated cluster)', () => {
    const res = relinkBlankClusterDatastores(
      [vm({ path: '[DS_A] vm-1/vm-1.vmx', cluster: 'CL_1' })],
      [ds({ name: 'DS_B', clusterName: '' })],
    )
    expect(res.unrelinkable.has('DS_B')).toBe(true)
    expect(res.attributed.has('DS_B')).toBe(false)
  })

  it('surfaces a sharedAcross datastore (>1 cluster) excluded from single-cluster rollups (D-10)', () => {
    const res = relinkBlankClusterDatastores(
      [
        vm({ vmName: 'a', path: '[DS_C] a/a.vmx', cluster: 'CL_1' }),
        vm({ vmName: 'b', path: '[DS_C] b/b.vmx', cluster: 'CL_2' }),
      ],
      [ds({ name: 'DS_C', clusterName: '' })],
    )
    const sharedAcross = res.shared.get('DS_C')
    expect(sharedAcross).toBe(2)
    expect(res.attributed.has('DS_C')).toBe(false)
    expect(res.unrelinkable.has('DS_C')).toBe(false)
  })

  it('does not attribute datastores that already carry a Cluster name (no double-attribution)', () => {
    const res = relinkBlankClusterDatastores(
      [vm({ path: '[DS_D] vm-1/vm-1.vmx', cluster: 'CL_9' })],
      [ds({ name: 'DS_D', clusterName: 'CL_REAL' })],
    )
    expect(res.attributed.has('DS_D')).toBe(false)
    expect(res.shared.has('DS_D')).toBe(false)
    expect(res.unrelinkable.has('DS_D')).toBe(false)
  })

  it('skips an unparseable Path factually (no throw, datastore stays unrelinkable)', () => {
    const res = relinkBlankClusterDatastores(
      [vm({ path: 'no-bracket-here', cluster: 'CL_1' })],
      [ds({ name: 'DS_E', clusterName: '' })],
    )
    expect(res.unrelinkable.has('DS_E')).toBe(true)
  })

  it('uses the naa ?? name dedupe key (NAA present)', () => {
    const res = relinkBlankClusterDatastores(
      [vm({ path: '[DS_F] vm-1/vm-1.vmx', cluster: 'CL_1' })],
      [ds({ name: 'DS_F', naa: 'naa.6000', clusterName: '' })],
    )
    expect(res.attributed.get('naa.6000')).toBe('CL_1')
  })

  it('exposes datastoreVms (sorted unique VM names per datastore name) — single source', () => {
    const res = relinkBlankClusterDatastores(
      [
        vm({ vmName: 'z', path: '[DS_A] z/z.vmx', cluster: 'CL_1' }),
        vm({ vmName: 'a', path: '[DS_A] a/a.vmx', cluster: 'CL_1' }),
        vm({ vmName: 'a', path: '[DS_A] a/a.vmx', cluster: 'CL_1' }),
        vm({ vmName: 'b', path: '[DS_B] b/b.vmx', cluster: 'CL_2' }),
      ],
      [],
    )
    expect(res.datastoreVms.get('DS_A')).toEqual(['a', 'z'])
    expect(res.datastoreVms.get('DS_B')).toEqual(['b'])
  })
})
