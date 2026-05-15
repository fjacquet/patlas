import { cores, mhz, mib, sockets } from '@/engines/units'
import type {
  ParseError,
  VDatastoreRow,
  VHostRow,
  VInfoRow,
  VMetaDataRow,
  VPartitionRow,
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
const VINFO_COLS = {
  vmName: ['vm', 'vm name', 'name', 'nom de la vm', 'vm-name'],
  cluster: ['cluster', 'grappe'],
  host: ['host', 'host name', 'hostname', 'nom hôte'],
  vcpu: ['cpus', '# cpus', 'cpu', 'vcpu', 'vcpus'],
  // RENAMED from vsizer's `vramMb` — encodes the unit (ADR-0010, MB→MiB).
  vramMib: ['memory', 'memory (mb)', 'mem', 'mémoire'],
  cpuReadinessPercent: ['overall cpu readiness', '% cpu readiness', 'cpu readiness'],
  poweredOn: ['powerstate', 'power state', 'état', 'status'],
  // ── NEW for vatlas ──────────────────────────────────────────────────────
  osConfig: ['os according to the configuration file', 'os', 'guest os'],
  osTools: ['os according to the vmware tools', 'guest os full name', 'vmtools os'],
  vmBiosUuid: ['vm uuid', 'bios uuid', 'uuid'],
  vmInstanceUuid: ['vm instance uuid', 'instance uuid'],
  viSdkUuid: ['vi sdk uuid', 'vcenter uuid'],
  viSdkServer: ['vi sdk server', 'vcenter server', 'vcenter'],
  provisionedMib: ['provisioned mb', 'provisioned (mb)', 'provisioned'],
  inUseMib: ['in use mb', 'in use (mb)', 'consumed'],
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
} as const

const VDATASTORE_COLS = {
  name: ['name', 'datastore', 'ds name'],
  capacityMib: ['capacity mb', 'capacity (mb)', 'capacity'],
  freeMib: ['free mb', 'free (mb)', 'free space mb', 'free'],
  provisionedMib: ['provisioned mb', 'provisioned (mb)', 'provisioned'],
  naa: ['address', 'naa', 'url', 'uuid'],
  type: ['type', 'fs type', 'filesystem'],
} as const

const VPARTITION_COLS = {
  vmName: ['vm', 'vm name', 'name'],
  disk: ['disk', 'partition', 'mount', 'disk path'],
  capacityMib: ['capacity mb', 'capacity (mb)', 'capacity'],
  consumedMib: ['consumed mb', 'consumed (mb)', 'consumed', 'used mb'],
  freeMib: ['free mb', 'free (mb)', 'free'],
} as const

const VMETADATA_COLS = {
  property: ['property', 'name', 'key'],
  value: ['value', 'val'],
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
      return {
        vmName: readString(readCol(row, cols.vmName)),
        cluster: readString(readCol(row, cols.cluster)),
        host: readString(readCol(row, cols.host)),
        vcpu: cores(Math.max(0, Math.trunc(readNumber(readCol(row, cols.vcpu))))),
        vramMib: mib(Math.max(0, readNumber(readCol(row, cols.vramMib)))),
        cpuReadinessPercent: parseReadinessCell(readyRaw),
        poweredOn: readString(readCol(row, cols.poweredOn)).toLowerCase() === 'poweredon',
        osConfig: readString(readCol(row, cols.osConfig)),
        osTools: readString(readCol(row, cols.osTools)),
        vmBiosUuid: readString(readCol(row, cols.vmBiosUuid)),
        vmInstanceUuid: readString(readCol(row, cols.vmInstanceUuid)),
        viSdkUuid: readString(readCol(row, cols.viSdkUuid)),
        viSdkServer: readString(readCol(row, cols.viSdkServer)),
        provisionedMib: mib(Math.max(0, readNumber(readCol(row, cols.provisionedMib)))),
        inUseMib: mib(Math.max(0, readNumber(readCol(row, cols.inUseMib)))),
      }
    })
    .filter((r) => !isInternalRow(r.vmName))
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

/**
 * RVTools `vMetaData` is a Property/Value sheet. Reduce it to the two fields
 * vatlas reads (exported timestamp + RVTools version).
 */
export const adaptRvtoolsVMetaData = (sheet: ParsedSheet): VMetaDataRow => {
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
  return { exportedTimestamp, rvtoolsVersion }
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

  return {
    // vinfoSheet/vhostSheet are non-null here: parseError() returns `never`.
    vinfo: adaptRvtoolsVInfo(vinfoSheet as ParsedSheet),
    vhost: adaptRvtoolsVHost(vhostSheet as ParsedSheet),
    vdatastore: dsSheet ? adaptRvtoolsVDatastore(dsSheet) : [],
    vpartition: partSheet ? adaptRvtoolsVPartition(partSheet) : [],
    vmetadata: metaSheet
      ? adaptRvtoolsVMetaData(metaSheet)
      : { exportedTimestamp: null, rvtoolsVersion: null },
    warnings,
  }
}
