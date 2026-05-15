import { describe, expect, it } from 'vitest'
import { cores, mhz, mib, sockets } from '@/engines/units'
import type { ParsedSheet, ParsedWorkbook } from '../parseXlsx'
import { synthesizeOrphanClusters } from '../synthesizeOrphanClusters'
import { adaptRvtools, adaptRvtoolsVInfo } from './rvtools'

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
