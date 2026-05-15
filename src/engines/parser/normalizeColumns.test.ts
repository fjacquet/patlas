import { describe, expect, it } from 'vitest'
import { parseSnapshot } from './normalizeColumns'
import type { ParsedWorkbook } from './parseXlsx'

const VINFO = [
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
const VHOST = ['Host', 'Cluster', '# CPU', '# Cores', 'Speed', '# Memory']

const mkSheet = (name: string, headers: string[], rows: unknown[][]) => [
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
]

const workbook = (vinfoRows: unknown[][]): ParsedWorkbook => ({
  sheets: new Map([
    mkSheet('vInfo', VINFO, vinfoRows),
    mkSheet('vHost', VHOST, [['host-a', 'cluster-a', 2, 12, 2600, 65536]]),
  ] as never),
})

describe('parseSnapshot', () => {
  it('returns 2 valid vinfo rows with no parseErrors for a clean 2-VM workbook', () => {
    const wb = workbook([
      [
        'vm-1',
        'poweredOn',
        'cluster-a',
        'host-a',
        4,
        8192,
        102400,
        51200,
        'rhel',
        'rhel',
        'u1',
        'i1',
        'sdk',
        'vc',
      ],
      [
        'vm-2',
        'poweredOff',
        'cluster-a',
        'host-a',
        2,
        4096,
        51200,
        25600,
        'win',
        'win',
        'u2',
        'i2',
        'sdk',
        'vc',
      ],
    ])
    const { snapshot, warnings } = parseSnapshot(wb)
    expect(snapshot.vinfo).toHaveLength(2)
    const invalid = [...warnings, ...snapshot.parseErrors].filter((e) => e.kind === 'invalid-row')
    expect(invalid).toHaveLength(0)
  })

  it('drops a Zod-invalid row and records one invalid-row parseError', () => {
    const wb = workbook([
      [
        'vm-1',
        'poweredOn',
        'cluster-a',
        'host-a',
        4,
        8192,
        102400,
        51200,
        'rhel',
        'rhel',
        'u1',
        'i1',
        'sdk',
        'vc',
      ],
      // empty cluster → fails z.string().trim().min(1) on cluster
      [
        'vm-2',
        'poweredOn',
        '   ',
        'host-a',
        2,
        4096,
        51200,
        25600,
        'win',
        'win',
        'u2',
        'i2',
        'sdk',
        'vc',
      ],
    ])
    const { snapshot } = parseSnapshot(wb)
    expect(snapshot.vinfo).toHaveLength(1)
    expect(snapshot.vinfo[0]?.vmName).toBe('vm-1')
    expect(snapshot.parseErrors.filter((e) => e.kind === 'invalid-row')).toHaveLength(1)
  })
})
