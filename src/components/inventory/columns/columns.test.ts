import { describe, expect, it } from 'vitest'
import { buildEstateView } from '@/engines/aggregation/estateView'
import { bytes, cores, mhz, mib, sockets } from '@/engines/units'
import { first } from '@/test/arrays'
import type { VmDisplayRow } from '@/types/estate'
import type { Snapshot } from '@/types/snapshot'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import { datastoreColumns, datastoreDefaultVisible } from './datastoreColumns'
import { esxColumns, esxDefaultVisible } from './esxColumns'
import { vmColumns } from './vmColumns'

// The set of valid `VmDisplayRow` keys — a column may reference ONLY
// these (referencing an OS-family count field is the Pitfall-1 sign).
const VM_ROW_KEYS: ReadonlySet<string> = new Set<keyof VmDisplayRow>([
  'vmName',
  'cluster',
  'host',
  'vcpu',
  'vramMib',
  'os',
  'poweredOn',
  'provisionedMib',
])

// The forbidden OS-family count fields (the "OsBreakdown" interface) —
// the VM table is a projection, not the OS-family donut.
const OS_FAMILY_FIELDS = ['windows', 'linux', 'other']

const accessorId = (c: { id?: string }): string => {
  if (typeof c.id !== 'string') throw new Error('every column must declare a string id')
  return c.id
}

describe('vmColumns (INV-02 — bound to projected VmDisplayRow)', () => {
  it('every column id is a VmDisplayRow key (no OS-family count fields)', () => {
    for (const col of vmColumns) {
      const id = accessorId(col)
      expect(VM_ROW_KEYS.has(id)).toBe(true)
      expect(OS_FAMILY_FIELDS).not.toContain(id)
    }
  })

  it('the vmName identity column is not hideable', () => {
    const idCol = vmColumns.find((c) => c.id === 'vmName')
    expect(idCol).toBeDefined()
    expect(idCol?.enableHiding).toBe(false)
  })

  it('every non-identity column is hideable by default (column-picker reachable)', () => {
    for (const col of vmColumns) {
      if (col.id !== 'vmName') expect(col.enableHiding).not.toBe(false)
    }
  })
})

describe('esxColumns (INV-03 — EstateView.hosts verbatim)', () => {
  it('the hostName identity column is not hideable', () => {
    const idCol = esxColumns.find((c) => c.id === 'hostName')
    expect(idCol).toBeDefined()
    expect(idCol?.enableHiding).toBe(false)
  })

  it('esxDefaultVisible ids are all real esx column ids', () => {
    const ids = new Set(esxColumns.map(accessorId))
    for (const id of esxDefaultVisible) expect(ids.has(id)).toBe(true)
  })
})

describe('datastoreColumns (INV-04 — EstateView.datastores verbatim, scope-agnostic)', () => {
  it('the key (NAA dedupe key) identity column is not hideable', () => {
    const idCol = datastoreColumns.find((c) => c.id === 'key')
    expect(idCol).toBeDefined()
    expect(idCol?.enableHiding).toBe(false)
  })

  it('exposes NO scoping column (no id contains "cluster")', () => {
    for (const col of datastoreColumns) {
      expect(accessorId(col).toLowerCase()).not.toContain('cluster')
    }
  })

  it('datastoreDefaultVisible ids are all real datastore column ids', () => {
    const ids = new Set(datastoreColumns.map(accessorId))
    for (const id of datastoreDefaultVisible) expect(ids.has(id)).toBe(true)
  })
})

// ── NAA-preserved assertion ───────────────────────────────────────────
// Drive buildEstateView on a shared-LUN fixture (same `naa` across two
// clusters) and assert the datastore table consumes ONE deduped row with
// sharedDuplicateCount > 1 — proving no re-derivation widened the dedupe
// (Moderate-11 / 03-RESEARCH Anti-Pattern line 232 / ROADMAP Phase-3 #5).

const host = (over: Partial<VHostRow>): VHostRow => ({
  hostName: 'esx-1',
  cluster: 'C1',
  sockets: sockets(2),
  cores: cores(12),
  speedMhz: mhz(2600),
  memoryMib: mib(262_144),
  cpuRatio: 0.3,
  ramRatio: 0.5,
  ...over,
})

const vm = (over: Partial<VInfoRow>): VInfoRow => ({
  vmName: 'vm',
  cluster: 'C1',
  host: 'esx-1',
  vcpu: cores(4),
  vramMib: mib(8192),
  cpuReadinessPercent: null,
  poweredOn: true,
  osConfig: 'Ubuntu Linux (64-bit)',
  osTools: '',
  vmBiosUuid: '',
  vmInstanceUuid: '',
  viSdkUuid: '',
  viSdkServer: '',
  provisionedMib: mib(40_960),
  inUseMib: mib(20_480),
  ...over,
})

// Shared LUN `naa.s` appears under TWO clusters' datastore views.
const sharedLunSnapshot = (): Snapshot => ({
  id: 's1',
  filename: 'fixture.xlsx',
  fileSize: bytes(1024),
  capturedAt: new Date('2026-01-01'),
  vCenterLabel: 'vc',
  rvtoolsVersion: '4.4',
  parsedAt: new Date('2026-01-02'),
  source: 'rvtools',
  viSdkUuid: null,
  vhost: [host({}), host({ hostName: 'esx-2', cluster: 'C2' })],
  vinfo: [
    vm({ vmName: 'on-1', cluster: 'C1', host: 'esx-1' }),
    vm({ vmName: 'on-2', cluster: 'C2', host: 'esx-2' }),
  ],
  vdatastore: [
    {
      name: 'ds-shared',
      capacityMib: mib(1000),
      freeMib: mib(400),
      provisionedMib: mib(800),
      naa: 'naa.s',
      type: 'VMFS',
    },
    {
      name: 'ds-shared-clusterview',
      capacityMib: mib(1000),
      freeMib: mib(400),
      provisionedMib: mib(800),
      naa: 'naa.s',
      type: 'VMFS',
    },
    {
      name: 'ds-local',
      capacityMib: mib(500),
      freeMib: mib(100),
      provisionedMib: mib(450),
      naa: 'naa.t',
      type: 'NFS',
    },
  ],
  vpartition: [],
  parseErrors: [],
})

describe('datastore table consumes NAA dedupe verbatim (Moderate-11 / ROADMAP #5)', () => {
  it('a shared LUN is ONE row with sharedDuplicateCount > 1 — never re-derived', () => {
    const view = buildEstateView(sharedLunSnapshot(), 'active')
    // perDatastore already deduped: naa.s + naa.t = 2 entries.
    expect(view.datastores).toHaveLength(2)
    const shared = view.datastores.find((d) => d.key === 'naa.s')
    expect(shared).toBeDefined()
    expect(shared?.sharedDuplicateCount).toBeGreaterThan(1)
    // Capacity taken from the FIRST row, NEVER summed (no double-count).
    expect(shared?.capacityMib as number).toBe(1000)
    // The datastore table binds these rows verbatim — the identity
    // accessor is the dedupe `key`, so the table surfaces exactly one
    // row for the shared LUN (the ColumnDef does not re-key/re-group).
    const keyCol = first(datastoreColumns.filter((c) => c.id === 'key'))
    expect(keyCol.enableHiding).toBe(false)
    const sharedRows = view.datastores.filter((d) => d.key === 'naa.s')
    expect(sharedRows).toHaveLength(1)
  })
})
