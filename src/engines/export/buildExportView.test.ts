import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildEstateView } from '@/engines/aggregation'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { bytes, cores, mhz, mib, sockets } from '@/engines/units'
import type { AccountingMode } from '@/types/estate'
import type { Snapshot } from '@/types/snapshot'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import { buildExportView } from './buildExportView'

const TODAY = new Date('2026-01-01T00:00:00Z')
const MODE: AccountingMode = 'configured'

const host = (over: Partial<VHostRow>): VHostRow => ({
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
  esxVersion: '',
  ...over,
})

const vm = (over: Partial<VInfoRow>): VInfoRow => ({
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
  ...over,
})

const snap = (over: Partial<Snapshot>): Snapshot => ({
  id: 's1',
  filename: 'f.xlsx',
  fileSize: bytes(1024),
  capturedAt: new Date('2026-01-01'),
  vCenterLabel: 'vc',
  rvtoolsVersion: '4.7.1.4',
  parsedAt: new Date('2026-01-02'),
  source: 'rvtools',
  viSdkUuid: null,
  vMetaData: [],
  vinfo: [vm({})],
  vhost: [host({})],
  vmUsage: [],
  vdatastore: [],
  vpartition: [],
  vnetwork: [],
  vswitch: [],
  dvswitch: [],
  dvport: [],
  parseErrors: [],
  ...over,
})

describe('buildExportView — D-08 active-snapshot body', () => {
  it('A2: single-snapshot view deep-equals the direct single-snapshot buildEstateView call', () => {
    const a = snap({ id: 'a' })
    const direct = buildEstateView(mergeSnapshotsToEstate([a]), [a], MODE, TODAY)
    const { view } = buildExportView(a, [a], MODE, TODAY)
    expect(view).toEqual(direct)
  })

  it('D-09: trends is null when only one snapshot is loaded', () => {
    const a = snap({ id: 'a' })
    expect(buildExportView(a, [a], MODE, TODAY).trends).toBeNull()
  })

  it('D-08/D-09: trends is non-null across ≥2 snapshots', () => {
    const a = snap({ id: 'a', capturedAt: new Date('2026-01-01') })
    const b = snap({ id: 'b', capturedAt: new Date('2026-02-01') })
    const { trends } = buildExportView(a, [a, b], MODE, TODAY)
    expect(trends).not.toBeNull()
  })

  it('body is the ACTIVE snapshot, not the merged set (D-08): two snapshots, view == active-only view', () => {
    const a = snap({ id: 'a', vinfo: [vm({ vmName: 'only-in-a' })] })
    const b = snap({ id: 'b', vinfo: [vm({ vmName: 'only-in-b', cluster: 'C2' })] })
    const activeOnly = buildEstateView(mergeSnapshotsToEstate([a]), [a], MODE, TODAY)
    const { view } = buildExportView(a, [a, b], MODE, TODAY)
    expect(view).toEqual(activeOnly)
  })

  it('P-RS: sizing is computed over ALL loaded snapshots (max-of-N)', () => {
    const usage = (over: Partial<Snapshot['vmUsage'][number]> = {}) => ({
      vmName: 'vm-1',
      cluster: 'C1',
      vmBiosUuid: '',
      vmInstanceUuid: 'i1',
      activeMib: mib(1024),
      consumedMib: mib(2048),
      balloonedMib: mib(0),
      swappedMib: mib(0),
      cpuUsageMhz: mhz(300),
      ...over,
    })
    const a = snap({
      id: 'a',
      capturedAt: new Date('2026-01-01'),
      vinfo: [vm({ vmInstanceUuid: 'i1' })],
      vmUsage: [usage()],
    })
    const b = snap({
      id: 'b',
      capturedAt: new Date('2026-02-01'),
      vinfo: [vm({ vmInstanceUuid: 'i1' })],
      vmUsage: [usage({ cpuUsageMhz: mhz(50) })],
    })
    const { sizing } = buildExportView(a, [a, b], MODE, TODAY)
    expect(sizing.snapshotCount).toBe(2)
    expect(sizing.hasUsageData).toBe(true)
    expect(sizing.rows[0]?.sampleBasis).toBe('max-of-N')
    // max(300, 50) MHz over a 4×2600 MHz ceiling ≈ 2.9% ≤ 10 ⇒ cpuOversized.
    expect(sizing.rows[0]?.flags.cpuOversized).toBe(true)
  })

  it('is a pure engine — no React / Zustand / hook import', () => {
    const src = readFileSync(join(process.cwd(), 'src/engines/export/buildExportView.ts'), 'utf8')
    expect(src).not.toMatch(/from 'react'/)
    expect(src).not.toMatch(/from 'zustand'/)
    expect(src).not.toMatch(/useEstateView/)
  })
})
