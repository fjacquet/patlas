import { describe, expect, it } from 'vitest'
import { cores, mhz, mib, sockets } from '@/engines/units'
import type { ParsedSheet, ParsedWorkbook } from '../parseXlsx'
import { synthesizeOrphanClusters } from '../synthesizeOrphanClusters'
import {
  adaptRvtools,
  adaptRvtoolsVDatastore,
  adaptRvtoolsVHost,
  adaptRvtoolsVInfo,
  adaptRvtoolsVMetaData,
  adaptRvtoolsVPartition,
  VINFO_COLS,
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
          faultDomain: '',
          model: '',
          vendor: '',
          esxVersion: '',
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
    // No Cluster column in this sheet ⇒ clusterName is '' (host-local),
    // never undefined — the schema requires the field.
    expect(rows[0]?.clusterName).toBe('')
  })

  it('adaptRvtoolsVDatastore resolves the real `Cluster name` column (UAT regression)', () => {
    const rows = adaptRvtoolsVDatastore(
      mkSheet(
        'vDatastore',
        ['Name', 'Capacity MB', 'Free MB', 'Provisioned MB', 'Address', 'Type', 'Cluster name'],
        [
          ['ds-01', 1024, 256, 800, 'naa.6000', 'VMFS', 'Production-Cluster'],
          ['ds-02', 2048, 1024, 1000, 'naa.6001', 'NFS', ''],
        ],
      ),
    )
    expect(rows[0]?.clusterName).toBe('Production-Cluster')
    // Empty cell ⇒ '' (host-local) — row is NOT dropped.
    expect(rows[1]?.clusterName).toBe('')
    expect(rows).toHaveLength(2)
  })

  it('adaptRvtoolsVDatastore accepts the bare `Cluster` alias spelling', () => {
    const rows = adaptRvtoolsVDatastore(
      mkSheet(
        'vDatastore',
        ['Name', 'Capacity MB', 'Free MB', 'Cluster'],
        [['ds-x', 100, 50, 'Cluster-X']],
      ),
    )
    expect(rows[0]?.clusterName).toBe('Cluster-X')
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

  it('adaptRvtoolsVMetaData reduces legacy Property/Value rows to a single entry', () => {
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
      entries: [
        {
          server: '',
          rvtoolsVersion: '4.4.0',
          exportedTimestamp: '2026-05-15 10:00:00',
        },
      ],
    })
  })

  it('adaptRvtoolsVMetaData parses the RVTools 4.x columnar sheet (one row per vCenter)', () => {
    const meta = adaptRvtoolsVMetaData(
      mkSheet(
        'vMetaData',
        ['RVTools major version', 'RVTools version', 'xlsx creation datetime', 'Server'],
        [
          ['4', '4.7.1.4', '2026-04-30 14:00:00', 'spvspherevc11.ad.net.fr.ch'],
          ['4', '4.7.1.4', '2026-04-30 14:00:00', 'spvspherevc13.ad.net.fr.ch'],
          ['4', '4.7.1.4', '2026-04-30 14:00:00', 'spvspherevc14.ad.net.fr.ch'],
        ],
      ),
    )
    expect(meta.entries).toHaveLength(3)
    expect(meta.entries[0]).toEqual({
      server: 'spvspherevc11.ad.net.fr.ch',
      rvtoolsVersion: '4.7.1.4',
      exportedTimestamp: '2026-04-30 14:00:00',
    })
    expect(meta.entries[2]?.server).toBe('spvspherevc14.ad.net.fr.ch')
    // The columnar version is read verbatim, NOT the legacy '3.11+' marker.
    expect(meta.entries.every((e) => e.rvtoolsVersion === '4.7.1.4')).toBe(true)
  })

  it('adaptRvtoolsVMetaData skips internal Total/blank rows in the columnar sheet', () => {
    const meta = adaptRvtoolsVMetaData(
      mkSheet(
        'vMetaData',
        ['RVTools major version', 'RVTools version', 'xlsx creation datetime', 'Server'],
        [
          ['4', '4.7.1.4', '2026-04-30 14:00:00', 'vc-a.local'],
          ['', '', '', ''],
        ],
      ),
    )
    expect(meta.entries).toHaveLength(1)
    expect(meta.entries[0]?.server).toBe('vc-a.local')
  })

  it('adaptRvtoolsVHost resolves the vSAN Fault Domain Name column (STR-02/03)', () => {
    const rows = adaptRvtoolsVHost(
      mkSheet(
        'vHost',
        [...VHOST_FULL, 'vSAN Fault Domain Name'],
        [
          ['host-a', 'cluster-a', 2, 12, 2600, 65536, 'Secondary'],
          ['host-b', 'cluster-a', 2, 12, 2600, 65536, ''],
        ],
      ),
    )
    expect(rows[0]?.faultDomain).toBe('Secondary')
    // Untagged host ⇒ '' (never undefined, never dropped).
    expect(rows[1]?.faultDomain).toBe('')
  })

  it('adaptRvtoolsVHost defaults faultDomain to "" when the column is absent', () => {
    const rows = adaptRvtoolsVHost(mkSheet('vHost', VHOST_FULL, [vhostRow]))
    expect(rows[0]?.faultDomain).toBe('')
  })

  it('adaptRvtoolsVDatastore resolves the Hosts column (Pitfall-6 prerequisite)', () => {
    const rows = adaptRvtoolsVDatastore(
      mkSheet(
        'vDatastore',
        ['Name', 'Capacity MB', 'Free MB', 'Hosts'],
        [
          ['vsan-ds', 1024, 256, 'esx-1, esx-2, esx-3'],
          ['local-ds', 512, 128, ''],
        ],
      ),
    )
    expect(rows[0]?.hosts).toBe('esx-1, esx-2, esx-3')
    expect(rows[1]?.hosts).toBe('')
  })

  it('adaptRvtoolsVDatastore defaults hosts to "" when the column is absent', () => {
    const rows = adaptRvtoolsVDatastore(
      mkSheet('vDatastore', ['Name', 'Capacity MB', 'Free MB'], [['ds', 100, 50]]),
    )
    expect(rows[0]?.hosts).toBe('')
  })

  it('the vmBiosUuid alias list is the shipped value (RESEARCH Pitfall 2 / A2 guard)', () => {
    // Guard against an accidental edit: vmBiosUuid MUST resolve to RVTools
    // `VM UUID` (the vCenter-assigned unique key), NEVER SMBIOS UUID.
    expect(VINFO_COLS.vmBiosUuid).toEqual(['vm uuid', 'bios uuid', 'uuid'])
  })

  it('adaptRvtools wires the optional sheets through when present', () => {
    const out = adaptRvtools(
      workbook(
        mkSheet('vInfo', VINFO_FULL, [baseRow]),
        mkSheet('vHost', VHOST_FULL, [vhostRow]),
        mkSheet('vDatastore', ['Name', 'Capacity MB', 'Free MB'], [['ds', 100, 50]]),
        mkSheet('vPartition', ['VM', 'Disk', 'Capacity MB'], [['vm-a', '/', 10]]),
        mkSheet('vMetaData', ['Property', 'Value'], [['RVTools Version', '4.4.0']]),
        // P9 D-11: the four network sheets are now also OPTIONAL — include
        // them so "all optional sheets present ⇒ zero warnings" still holds.
        mkSheet(
          'vNetwork',
          ['VM', 'Network', 'Switch', 'Adapter', 'Connected', 'Cluster', 'Host'],
          [['vm-a', 'PG-A', 'vSwitch0', 'vmxnet3', 'True', 'C1', 'esx-1']],
        ),
        mkSheet(
          'vSwitch',
          ['Host', 'Cluster', 'Switch', '# Ports', 'Free Ports', 'MTU'],
          [['esx-1', 'C1', 'vSwitch0', 128, 100, 1500]],
        ),
        mkSheet(
          'dvSwitch',
          ['Switch', 'Name', 'Version', 'Host members', '# Ports', '# VMs', 'Max MTU'],
          [['DVS', 'prod-dvs', '8.0.0', 'esx-1, esx-2', 512, 40, 9000]],
        ),
        mkSheet(
          'dvPort',
          ['Port', 'Switch', 'VLAN', 'Active Uplink', 'Standby Uplink'],
          [['dvpg-10', 'DVS', '10', 'uplink1', 'uplink2']],
        ),
      ),
    )
    expect(out.vdatastore).toHaveLength(1)
    expect(out.vpartition).toHaveLength(1)
    expect(out.vmetadata.entries[0]?.rvtoolsVersion).toBe('4.4.0')
    expect(out.vnetwork).toHaveLength(1)
    expect(out.vnetwork[0]?.network).toBe('PG-A')
    expect(out.vswitch[0]?.ports).toBe(128)
    expect(out.dvswitch[0]?.maxMtu).toBe(9000)
    expect(out.dvport[0]?.vlan).toBe('10')
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

describe('P5 — Powerstate enum / Template / host model·vendor·ESX version', () => {
  const VI = ['VM', 'Powerstate', 'Template', 'Cluster', 'Host', 'CPUs', 'Memory']
  it('Powerstate maps to the exact enum; poweredOn is derived', () => {
    const vi = adaptRvtoolsVInfo(
      mkSheet('vInfo', VI, [
        ['on', 'poweredOn', 'False', 'C', 'h', 2, 1024],
        ['off', 'poweredOff', 'False', 'C', 'h', 2, 1024],
        ['susp', 'suspended', 'False', 'C', 'h', 2, 1024],
      ]),
    )
    expect(vi.map((r) => r.powerState)).toEqual(['poweredOn', 'poweredOff', 'suspended'])
    expect(vi.map((r) => r.poweredOn)).toEqual([true, false, false])
  })

  it('Template TRUE/FALSE → boolean; absent column → false', () => {
    const withT = adaptRvtoolsVInfo(
      mkSheet('vInfo', VI, [
        ['t', 'poweredOn', 'True', 'C', 'h', 2, 1024],
        ['f', 'poweredOn', 'False', 'C', 'h', 2, 1024],
      ]),
    )
    expect(withT.map((r) => r.template)).toEqual([true, false])
    const noT = adaptRvtoolsVInfo(
      mkSheet(
        'vInfo',
        ['VM', 'Powerstate', 'Cluster', 'Host', 'CPUs', 'Memory'],
        [['x', 'poweredOn', 'C', 'h', 2, 1024]],
      ),
    )
    expect(noT[0]?.template).toBe(false)
  })

  it('vHost Model / Vendor / ESX Version parse factually; absent → ""', () => {
    const rows = adaptRvtoolsVHost(
      mkSheet(
        'vHost',
        [...VHOST_FULL, 'Model', 'Vendor', 'ESX Version'],
        [
          [
            'host-a',
            'cluster-a',
            2,
            12,
            2600,
            65536,
            'PowerEdge R740',
            'Dell Inc.',
            'VMware ESXi 7.0.3',
          ],
        ],
      ),
    )
    expect(rows[0]?.model).toBe('PowerEdge R740')
    expect(rows[0]?.vendor).toBe('Dell Inc.')
    expect(rows[0]?.esxVersion).toBe('VMware ESXi 7.0.3')
    const bare = adaptRvtoolsVHost(mkSheet('vHost', VHOST_FULL, [vhostRow]))
    expect(bare[0]?.model).toBe('')
    expect(bare[0]?.vendor).toBe('')
    expect(bare[0]?.esxVersion).toBe('')
  })
})

// P9 D-11 / D-09: additive coverage — network sheets present, network sheets
// absent (factual-degrade, no throw), and the vInfo.path round-trip. Does NOT
// touch the MiB canary (canary.test.ts is byte-unchanged).
describe('P9: network sheets present', () => {
  const out = adaptRvtools(
    workbook(
      mkSheet('vInfo', VINFO_FULL, [baseRow]),
      mkSheet('vHost', VHOST_FULL, [vhostRow]),
      mkSheet(
        'vNetwork',
        ['VM', 'Network', 'Switch', 'Adapter', 'Connected', 'Cluster', 'Host'],
        [['vm-a', 'PG-Prod', 'vSwitch0', 'vmxnet3', 'True', 'cluster-a', 'host-a']],
      ),
      mkSheet(
        'vSwitch',
        ['Host', 'Cluster', 'Switch', '# Ports', 'Free Ports', 'MTU'],
        [['host-a', 'cluster-a', 'vSwitch0', 128, 96, 1500]],
      ),
      mkSheet(
        'dvSwitch',
        ['Switch', 'Name', 'Version', 'Host members', '# Ports', '# VMs', 'Max MTU'],
        [['DVS-1', 'prod-dvs', '8.0.0', 'host-a, host-b', 512, 40, 9000]],
      ),
      mkSheet(
        'dvPort',
        ['Port', 'Switch', 'VLAN', 'Active Uplink', 'Standby Uplink'],
        [['dvpg-10', 'DVS-1', '10', 'uplink1', 'uplink2']],
      ),
    ),
  )

  it('adapts vNetwork rows with the expected field values', () => {
    expect(out.vnetwork).toHaveLength(1)
    expect(out.vnetwork[0]).toMatchObject({
      vm: 'vm-a',
      network: 'PG-Prod',
      switch: 'vSwitch0',
      adapter: 'vmxnet3',
      connected: 'True',
      cluster: 'cluster-a',
      host: 'host-a',
    })
  })

  it('adapts switch/port counts as plain numbers (NOT MiB-branded)', () => {
    expect(out.vswitch[0]?.ports).toBe(128)
    expect(out.vswitch[0]?.freePorts).toBe(96)
    expect(out.vswitch[0]?.mtu).toBe(1500)
    expect(typeof out.vswitch[0]?.ports).toBe('number')
    expect(out.dvswitch[0]?.ports).toBe(512)
    expect(out.dvswitch[0]?.vms).toBe(40)
    expect(out.dvswitch[0]?.maxMtu).toBe(9000)
    expect(out.dvport[0]).toMatchObject({ port: 'dvpg-10', switch: 'DVS-1', vlan: '10' })
  })

  it('emits no missing-sheet warning for the network sheets when all are present', () => {
    const missingNet = out.warnings.filter((w) => w.kind === 'missing-sheet').map((w) => w.sheet)
    expect(missingNet).not.toContain('vNetwork')
    expect(missingNet).not.toContain('vSwitch')
    expect(missingNet).not.toContain('dvSwitch')
    expect(missingNet).not.toContain('dvPort')
  })
})

describe('P9: network sheets absent — factual-degrade, no throw', () => {
  it('yields four empty arrays + a missing-sheet warning per absent network sheet, no throw', () => {
    const out = adaptRvtools(
      workbook(mkSheet('vInfo', VINFO_FULL, [baseRow]), mkSheet('vHost', VHOST_FULL, [vhostRow])),
    )
    expect(out.vnetwork).toHaveLength(0)
    expect(out.vswitch).toHaveLength(0)
    expect(out.dvswitch).toHaveLength(0)
    expect(out.dvport).toHaveLength(0)
    const missing = new Set(
      out.warnings.filter((w) => w.kind === 'missing-sheet').map((w) => w.sheet),
    )
    expect(missing.has('vNetwork')).toBe(true)
    expect(missing.has('vSwitch')).toBe(true)
    expect(missing.has('dvSwitch')).toBe(true)
    expect(missing.has('dvPort')).toBe(true)
  })
})

describe('P9 D-09: vInfo.path round-trip', () => {
  it('round-trips the [datastore] vm/vm.vmx token from the Path column', () => {
    const rows = adaptRvtoolsVInfo(
      mkSheet('vInfo', [...VINFO_FULL, 'Path'], [[...baseRow, '[DS_X] vm-a/vm-a.vmx']]),
    )
    expect(rows[0]?.path).toBe('[DS_X] vm-a/vm-a.vmx')
  })

  it('defaults path to "" when the Path column is absent', () => {
    const rows = adaptRvtoolsVInfo(mkSheet('vInfo', VINFO_FULL, [baseRow]))
    expect(rows[0]?.path).toBe('')
  })
})
