import { describe, expect, it } from 'vitest'
import { cores, mhz, mib, sockets } from '@/engines/units'
import type { ParsedSheet, ParsedWorkbook } from '../parseXlsx'
import { synthesizeOrphanClusters } from '../synthesizeOrphanClusters'
import {
  adaptRvtools,
  adaptRvtoolsVDatastore,
  adaptRvtoolsVInfo,
  adaptRvtoolsVMetaData,
  adaptRvtoolsVPartition,
} from './rvtools'

/** Build a single `ParsedSheet` (header strings trimmed, rows keyed by header). */
const mkSheet = (name: string, headers: string[], rows: unknown[][]): ParsedSheet => ({
  name,
  headers,
  rows: rows.map((r) => {
    const o: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      o[h] = r[i] ?? null
    })
    return o
  }),
})

/** Wrap one or more sheets into a `ParsedWorkbook`. */
const workbook = (...sheets: ParsedSheet[]): ParsedWorkbook => ({
  sheets: new Map(sheets.map((s) => [s.name, s])),
})

const VINFO_FULL = [
  'VM',
  'Powerstate',
  'Cluster',
  'Host',
  '# CPUs',
  'Memory',
  'Provisioned MB',
  'In Use MB',
  'OS according to the configuration file',
  'OS according to the VMware Tools',
  'VM UUID',
  'VM Instance UUID',
  'VI SDK UUID',
  'VI SDK Server',
]

const VHOST_FULL = ['Host', 'Cluster', '# CPU', '# Cores', 'Speed', '# Memory']

const baseRow = [
  'vm-a',
  'poweredOn',
  'cluster-a',
  'host-a',
  4,
  8192,
  102400,
  51200,
  'RHEL 8 (64-bit)',
  'Red Hat Enterprise Linux 8.10',
  'bios-uuid-a',
  'instance-uuid-a',
  'vi-sdk-uuid-a',
  'vcenter-a.local',
]

const vhostRow = ['host-a', 'cluster-a', 2, 12, 2600, 65536]

describe('adaptRvtoolsVInfo — alias resolution (PAR-03)', () => {
  for (const alias of ['# CPUs', 'CPUs', 'CPU', 'vCPU', 'vCPUs']) {
    it(`resolves vcpu from the "${alias}" header spelling`, () => {
      const headers = [...VINFO_FULL]
      headers[4] = alias
      const rows = adaptRvtoolsVInfo(mkSheet('vInfo', headers, [baseRow]))
      expect(rows[0]?.vcpu).toBe(4)
    })
  }
})

describe('adaptRvtoolsVInfo — OS / identity extraction', () => {
  it('extracts osConfig and osTools from their distinct columns', () => {
    const rows = adaptRvtoolsVInfo(mkSheet('vInfo', VINFO_FULL, [baseRow]))
    expect(rows[0]?.osConfig).toBe('RHEL 8 (64-bit)')
    expect(rows[0]?.osTools).toBe('Red Hat Enterprise Linux 8.10')
  })

  it('lands VI SDK UUID on every VInfoRow.viSdkUuid (Phase 4 identity key)', () => {
    const rows = adaptRvtoolsVInfo(mkSheet('vInfo', VINFO_FULL, [baseRow]))
    expect(rows[0]?.viSdkUuid).toBe('vi-sdk-uuid-a')
    expect(rows[0]?.vmBiosUuid).toBe('bios-uuid-a')
    expect(rows[0]?.vmInstanceUuid).toBe('instance-uuid-a')
  })

  it('keeps Provisioned/In Use MB as raw MiB (no SI inflation factor)', () => {
    const rows = adaptRvtoolsVInfo(mkSheet('vInfo', VINFO_FULL, [baseRow]))
    expect(rows[0]?.provisionedMib).toBe(102400)
    expect(rows[0]?.inUseMib).toBe(51200)
    expect(rows[0]?.vramMib).toBe(8192)
  })

  it('skips RVTools internal Total/Summary rows', () => {
    const rows = adaptRvtoolsVInfo(
      mkSheet('vInfo', VINFO_FULL, [
        baseRow,
        ['Total', '', '', '', 0, 0, 0, 0, '', '', '', '', '', ''],
        ['', '', '', '', 0, 0, 0, 0, '', '', '', '', '', ''],
      ]),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.vmName).toBe('vm-a')
  })
})

describe('adaptRvtools — structured errors (PAR-02)', () => {
  it('throws a ParseError naming the missing vInfo sheet', () => {
    try {
      adaptRvtools(workbook(mkSheet('vHost', ['Host'], [['h']])))
      expect.unreachable('expected adaptRvtools to throw')
    } catch (err) {
      const e = err as Error & { sheet?: string; kind?: string }
      expect(e.name).toBe('ParseError')
      expect(e.message).toMatch(/missing sheet: vInfo/)
      expect(e.sheet).toBe('vInfo')
      expect(e.kind).toBe('missing-sheet')
    }
  })

  it('throws a ParseError naming the missing vHost sheet when only vInfo present', () => {
    try {
      adaptRvtools(workbook(mkSheet('vInfo', VINFO_FULL, [baseRow])))
      expect.unreachable('expected adaptRvtools to throw')
    } catch (err) {
      const e = err as Error & { sheet?: string; kind?: string }
      expect(e.name).toBe('ParseError')
      expect(e.message).toMatch(/missing sheet: vHost/)
      expect(e.sheet).toBe('vHost')
    }
  })

  it('throws a ParseError when vInfo lacks any # CPUs-equivalent column', () => {
    const headers = VINFO_FULL.filter((h) => h !== '# CPUs')
    const row = baseRow.filter((_, i) => i !== 4)
    try {
      adaptRvtools(
        workbook(mkSheet('vInfo', headers, [row]), mkSheet('vHost', VHOST_FULL, [vhostRow])),
      )
      expect.unreachable('expected adaptRvtools to throw')
    } catch (err) {
      const e = err as Error & { column?: string; kind?: string }
      expect(e.name).toBe('ParseError')
      expect(e.kind).toBe('missing-column')
      expect(e.column).toBe('vcpu')
      expect(e.message).toMatch(/missing required column/i)
    }
  })

  it('tolerates missing OPTIONAL vDatastore/vPartition/vMetaData with warnings', () => {
    const out = adaptRvtools(
      workbook(mkSheet('vInfo', VINFO_FULL, [baseRow]), mkSheet('vHost', VHOST_FULL, [vhostRow])),
    )
    expect(out.vinfo).toHaveLength(1)
    expect(out.vhost).toHaveLength(1)
    expect(out.vdatastore).toEqual([])
    expect(out.vpartition).toEqual([])
    expect(out.warnings.some((w) => w.sheet === 'vDatastore' && w.kind === 'missing-sheet')).toBe(
      true,
    )
  })
})

describe('synthesizeOrphanClusters integration', () => {
  it('buckets a clusterless VM under (no cluster) <host>', () => {
    const vinfo = adaptRvtoolsVInfo(
      mkSheet('vInfo', VINFO_FULL, [
        ['vm-x', 'poweredOn', '', 'standalone-1', 2, 4096, 1024, 512, '', '', '', '', '', ''],
      ]),
    )
    const bucketed = synthesizeOrphanClusters({
      vinfo,
      vhost: [
        {
          hostName: 'standalone-1',
          cluster: '',
          sockets: sockets(2),
          cores: cores(12),
          speedMhz: mhz(2600),
          memoryMib: mib(65536),
          cpuRatio: 0,
          ramRatio: 0,
        },
      ],
    })
    expect(bucketed.vinfo[0]?.cluster).toBe('(no cluster) standalone-1')
  })
})

describe('optional-sheet adapters', () => {
  it('adaptRvtoolsVDatastore reads capacity/free/provisioned/naa/type', () => {
    const rows = adaptRvtoolsVDatastore(
      mkSheet(
        'vDatastore',
        ['Name', 'Capacity MB', 'Free MB', 'Provisioned MB', 'Address', 'Type'],
        [
          ['ds-01', 1024, 256, 800, 'naa.6000', 'VMFS'],
          ['ds-02', 2048, 1024, 1000, '', 'NFS'],
          ['Total', 0, 0, 0, '', ''],
        ],
      ),
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      name: 'ds-01',
      capacityMib: 1024,
      freeMib: 256,
      provisionedMib: 800,
      naa: 'naa.6000',
      type: 'VMFS',
    })
    expect(rows[1]?.naa).toBeNull()
  })

  it('adaptRvtoolsVPartition reads vm/disk/capacity/consumed/free', () => {
    const rows = adaptRvtoolsVPartition(
      mkSheet(
        'vPartition',
        ['VM', 'Disk', 'Capacity MB', 'Consumed MB', 'Free MB'],
        [['vm-a', '/', 10240, 4096, 6144]],
      ),
    )
    expect(rows[0]).toMatchObject({
      vmName: 'vm-a',
      disk: '/',
      capacityMib: 10240,
      consumedMib: 4096,
      freeMib: 6144,
    })
  })

  it('adaptRvtoolsVMetaData reduces Property/Value rows', () => {
    const meta = adaptRvtoolsVMetaData(
      mkSheet(
        'vMetaData',
        ['Property', 'Value'],
        [
          ['RVTools Version', '4.4.0'],
          ['Exported Timestamp', '2026-05-15 10:00:00'],
          ['Unrelated', ''],
        ],
      ),
    )
    expect(meta).toEqual({
      rvtoolsVersion: '4.4.0',
      exportedTimestamp: '2026-05-15 10:00:00',
    })
  })

  it('adaptRvtools wires the optional sheets through when present', () => {
    const out = adaptRvtools(
      workbook(
        mkSheet('vInfo', VINFO_FULL, [baseRow]),
        mkSheet('vHost', VHOST_FULL, [vhostRow]),
        mkSheet('vDatastore', ['Name', 'Capacity MB', 'Free MB'], [['ds', 100, 50]]),
        mkSheet('vPartition', ['VM', 'Disk', 'Capacity MB'], [['vm-a', '/', 10]]),
        mkSheet('vMetaData', ['Property', 'Value'], [['RVTools Version', '4.4.0']]),
      ),
    )
    expect(out.vdatastore).toHaveLength(1)
    expect(out.vpartition).toHaveLength(1)
    expect(out.vmetadata.rvtoolsVersion).toBe('4.4.0')
    expect(out.warnings).toHaveLength(0)
  })
})

describe('cell parsing edge cases', () => {
  it('treats Excel error / sentinel readiness cells as null, not 0', () => {
    const headers = [...VINFO_FULL, 'Overall Cpu Readiness']
    const mk = (cell: unknown) =>
      adaptRvtoolsVInfo(mkSheet('vInfo', headers, [[...baseRow, cell]]))[0]?.cpuReadinessPercent
    expect(mk('#DIV/0!')).toBeNull()
    expect(mk('N/A')).toBeNull()
    expect(mk('-')).toBeNull()
    expect(mk('')).toBeNull()
    expect(mk(null)).toBeNull()
    expect(mk(true)).toBeNull()
    expect(mk('12.5%')).toBe(12.5)
    expect(mk(7)).toBe(7)
  })

  it('coerces locale-formatted numeric cells (spaces, comma decimal)', () => {
    const rows = adaptRvtoolsVInfo(
      mkSheet('vInfo', VINFO_FULL, [
        ['vm-l', 'poweredOn', 'c', 'h', "1'024", '2 048', '4,5', 0, '', '', '', '', '', ''],
      ]),
    )
    expect(rows[0]?.vcpu).toBe(1024)
    expect(rows[0]?.vramMib).toBe(2048)
    expect(rows[0]?.provisionedMib).toBe(4.5)
  })
})

describe('RVTools >=4.x MiB-suffixed headers resolve (A7 / PITFALLS Moderate-1)', () => {
  it('vDatastore "Capacity/Provisioned/In Use/Free MiB" map to real numbers, not 0', () => {
    const ds = adaptRvtoolsVDatastore(
      mkSheet(
        'vDatastore',
        ['Name', 'Type', 'Address', 'Capacity MiB', 'Provisioned MiB', 'In Use MiB', 'Free MiB'],
        [['datastore1', 'VMFS', 't10.NVMe_x', 784384, 1456, 1456, 782928]],
      ),
    )
    expect(ds[0]?.capacityMib).toBe(mib(784384))
    expect(ds[0]?.provisionedMib).toBe(mib(1456))
    expect(ds[0]?.freeMib).toBe(mib(782928))
  })

  it('vPartition "Capacity/Consumed/Free MiB" map to real numbers, not 0', () => {
    const vp = adaptRvtoolsVPartition(
      mkSheet(
        'vPartition',
        ['VM', 'Disk', 'Capacity MiB', 'Consumed MiB', 'Free MiB'],
        [['vm-a', 'C:\\', 81920, 40000, 41920]],
      ),
    )
    expect(vp[0]?.capacityMib).toBe(mib(81920))
    expect(vp[0]?.consumedMib).toBe(mib(40000))
    expect(vp[0]?.freeMib).toBe(mib(41920))
  })

  it('vInfo "Provisioned MiB" / "In Use MiB" map to real numbers, not 0', () => {
    const vi = adaptRvtoolsVInfo(
      mkSheet(
        'vInfo',
        ['VM', 'Powerstate', 'Cluster', 'Host', 'CPUs', 'Memory', 'Provisioned MiB', 'In Use MiB'],
        [['vm-a', 'poweredOn', 'CL1', 'esx1', 4, 16384, 81920, 40960]],
      ),
    )
    expect(vi[0]?.provisionedMib).toBe(mib(81920))
    expect(vi[0]?.inUseMib).toBe(mib(40960))
  })
})
