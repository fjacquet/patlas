import { cores, mhz, mib, sockets } from '@/engines/units'
import type {
  ParseError,
  VDatastoreRow,
  VDvPortRow,
  VDvSwitchRow,
  VHostRow,
  VInfoRow,
  VMetaDataRow,
  VmUsageRow,
  VNetworkRow,
  VPartitionRow,
  VPowerState,
  VSwitchRow,
} from '@/types'
import type { ParsedSheet, ParsedWorkbook } from '../parseXlsx'
import {
  findColumn,
  findSheet,
  mapColumns,
  readCol,
  readNumber,
  readString,
  toRatio,
} from './columnMap'

/**
 * Throw a structured fatal `ParseError`. `name === 'ParseError'` is the
 * discriminator the worker boundary serializes; `sheet`/`column`/`kind` ride
 * along as own properties (NO `cause` — STRIDE T-04-04).
 */
const parseError = (
  message: string,
  meta: { sheet?: string; column?: string; kind: ParseError['kind'] },
): never => {
  const e = new Error(message) as Error & {
    sheet?: string
    column?: string
    kind?: ParseError['kind']
  }
  e.name = 'ParseError'
  e.sheet = meta.sheet
  e.column = meta.column
  e.kind = meta.kind
  throw e
}

/**
 * RVTools `vInfo` column aliases. RVTools defaults are English; the maps also
 * accept the common French/German translations and the RVTools-version drift
 * spellings (3.10/3.11/4.0/4.4 — RESEARCH.md Pattern 3). First match wins;
 * case is normalised before comparison.
 */
export const VINFO_COLS = {
  vmName: ['vm', 'vm name', 'name', 'nom de la vm', 'vm-name'],
  cluster: ['cluster', 'grappe'],
  host: ['host', 'host name', 'hostname', 'nom hôte'],
  vcpu: ['cpus', '# cpus', 'cpu', 'vcpu', 'vcpus'],
  // RENAMED from vsizer's `vramMb` — encodes the unit (ADR-0010, MB→MiB).
  vramMib: ['memory', 'memory (mb)', 'mem', 'mémoire'],
  cpuReadinessPercent: ['overall cpu readiness', '% cpu readiness', 'cpu readiness'],
  poweredOn: ['powerstate', 'power state', 'état', 'status'],
  // P5: exact powered-state enum (RVTools emits poweredOn/poweredOff/
  // suspended). Same source column as `poweredOn`; `poweredOn` stays a
  // derived boolean so existing consumers are unaffected.
  powerState: ['powerstate', 'power state', 'état', 'status'],
  // P5: RVTools vInfo `Template` (TRUE/FALSE). Absent → false (factual).
  template: ['template'],
  // ── NEW for vatlas ──────────────────────────────────────────────────────
  osConfig: ['os according to the configuration file', 'os', 'guest os'],
  osTools: ['os according to the vmware tools', 'guest os full name', 'vmtools os'],
  vmBiosUuid: ['vm uuid', 'bios uuid', 'uuid'],
  vmInstanceUuid: ['vm instance uuid', 'instance uuid'],
  viSdkUuid: ['vi sdk uuid', 'vcenter uuid'],
  viSdkServer: ['vi sdk server', 'vcenter server', 'vcenter'],
  // RVTools ≥4.x emits MiB-suffixed headers ("Provisioned MiB", "In Use
  // MiB"); pre-4.x used "… MB". MiB spelling listed first so the exact match
  // wins (matching is exact-normalized, not substring — a bare 'provisioned'
  // never matched 'provisioned mib'). This is the A7 / PITFALLS-Moderate-1
  // alias-drift fix.
  provisionedMib: ['provisioned mib', 'provisioned mb', 'provisioned (mb)', 'provisioned'],
  inUseMib: ['in use mib', 'in use mb', 'in use (mb)', 'consumed'],
  // P9 D-09: the `[datastore] vm/vm.vmx` token — the ONLY blank-`Cluster
  // name` datastore→cluster identity path. Empty when absent (factual).
  path: ['path'],
} as const

// ── P-RS: OPTIONAL vMemory/vCPU runtime-metric sheets ──────────────────────
// Exact-normalized match, MiB-suffix drift (… MiB before … MB), longest
// spelling first — the rvtools.ts convention. Identity columns mirror VINFO.
const VMEMORY_COLS = {
  vmName: ['vm', 'vm name', 'name'],
  cluster: ['cluster', 'grappe'],
  vmBiosUuid: ['vm uuid', 'bios uuid', 'uuid'],
  vmInstanceUuid: ['vm instance uuid', 'instance uuid'],
  activeMib: ['active mib', 'active mb', 'active'],
  consumedMib: ['consumed mib', 'consumed mb', 'consumed'],
  balloonedMib: ['ballooned mib', 'ballooned mb', 'ballooned', 'balloon'],
  swappedMib: ['swapped mib', 'swapped mb', 'swapped'],
} as const

const VCPU_COLS = {
  vmName: ['vm', 'vm name', 'name'],
  cluster: ['cluster', 'grappe'],
  vmBiosUuid: ['vm uuid', 'bios uuid', 'uuid'],
  vmInstanceUuid: ['vm instance uuid', 'instance uuid'],
  cpuUsageMhz: ['overall cpu usage', 'cpu usage mhz', 'cpu usage', 'usage mhz'],
} as const

// ── P9 D-11: OPTIONAL network sheets ───────────────────────────────────────
// Real RVTools 4.x headers (09-RESEARCH §Code Examples). 3.x drift is
// defended with conservative aliases (Assumption A1); exact-normalized,
// longest spelling first (the rvtools.ts convention).
const VNETWORK_COLS = {
  vm: ['vm', 'vm name', 'name'],
  network: ['network', 'port group', 'portgroup'],
  switch: ['switch', 'virtual switch', 'vswitch'],
  adapter: ['adapter', 'nic', 'nic label'],
  connected: ['connected', 'connectivity'],
  cluster: ['cluster', 'grappe'],
  host: ['host', 'host name', 'hostname'],
} as const

const VSWITCH_COLS = {
  host: ['host', 'host name', 'hostname'],
  cluster: ['cluster', 'grappe'],
  switch: ['switch', 'virtual switch', 'vswitch'],
  ports: ['# ports', 'num ports', 'ports'],
  freePorts: ['free ports', '# free ports'],
  mtu: ['mtu'],
} as const

const VDVSWITCH_COLS = {
  switch: ['switch', 'dvswitch'],
  name: ['name'],
  version: ['version'],
  hostMembers: ['host members', 'hosts', '# hosts'],
  ports: ['# ports', 'num ports', 'ports'],
  vms: ['# vms', 'num vms', 'vms'],
  maxMtu: ['max mtu', 'mtu'],
} as const

const VDVPORT_COLS = {
  port: ['port', 'portgroup', 'port group'],
  switch: ['switch', 'dvswitch'],
  vlan: ['vlan', 'vlan id'],
  activeUplink: ['active uplink', 'active uplinks'],
  standbyUplink: ['standby uplink', 'standby uplinks'],
} as const

const VHOST_COLS = {
  hostName: ['host', 'host name', 'hostname', 'nom hôte'],
  cluster: ['cluster', 'grappe'],
  // Physical CPU socket count. RVTools `vHost.# CPU`.
  sockets: ['# cpu', 'cpus', '# cpus', 'sockets', '# sockets'],
  cores: ['# cores', 'cores', 'core count', 'cœurs'],
  speedMhz: ['speed', 'speed (mhz)', 'cpu speed', 'vitesse'],
  // RENAMED from vsizer's `memoryMb` (ADR-0010, MB→MiB).
  memoryMib: ['# memory', 'memory', 'mémoire', 'mémoire (mo)', 'mem'],
  cpuRatio: ['cpu usage %', '# cpu usage %', '% cpu', 'cpu %', 'cpu usage', 'cpu use %'],
  ramRatio: [
    'memory usage %',
    '# memory usage %',
    'mem usage %',
    '# mem usage %',
    '% memory',
    'memory %',
    'mem usage',
    'mem use %',
  ],
  // STR-02/03 stretched-cluster site key. Exact-normalized match, longest
  // spelling first (the rvtools.ts convention). Empty string when absent or
  // the host is untagged — never `undefined`. Consumed by Plan 04-02.
  faultDomain: ['vsan fault domain name', 'fault domain name'],
  // P5: factual host hardware identity + ESXi version. Plain text only —
  // NO lifecycle verdict (vendor EOS not in RVTools; ESXi support-state is
  // Phase 7). Empty string when absent.
  model: ['model', 'host model'],
  vendor: ['vendor'],
  // Physical chassis identity for move/replacement prep. Two raw columns so
  // the normalizer can coalesce per row (Serial number wins, Service tag is
  // the fallback). Longest/most-specific spelling first.
  serial: ['serial number', 'serial no', 'serial'],
  serviceTag: ['service tag (serial #)', 'service tag', 'servicetag'],
  esxVersion: ['esx version', 'esxi version', 'version'],
} as const

const VDATASTORE_COLS = {
  name: ['name', 'datastore', 'ds name'],
  // MiB-suffixed (RVTools ≥4.x) first; '… mb' kept for pre-4.x exports.
  capacityMib: ['capacity mib', 'capacity mb', 'capacity (mb)', 'capacity'],
  freeMib: ['free mib', 'free mb', 'free (mb)', 'free space mb', 'free'],
  provisionedMib: ['provisioned mib', 'provisioned mb', 'provisioned (mb)', 'provisioned'],
  naa: ['address', 'naa', 'url', 'uuid'],
  type: ['type', 'fs type', 'filesystem'],
  // Real RVTools exports DO carry a `Cluster name` column on vDatastore
  // (verified against production workbooks); 'cluster' kept as a drift
  // fallback. Exact-normalized match (MiB-style), longest spelling first.
  clusterName: ['cluster name', 'cluster'],
  // Pitfall-6 prerequisite: the host-name list a datastore is mounted on.
  // Used by Plan 04-02 to attribute vSAN/host-local datastores (blank
  // `Cluster name`) to their cluster. Longest spelling first.
  hosts: ['# hosts', 'hosts'],
} as const

const VPARTITION_COLS = {
  vmName: ['vm', 'vm name', 'name'],
  disk: ['disk', 'partition', 'mount', 'disk path'],
  // MiB-suffixed (RVTools ≥4.x) first; '… mb' kept for pre-4.x exports.
  capacityMib: ['capacity mib', 'capacity mb', 'capacity (mb)', 'capacity'],
  consumedMib: ['consumed mib', 'consumed mb', 'consumed (mb)', 'consumed', 'used mb'],
  freeMib: ['free mib', 'free mb', 'free (mb)', 'free'],
} as const

// Legacy pre-4.x `vMetaData` is a 2-column Property/Value sheet.
const VMETADATA_COLS = {
  property: ['property', 'name', 'key'],
  value: ['value', 'val'],
} as const

// RVTools 4.x `vMetaData` is COLUMNAR — one row per vCenter. The presence of
// an `RVTools version` column (NOT `RVTools major version`, which also exists
// but is just the major digit) is the discriminator (RESEARCH Pitfall 3).
const VMETADATA_COLUMNAR_COLS = {
  rvtoolsVersion: ['rvtools version'],
  exportedTimestamp: ['xlsx creation datetime', 'exported timestamp', 'creation date'],
  server: ['server', 'vcenter server', 'vcenter'],
} as const

/**
 * Strict parser for the `Overall Cpu Readiness` cell. `null` (column absent /
 * blank / sentinel / Excel error) vs a real ≥0 measurement — never coerce a
 * corrupt cell to `0` ("VM healthy"), per ADR-0012.
 */
const parseReadinessCell = (v: unknown): number | null => {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? Math.max(0, v) : null
  if (typeof v === 'string') {
    const trimmed = v.trim()
    if (trimmed === '') return null
    if (trimmed.startsWith('#')) return null
    const upper = trimmed.toUpperCase()
    if (upper === '-' || upper === '--' || upper === 'N/A' || upper === 'NA') return null
    const cleaned = trimmed.replace(/[\s']/g, '').replace(/%$/, '').replace(',', '.')
    const n = Number.parseFloat(cleaned)
    return Number.isFinite(n) ? Math.max(0, n) : null
  }
  return null
}

/**
 * Strict nullable numeric cell for vMemory/vCPU metrics. blank / sentinel
 * (`-`, `N/A`) / Excel error (`#…`) / absent column → `null` ("not derivable",
 * ADR-0012) — NEVER coerced to 0 ("VM idle"). Mirrors `parseReadinessCell`.
 */
const parseUsageCell = (v: unknown): number | null => {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? Math.max(0, v) : null
  if (typeof v === 'string') {
    const t = v.trim()
    if (t === '' || t.startsWith('#')) return null
    const u = t.toUpperCase()
    if (u === '-' || u === '--' || u === 'N/A' || u === 'NA') return null
    const n = Number.parseFloat(t.replace(/[\s']/g, '').replace(/%$/, '').replace(',', '.'))
    return Number.isFinite(n) ? Math.max(0, n) : null
  }
  return null
}

/** RVTools internal summary rows (`Total`, `Summary`, blank primary id). */
const isInternalRow = (vmName: string): boolean => vmName === '' || /^total|^summary/i.test(vmName)

export const adaptRvtoolsVInfo = (sheet: ParsedSheet): VInfoRow[] => {
  const cols = mapColumns(sheet.headers, VINFO_COLS)
  if (findColumn(sheet.headers, VINFO_COLS.vcpu) === undefined) {
    parseError(
      "missing required column `# CPUs` in vInfo (accepted aliases: 'CPUs', 'CPU', " +
        "'vCPU', 'vCPUs'); did you export from RVTools 3.9 or older?",
      { sheet: 'vInfo', column: 'vcpu', kind: 'missing-column' },
    )
  }
  return sheet.rows
    .map((row): VInfoRow => {
      const readyRaw = readCol(row, cols.cpuReadinessPercent)
      // P5: exact powered-state enum; poweredOn DERIVED so no consumer breaks.
      const psRaw = readString(readCol(row, cols.powerState)).toLowerCase().replace(/\s+/g, '')
      const powerState: VPowerState =
        psRaw === 'poweredon' ? 'poweredOn' : psRaw === 'suspended' ? 'suspended' : 'poweredOff'
      const templateRaw = readString(readCol(row, cols.template)).toLowerCase()
      return {
        vmName: readString(readCol(row, cols.vmName)),
        cluster: readString(readCol(row, cols.cluster)),
        host: readString(readCol(row, cols.host)),
        vcpu: cores(Math.max(0, Math.trunc(readNumber(readCol(row, cols.vcpu))))),
        vramMib: mib(Math.max(0, readNumber(readCol(row, cols.vramMib)))),
        cpuReadinessPercent: parseReadinessCell(readyRaw),
        powerState,
        template: templateRaw === 'true',
        poweredOn: powerState === 'poweredOn',
        osConfig: readString(readCol(row, cols.osConfig)),
        osTools: readString(readCol(row, cols.osTools)),
        vmBiosUuid: readString(readCol(row, cols.vmBiosUuid)),
        vmInstanceUuid: readString(readCol(row, cols.vmInstanceUuid)),
        viSdkUuid: readString(readCol(row, cols.viSdkUuid)),
        viSdkServer: readString(readCol(row, cols.viSdkServer)),
        provisionedMib: mib(Math.max(0, readNumber(readCol(row, cols.provisionedMib)))),
        inUseMib: mib(Math.max(0, readNumber(readCol(row, cols.inUseMib)))),
        path: readString(readCol(row, cols.path)),
      }
    })
    .filter((r) => !isInternalRow(r.vmName))
}

/** Identity key for joining vMemory/vCPU rows to a VM (mirrors the merge
 *  key order: instance uuid → bios uuid → name+cluster). */
const usageIdentity = (r: {
  vmInstanceUuid: string
  vmBiosUuid: string
  vmName: string
  cluster: string
}): string => r.vmInstanceUuid || r.vmBiosUuid || `${r.vmName}::${r.cluster}`

export const adaptRvtoolsVMemory = (sheet: ParsedSheet): VmUsageRow[] => {
  const cols = mapColumns(sheet.headers, VMEMORY_COLS)
  return sheet.rows
    .map((row): VmUsageRow => {
      const a = parseUsageCell(readCol(row, cols.activeMib))
      const c = parseUsageCell(readCol(row, cols.consumedMib))
      const b = parseUsageCell(readCol(row, cols.balloonedMib))
      const s = parseUsageCell(readCol(row, cols.swappedMib))
      return {
        vmName: readString(readCol(row, cols.vmName)),
        cluster: readString(readCol(row, cols.cluster)),
        vmBiosUuid: readString(readCol(row, cols.vmBiosUuid)),
        vmInstanceUuid: readString(readCol(row, cols.vmInstanceUuid)),
        activeMib: a === null ? null : mib(a),
        consumedMib: c === null ? null : mib(c),
        balloonedMib: b === null ? null : mib(b),
        swappedMib: s === null ? null : mib(s),
        cpuUsageMhz: null,
      }
    })
    .filter((r) => !isInternalRow(r.vmName))
}

export const adaptRvtoolsVCpu = (sheet: ParsedSheet): VmUsageRow[] => {
  const cols = mapColumns(sheet.headers, VCPU_COLS)
  return sheet.rows
    .map((row): VmUsageRow => {
      const u = parseUsageCell(readCol(row, cols.cpuUsageMhz))
      return {
        vmName: readString(readCol(row, cols.vmName)),
        cluster: readString(readCol(row, cols.cluster)),
        vmBiosUuid: readString(readCol(row, cols.vmBiosUuid)),
        vmInstanceUuid: readString(readCol(row, cols.vmInstanceUuid)),
        activeMib: null,
        consumedMib: null,
        balloonedMib: null,
        swappedMib: null,
        cpuUsageMhz: u === null ? null : mhz(u),
      }
    })
    .filter((r) => !isInternalRow(r.vmName))
}

/** Union the two optional sheets by VM identity into one usage row per VM.
 *  vMemory carries the memory metrics; vCPU contributes `cpuUsageMhz`. */
const mergeUsage = (mem: VmUsageRow[], cpu: VmUsageRow[]): VmUsageRow[] => {
  const byId = new Map<string, VmUsageRow>()
  for (const r of mem) byId.set(usageIdentity(r), r)
  for (const r of cpu) {
    const id = usageIdentity(r)
    const prev = byId.get(id)
    if (prev) prev.cpuUsageMhz = r.cpuUsageMhz
    else byId.set(id, r)
  }
  return [...byId.values()]
}

export const adaptRvtoolsVHost = (sheet: ParsedSheet): VHostRow[] => {
  const cols = mapColumns(sheet.headers, VHOST_COLS)
  return sheet.rows
    .map(
      (row): VHostRow => ({
        hostName: readString(readCol(row, cols.hostName)),
        cluster: readString(readCol(row, cols.cluster)),
        sockets: sockets(Math.max(1, Math.trunc(readNumber(readCol(row, cols.sockets))))),
        cores: cores(Math.max(1, Math.trunc(readNumber(readCol(row, cols.cores))))),
        speedMhz: mhz(Math.max(1, readNumber(readCol(row, cols.speedMhz)))),
        memoryMib: mib(Math.max(0, readNumber(readCol(row, cols.memoryMib)))),
        cpuRatio: toRatio(readNumber(readCol(row, cols.cpuRatio))),
        ramRatio: toRatio(readNumber(readCol(row, cols.ramRatio))),
        faultDomain: readString(readCol(row, cols.faultDomain)),
        model: readString(readCol(row, cols.model)),
        vendor: readString(readCol(row, cols.vendor)),
        serialNumber:
          readString(readCol(row, cols.serial)) || readString(readCol(row, cols.serviceTag)),
        esxVersion: readString(readCol(row, cols.esxVersion)),
      }),
    )
    .filter((r) => !isInternalRow(r.hostName))
}

export const adaptRvtoolsVDatastore = (sheet: ParsedSheet): VDatastoreRow[] => {
  const cols = mapColumns(sheet.headers, VDATASTORE_COLS)
  return sheet.rows
    .map((row): VDatastoreRow => {
      const naa = readString(readCol(row, cols.naa))
      return {
        name: readString(readCol(row, cols.name)),
        capacityMib: mib(Math.max(0, readNumber(readCol(row, cols.capacityMib)))),
        freeMib: mib(Math.max(0, readNumber(readCol(row, cols.freeMib)))),
        provisionedMib: mib(Math.max(0, readNumber(readCol(row, cols.provisionedMib)))),
        naa: naa === '' ? null : naa,
        type: readString(readCol(row, cols.type)),
        hosts: readString(readCol(row, cols.hosts)),
        clusterName: readString(readCol(row, cols.clusterName)),
      }
    })
    .filter((r) => !isInternalRow(r.name))
}

export const adaptRvtoolsVPartition = (sheet: ParsedSheet): VPartitionRow[] => {
  const cols = mapColumns(sheet.headers, VPARTITION_COLS)
  return sheet.rows
    .map(
      (row): VPartitionRow => ({
        vmName: readString(readCol(row, cols.vmName)),
        disk: readString(readCol(row, cols.disk)),
        capacityMib: mib(Math.max(0, readNumber(readCol(row, cols.capacityMib)))),
        consumedMib: mib(Math.max(0, readNumber(readCol(row, cols.consumedMib)))),
        freeMib: mib(Math.max(0, readNumber(readCol(row, cols.freeMib)))),
      }),
    )
    .filter((r) => !isInternalRow(r.vmName))
}

// P9 D-11: counts are plain non-negative integers — NEVER mib()/MibSchema.
const nonNegInt = (v: unknown): number => Math.max(0, Math.trunc(readNumber(v)))

export const adaptRvtoolsVNetwork = (sheet: ParsedSheet): VNetworkRow[] => {
  const cols = mapColumns(sheet.headers, VNETWORK_COLS)
  return sheet.rows
    .map(
      (row): VNetworkRow => ({
        vm: readString(readCol(row, cols.vm)),
        network: readString(readCol(row, cols.network)),
        switch: readString(readCol(row, cols.switch)),
        adapter: readString(readCol(row, cols.adapter)),
        connected: readString(readCol(row, cols.connected)),
        cluster: readString(readCol(row, cols.cluster)),
        host: readString(readCol(row, cols.host)),
      }),
    )
    .filter((r) => !isInternalRow(r.vm))
}

export const adaptRvtoolsVSwitch = (sheet: ParsedSheet): VSwitchRow[] => {
  const cols = mapColumns(sheet.headers, VSWITCH_COLS)
  return sheet.rows
    .map(
      (row): VSwitchRow => ({
        host: readString(readCol(row, cols.host)),
        cluster: readString(readCol(row, cols.cluster)),
        switch: readString(readCol(row, cols.switch)),
        ports: nonNegInt(readCol(row, cols.ports)),
        freePorts: nonNegInt(readCol(row, cols.freePorts)),
        mtu: nonNegInt(readCol(row, cols.mtu)),
      }),
    )
    .filter((r) => !isInternalRow(r.host))
}

export const adaptRvtoolsDvSwitch = (sheet: ParsedSheet): VDvSwitchRow[] => {
  const cols = mapColumns(sheet.headers, VDVSWITCH_COLS)
  return sheet.rows
    .map(
      (row): VDvSwitchRow => ({
        switch: readString(readCol(row, cols.switch)),
        name: readString(readCol(row, cols.name)),
        version: readString(readCol(row, cols.version)),
        hostMembers: readString(readCol(row, cols.hostMembers)),
        ports: nonNegInt(readCol(row, cols.ports)),
        vms: nonNegInt(readCol(row, cols.vms)),
        maxMtu: nonNegInt(readCol(row, cols.maxMtu)),
      }),
    )
    .filter((r) => !isInternalRow(r.switch))
}

export const adaptRvtoolsDvPort = (sheet: ParsedSheet): VDvPortRow[] => {
  const cols = mapColumns(sheet.headers, VDVPORT_COLS)
  return sheet.rows
    .map(
      (row): VDvPortRow => ({
        port: readString(readCol(row, cols.port)),
        switch: readString(readCol(row, cols.switch)),
        vlan: readString(readCol(row, cols.vlan)),
        activeUplink: readString(readCol(row, cols.activeUplink)),
        standbyUplink: readString(readCol(row, cols.standbyUplink)),
      }),
    )
    .filter((r) => !isInternalRow(r.port))
}

/**
 * Adapt the RVTools `vMetaData` sheet to a per-vCenter entry list.
 *
 * RVTools 4.x emits a COLUMNAR sheet (headers
 * `["RVTools major version","RVTools version","xlsx creation datetime","Server"]`)
 * with one row per vCenter — a single 3-vCenter workbook yields 3 entries.
 * Pre-4.x emits a 2-column Property/Value sheet which collapses to ONE entry
 * with an empty `server`. The presence of an `RVTools version` COLUMN is the
 * discriminator (RESEARCH Pitfall 3 — fixes the wrong "3.11+" for 4.7 files).
 */
export const adaptRvtoolsVMetaData = (sheet: ParsedSheet): VMetaDataRow => {
  // Columnar 4.x shape: an explicit `RVTools version` column is present.
  if (findColumn(sheet.headers, VMETADATA_COLUMNAR_COLS.rvtoolsVersion) !== undefined) {
    const cols = mapColumns(sheet.headers, VMETADATA_COLUMNAR_COLS)
    const entries = sheet.rows
      .map((row) => {
        const rv = readString(readCol(row, cols.rvtoolsVersion))
        const ts = readString(readCol(row, cols.exportedTimestamp))
        const server = readString(readCol(row, cols.server))
        return {
          server,
          rvtoolsVersion: rv === '' ? null : rv,
          exportedTimestamp: ts === '' ? null : ts,
        }
      })
      // Drop RVTools internal Total/blank rows (no version AND no server).
      .filter((e) => e.rvtoolsVersion !== null || e.server !== '')
    return { entries }
  }

  // Legacy Property/Value shape → single collapsed entry.
  const cols = mapColumns(sheet.headers, VMETADATA_COLS)
  let exportedTimestamp: string | null = null
  let rvtoolsVersion: string | null = null
  for (const row of sheet.rows) {
    const prop = readString(readCol(row, cols.property)).toLowerCase()
    const value = readString(readCol(row, cols.value))
    if (value === '') continue
    if (prop.includes('exported')) exportedTimestamp = value
    else if (prop.includes('rvtools') && prop.includes('version')) rvtoolsVersion = value
  }
  return { entries: [{ server: '', rvtoolsVersion, exportedTimestamp }] }
}

/**
 * Adapt an entire RVTools workbook. REQUIRED sheets (`vInfo`, `vHost`)
 * missing → throw a structured `ParseError`. OPTIONAL sheets (`vDatastore`,
 * `vPartition`, `vMetaData`) missing → empty array + a collected warning.
 */
export const adaptRvtools = (
  workbook: ParsedWorkbook,
): {
  vinfo: VInfoRow[]
  vhost: VHostRow[]
  vdatastore: VDatastoreRow[]
  vpartition: VPartitionRow[]
  vnetwork: VNetworkRow[]
  vswitch: VSwitchRow[]
  dvswitch: VDvSwitchRow[]
  dvport: VDvPortRow[]
  vmUsage: VmUsageRow[]
  vmetadata: VMetaDataRow
  warnings: ParseError[]
} => {
  const warnings: ParseError[] = []

  const vinfoSheet = findSheet(workbook, ['vinfo', 'rvtools_tabvinfo'])
  if (!vinfoSheet) {
    const present = [...workbook.sheets.keys()].sort().join(', ')
    parseError(`missing sheet: vInfo (workbook contained: ${present})`, {
      sheet: 'vInfo',
      kind: 'missing-sheet',
    })
  }

  const vhostSheet = findSheet(workbook, ['vhost', 'rvtools_tabvhost'])
  if (!vhostSheet) {
    const present = [...workbook.sheets.keys()].sort().join(', ')
    parseError(`missing sheet: vHost (workbook contained: ${present})`, {
      sheet: 'vHost',
      kind: 'missing-sheet',
    })
  }

  const dsSheet = findSheet(workbook, ['vdatastore', 'rvtools_tabvdatastore'])
  if (!dsSheet) {
    warnings.push({
      sheet: 'vDatastore',
      kind: 'missing-sheet',
      message: 'optional sheet vDatastore absent — datastore views will be empty',
    })
  }

  const partSheet = findSheet(workbook, ['vpartition', 'rvtools_tabvpartition'])
  if (!partSheet) {
    warnings.push({
      sheet: 'vPartition',
      kind: 'missing-sheet',
      message: 'optional sheet vPartition absent — guest-disk views will be empty',
    })
  }

  const metaSheet = findSheet(workbook, ['vmetadata', 'rvtools_tabvmetadata'])
  if (!metaSheet) {
    warnings.push({
      sheet: 'vMetaData',
      kind: 'missing-sheet',
      message: 'optional sheet vMetaData absent — version/timestamp inferred from filename',
    })
  }

  // P9 D-11: the four network sheets are OPTIONAL. Absent ⇒ collected
  // warning + [] (factual-degrade) — NEVER the REQUIRED-sheet parseError()
  // path. A real 8-sheet export has none of these (09-RESEARCH Pitfall 1).
  const netSheet = findSheet(workbook, ['vnetwork', 'rvtools_tabvnetwork'])
  if (!netSheet) {
    warnings.push({
      sheet: 'vNetwork',
      kind: 'missing-sheet',
      message: 'optional sheet vNetwork absent — network inventory will be empty',
    })
  }

  const swSheet = findSheet(workbook, ['vswitch', 'rvtools_tabvswitch'])
  if (!swSheet) {
    warnings.push({
      sheet: 'vSwitch',
      kind: 'missing-sheet',
      message: 'optional sheet vSwitch absent — network inventory will be empty',
    })
  }

  const dvswSheet = findSheet(workbook, ['dvswitch', 'rvtools_tabdvswitch'])
  if (!dvswSheet) {
    warnings.push({
      sheet: 'dvSwitch',
      kind: 'missing-sheet',
      message: 'optional sheet dvSwitch absent — network inventory will be empty',
    })
  }

  const dvportSheet = findSheet(workbook, ['dvport', 'rvtools_tabdvport'])
  if (!dvportSheet) {
    warnings.push({
      sheet: 'dvPort',
      kind: 'missing-sheet',
      message: 'optional sheet dvPort absent — network inventory will be empty',
    })
  }

  // P-RS: OPTIONAL vMemory/vCPU runtime-metric sheets. Absent ⇒ collected
  // warning + [] (factual-degrade) — NEVER the REQUIRED-sheet parseError path.
  // The right-sizing view/slide degrade gracefully when usage data is absent.
  const vmemSheet = findSheet(workbook, ['vmemory', 'rvtools_tabvmemory'])
  if (!vmemSheet) {
    warnings.push({
      sheet: 'vMemory',
      kind: 'missing-sheet',
      message: 'optional sheet vMemory absent — memory utilization/ballooning unavailable',
    })
  }

  const vcpuSheet = findSheet(workbook, ['vcpu', 'rvtools_tabvcpu'])
  if (!vcpuSheet) {
    warnings.push({
      sheet: 'vCPU',
      kind: 'missing-sheet',
      message: 'optional sheet vCPU absent — CPU utilization unavailable',
    })
  }

  return {
    // vinfoSheet/vhostSheet are non-null here: parseError() returns `never`.
    vinfo: adaptRvtoolsVInfo(vinfoSheet as ParsedSheet),
    vhost: adaptRvtoolsVHost(vhostSheet as ParsedSheet),
    vdatastore: dsSheet ? adaptRvtoolsVDatastore(dsSheet) : [],
    vpartition: partSheet ? adaptRvtoolsVPartition(partSheet) : [],
    vnetwork: netSheet ? adaptRvtoolsVNetwork(netSheet) : [],
    vswitch: swSheet ? adaptRvtoolsVSwitch(swSheet) : [],
    dvswitch: dvswSheet ? adaptRvtoolsDvSwitch(dvswSheet) : [],
    dvport: dvportSheet ? adaptRvtoolsDvPort(dvportSheet) : [],
    vmUsage: mergeUsage(
      vmemSheet ? adaptRvtoolsVMemory(vmemSheet) : [],
      vcpuSheet ? adaptRvtoolsVCpu(vcpuSheet) : [],
    ),
    vmetadata: metaSheet ? adaptRvtoolsVMetaData(metaSheet) : { entries: [] },
    warnings,
  }
}
