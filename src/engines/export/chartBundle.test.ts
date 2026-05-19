import type { EChartsOption } from 'echarts/types/dist/shared'
import { describe, expect, it } from 'vitest'
import { buildEstateView } from '@/engines/aggregation'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { bytes, cores, mhz, mib, sockets } from '@/engines/units'
import type { AccountingMode } from '@/types/estate'
import type { Snapshot } from '@/types/snapshot'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import { buildChartBundle } from './chartBundle'

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
  vinfo: [
    vm({ vmName: 'a1', cluster: 'C1', host: 'esx-1', provisionedMib: mib(40_960) }),
    vm({ vmName: 'b1', cluster: 'C2', host: 'esx-2', provisionedMib: mib(81_920) }),
  ],
  vhost: [host({ hostName: 'esx-1', cluster: 'C1' }), host({ hostName: 'esx-2', cluster: 'C2' })],
  vdatastore: [],
  vpartition: [],
  vnetwork: [],
  vswitch: [],
  dvswitch: [],
  dvport: [],
  parseErrors: [],
  ...over,
})

interface TreemapSeries {
  type: string
  breadcrumb: { show: boolean }
  data: Array<{ name: string; value: number }>
}

const treemapSeries = (opt: EChartsOption | undefined): TreemapSeries => {
  if (!opt) throw new Error('storageTreemap option missing from shared bundle')
  const series = (opt.series as unknown as TreemapSeries[])[0]
  if (!series) throw new Error('treemap series[0] missing')
  return series
}

describe('storageTreemap', () => {
  const s = snap({})
  const view = buildEstateView(mergeSnapshotsToEstate([s]), [s], MODE, TODAY)

  it('is a treemap EChartsOption in the shared bundle', () => {
    const series = treemapSeries(buildChartBundle(view, null, 'en').shared.storageTreemap)
    expect(series.type).toBe('treemap')
    expect(series.breadcrumb.show).toBe(false)
  })

  it('maps view.storage.byCluster rows to { name, value } (provisioned consumption)', () => {
    const series = treemapSeries(buildChartBundle(view, null, 'en').shared.storageTreemap)
    expect(series.data).toHaveLength(view.storage.byCluster.length)
    view.storage.byCluster.forEach((g, i) => {
      expect(series.data[i]).toEqual({ name: g.key, value: g.provisionedMib as number })
    })
  })

  it('is present and locale-independent under the fr locale', () => {
    expect(buildChartBundle(view, null, 'fr').shared.storageTreemap).toBeDefined()
    expect(treemapSeries(buildChartBundle(view, null, 'fr').shared.storageTreemap).type).toBe(
      'treemap',
    )
  })
})
