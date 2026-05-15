import { describe, expect, it } from 'vitest'
import type { ParsedWorkbook } from '../parseXlsx'
import { adaptRvtools, adaptRvtoolsVInfo } from './rvtools'
import { synthesizeOrphanClusters } from '../synthesizeOrphanClusters'

/**
 * Build a one-sheet ParsedWorkbook from a header row + body rows.
 * Mirrors what `parseXlsx` produces (header strings trimmed, rows keyed
 * by header, missing cells `null`).
 */
const sheet = (name: string, headers: string[], rows: unknown[][]): ParsedWorkbook => ({
  sheets: new Map([
    [
      name,
      {
        name,
        headers,
        rows: rows.map((r) => {
          const o: Record<string, unknown> = {}
          headers.forEach((h, i) => {
            o[h] = r[i] ?? null
          })
          return o
        }),
      },
    ],
  ]),
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

describe('adaptRvtoolsVInfo — alias resolution (PAR-03)', () => {
  for (const alias of ['# CPUs', 'CPUs', 'CPU', 'vCPU', 'vCPUs']) {
    it(`resolves vcpu from the "${alias}" header spelling`, () => {
      const headers = [...VINFO_FULL]
      headers[4] = alias
      const rows = adaptRvtoolsVInfo(sheet('vInfo', headers, [baseRow]).sheets.get('vInfo')!)
      expect(rows[0]?.vcpu).toBe(4)
    })
  }
})

describe('adaptRvtoolsVInfo — OS / identity extraction', () => {
  it('extracts osConfig and osTools from their distinct columns', () => {
    const rows = adaptRvtoolsVInfo(sheet('vInfo', VINFO_FULL, [baseRow]).sheets.get('vInfo')!)
    expect(rows[0]?.osConfig).toBe('RHEL 8 (64-bit)')
    expect(rows[0]?.osTools).toBe('Red Hat Enterprise Linux 8.10')
  })

  it('lands VI SDK UUID on every VInfoRow.viSdkUuid (Phase 4 identity key)', () => {
    const rows = adaptRvtoolsVInfo(sheet('vInfo', VINFO_FULL, [baseRow]).sheets.get('vInfo')!)
    expect(rows[0]?.viSdkUuid).toBe('vi-sdk-uuid-a')
    expect(rows[0]?.vmBiosUuid).toBe('bios-uuid-a')
    expect(rows[0]?.vmInstanceUuid).toBe('instance-uuid-a')
  })

  it('keeps Provisioned/In Use MB as raw MiB (no * 1.048576 inflation)', () => {
    const rows = adaptRvtoolsVInfo(sheet('vInfo', VINFO_FULL, [baseRow]).sheets.get('vInfo')!)
    expect(rows[0]?.provisionedMib).toBe(102400)
    expect(rows[0]?.inUseMib).toBe(51200)
    expect(rows[0]?.vramMib).toBe(8192)
  })

  it('skips RVTools internal Total/Summary rows', () => {
    const rows = adaptRvtoolsVInfo(
      sheet('vInfo', VINFO_FULL, [
        baseRow,
        ['Total', '', '', '', 0, 0, 0, 0, '', '', '', '', '', ''],
        ['', '', '', '', 0, 0, 0, 0, '', '', '', '', '', ''],
      ]).sheets.get('vInfo')!,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.vmName).toBe('vm-a')
  })
})

describe('adaptRvtools — structured errors (PAR-02)', () => {
  it('throws a ParseError naming the missing vInfo sheet', () => {
    const wb = sheet('vHost', ['Host'], [['h']])
    try {
      adaptRvtools(wb)
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
    const wb = sheet('vInfo', VINFO_FULL, [baseRow])
    try {
      adaptRvtools(wb)
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
    const wb: ParsedWorkbook = {
      sheets: new Map([
        ...sheet('vInfo', headers, [row]).sheets,
        ...sheet('vHost', ['Host', 'Cluster', '# CPU', '# Cores', 'Speed', '# Memory'], [
          ['h', 'c', 2, 12, 2600, 65536],
        ]).sheets,
      ]),
    }
    try {
      adaptRvtools(wb)
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
    const wb: ParsedWorkbook = {
      sheets: new Map([
        ...sheet('vInfo', VINFO_FULL, [baseRow]).sheets,
        ...sheet('vHost', ['Host', 'Cluster', '# CPU', '# Cores', 'Speed', '# Memory'], [
          ['host-a', 'cluster-a', 2, 12, 2600, 65536],
        ]).sheets,
      ]),
    }
    const out = adaptRvtools(wb)
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
    const vinfoSheet = sheet('vInfo', VINFO_FULL, [
      ['vm-x', 'poweredOn', '', 'standalone-1', 2, 4096, 1024, 512, '', '', '', '', '', ''],
    ]).sheets.get('vInfo')!
    const vinfo = adaptRvtoolsVInfo(vinfoSheet)
    const bucketed = synthesizeOrphanClusters({
      vinfo,
      vhost: [
        {
          hostName: 'standalone-1',
          cluster: '',
          sockets: 2 as never,
          cores: 12 as never,
          speedMhz: 2600 as never,
          memoryMib: 65536 as never,
          cpuRatio: 0,
          ramRatio: 0,
        },
      ],
    })
    expect(bucketed.vinfo[0]?.cluster).toBe('(no cluster) standalone-1')
  })
})
