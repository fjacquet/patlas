import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bytes, cores, mhz, mib, sockets } from '@/engines/units'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { AccountingMode } from '@/types/estate'
import type { Snapshot } from '@/types/snapshot'
import { useEstateView } from './useEstateView'

const snapshot = (id: string): Snapshot => ({
  id,
  filename: `${id}.xlsx`,
  fileSize: bytes(1024),
  capturedAt: new Date('2026-01-01'),
  vCenterLabel: 'vc',
  rvtoolsVersion: '4.4',
  parsedAt: new Date('2026-01-02'),
  source: 'rvtools',
  viSdkUuid: null,
  vMetaData: [],
  vmUsage: [],
  vhost: [
    {
      hostName: 'esx-1',
      cluster: 'C1',
      sockets: sockets(2),
      cores: cores(12),
      speedMhz: mhz(2600),
      memoryMib: mib(262_144),
      cpuRatio: 0.3,
      ramRatio: 0.5,
      faultDomain: '',
      model: '',
      vendor: '',
      serialNumber: '',
      esxVersion: '',
    },
  ],
  vinfo: [
    {
      vmName: 'vm-1',
      cluster: 'C1',
      host: 'esx-1',
      vcpu: cores(4),
      vramMib: mib(8192),
      cpuReadinessPercent: null,
      poweredOn: true,
      powerState: 'poweredOn',
      template: false,
      osConfig: 'Ubuntu Linux (64-bit)',
      osTools: '',
      vmBiosUuid: '',
      vmInstanceUuid: '',
      viSdkUuid: '',
      viSdkServer: '',
      provisionedMib: mib(40_960),
      inUseMib: mib(20_480),
      path: '',
    },
  ],
  vdatastore: [],
  vpartition: [],
  vnetwork: [],
  vswitch: [],
  dvswitch: [],
  dvport: [],
  parseErrors: [],
})

afterEach(() => {
  act(() => useSnapshotStore.getState().clearAll())
})

describe('useEstateView', () => {
  it('returns EMPTY_VIEW when no snapshot is active', () => {
    const { result } = renderHook(() => useEstateView('active'))
    expect(result.current.clusters).toEqual([])
    expect(result.current.globals.clusterCount).toBe(0)
  })

  it('returns a stable reference across re-render with unchanged (snapshot, mode)', () => {
    act(() => useSnapshotStore.getState().addSnapshot(snapshot('s1')))
    const { result, rerender } = renderHook(({ m }: { m: AccountingMode }) => useEstateView(m), {
      initialProps: { m: 'active' as AccountingMode },
    })
    const firstRef = result.current
    rerender({ m: 'active' })
    expect(result.current).toBe(firstRef)
  })

  it('produces a NEW reference when the mode flips', () => {
    act(() => useSnapshotStore.getState().addSnapshot(snapshot('s1')))
    const { result, rerender } = renderHook(({ m }: { m: AccountingMode }) => useEstateView(m), {
      initialProps: { m: 'active' as AccountingMode },
    })
    const activeRef = result.current
    rerender({ m: 'configured' })
    expect(result.current).not.toBe(activeRef)
    expect(result.current.accountingMode).toBe('configured')
  })

  it('derives a populated view once a snapshot is active', () => {
    act(() => useSnapshotStore.getState().addSnapshot(snapshot('s1')))
    const { result } = renderHook(() => useEstateView('active'))
    expect(result.current.clusters.length).toBeGreaterThan(0)
    expect(result.current.osBreakdown.linux).toBe(1)
  })
})
