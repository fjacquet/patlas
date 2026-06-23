import { cores, mhz, sockets } from '@/engines/units'
import { gibToMib } from '@/engines/units/converters'
import { gib } from '@/engines/units/types'
import type {
  ParseError,
  ProxmoxBackupJobRow,
  ProxmoxHaResourceRow,
  ProxmoxHaStatusRow,
  ProxmoxSnapshotRow,
  ProxmoxStorageContentRow,
  VDatastoreRow,
  VHostRow,
  VInfoRow,
  VmUsageRow,
} from '@/types'
import type { ParsedSheet, ParsedWorkbook } from '../parseXlsx'
import { findSheet, mapColumns, readCol, readNumber, readString } from './columnMap'
import {
  BACKUP_JOB_COLS,
  CLUSTER_COLS,
  GUEST_COLS,
  HA_RESOURCE_COLS,
  HA_STATUS_COLS,
  NODE_COLS,
  SNAPSHOT_COLS,
  STORAGE_COLS,
  STORAGE_CONTENT_COLS,
} from './proxmoxColumns'
import { extractStackedSection } from './stackedSection'

export const extractClusterName = (sheet: ParsedSheet | undefined): string => {
  if (!sheet || sheet.rows.length === 0) return ''
  const cols = mapColumns(sheet.headers, CLUSTER_COLS)
  const row = sheet.rows[0]
  return readString(readCol(row ?? {}, cols.name))
}

export const adaptProxmoxNodes = (sheet: ParsedSheet, clusterName: string): VHostRow[] => {
  const cols = mapColumns(sheet.headers, NODE_COLS)
  return sheet.rows
    .map(
      (row): VHostRow => ({
        hostName: readString(readCol(row, cols.node)),
        cluster: clusterName,
        sockets: sockets(Math.max(0, Math.trunc(readNumber(readCol(row, cols.sockets))))),
        cores: cores(Math.max(0, Math.trunc(readNumber(readCol(row, cols.cores))))),
        speedMhz: mhz(Math.max(0, readNumber(readCol(row, cols.speedMhz)))),
        memoryMib: gibToMib(gib(Math.max(0, readNumber(readCol(row, cols.memoryGib))))),
        cpuRatio: 0, // Proxmox Nodes sheet has no host-level CPU usage %
        ramRatio: Math.max(0, readNumber(readCol(row, cols.memUsagePct))) / 100,
        faultDomain: '',
        model: readString(readCol(row, cols.model)),
        vendor: '',
        serialNumber: '',
        esxVersion: readString(readCol(row, cols.pveVersion)),
      }),
    )
    .filter((h) => h.hostName !== '')
}

const mapGuestRow = (
  row: Record<string, unknown>,
  cols: ReturnType<typeof mapColumns>,
  clusterName: string,
  guestType: 'qemu' | 'lxc',
): VInfoRow => {
  const sock = Math.max(1, Math.trunc(readNumber(readCol(row, cols.sockets))))
  const core = Math.max(0, Math.trunc(readNumber(readCol(row, cols.cores))))
  const status = readString(readCol(row, cols.status)).toLowerCase()
  const powerState =
    status === 'running' ? 'poweredOn' : status === 'suspended' ? 'suspended' : 'poweredOff'
  const osName = readString(readCol(row, cols.osName))
  const osVersion = readString(readCol(row, cols.osVersion))
  const os = [osName, osVersion].filter((s) => s !== '').join(' ')
  return {
    vmName: readString(readCol(row, cols.vmName)),
    cluster: clusterName,
    host: readString(readCol(row, cols.node)),
    vcpu: cores(core * sock),
    vramMib: gibToMib(gib(Math.max(0, readNumber(readCol(row, cols.vramGib))))),
    cpuReadinessPercent: null,
    powerState,
    template: readString(readCol(row, cols.template)).toLowerCase() === 'true',
    poweredOn: powerState === 'poweredOn',
    osConfig: os,
    osTools: os,
    vmBiosUuid: '',
    vmInstanceUuid: readString(readCol(row, cols.vmId)),
    viSdkUuid: '',
    viSdkServer: '',
    provisionedMib: gibToMib(gib(Math.max(0, readNumber(readCol(row, cols.diskSizeGib))))),
    inUseMib: gibToMib(gib(Math.max(0, readNumber(readCol(row, cols.diskUsageGib))))),
    path: '',
    guestType,
  }
}

export const adaptProxmoxGuests = (
  vmsSheet: ParsedSheet | undefined,
  ctSheet: ParsedSheet | undefined,
  clusterName: string,
): VInfoRow[] => {
  const out: VInfoRow[] = []
  if (vmsSheet) {
    const cols = mapColumns(vmsSheet.headers, GUEST_COLS)
    for (const row of vmsSheet.rows) out.push(mapGuestRow(row, cols, clusterName, 'qemu'))
  }
  if (ctSheet) {
    const cols = mapColumns(ctSheet.headers, GUEST_COLS)
    for (const row of ctSheet.rows) out.push(mapGuestRow(row, cols, clusterName, 'lxc'))
  }
  return out.filter((g) => g.vmName !== '')
}

export const adaptProxmoxStorages = (sheet: ParsedSheet | undefined): VDatastoreRow[] => {
  if (!sheet) return []
  const cols = mapColumns(sheet.headers, STORAGE_COLS)
  return sheet.rows
    .map((row): VDatastoreRow => {
      const cap = Math.max(0, readNumber(readCol(row, cols.capacityGib)))
      const used = Math.max(0, readNumber(readCol(row, cols.usageGib)))
      return {
        name: readString(readCol(row, cols.name)),
        capacityMib: gibToMib(gib(cap)),
        freeMib: gibToMib(gib(Math.max(0, cap - used))),
        provisionedMib: gibToMib(gib(used)),
        naa: null,
        type: readString(readCol(row, cols.pluginType)),
        hosts: readString(readCol(row, cols.node)),
        clusterName: '',
      }
    })
    .filter((d) => d.name !== '')
}

export const adaptProxmoxSnapshots = (sheet: ParsedSheet | undefined): ProxmoxSnapshotRow[] => {
  if (!sheet) return []
  const cols = mapColumns(sheet.headers, SNAPSHOT_COLS)
  return sheet.rows
    .map((row): ProxmoxSnapshotRow => {
      const dateRaw = readCol(row, cols.date)
      const dateSerial = typeof dateRaw === 'number' && Number.isFinite(dateRaw) ? dateRaw : null
      const ram = readString(readCol(row, cols.includeRam)).toLowerCase()
      return {
        node: readString(readCol(row, cols.node)),
        guestId: readString(readCol(row, cols.guestId)),
        guestName: readString(readCol(row, cols.guestName)),
        guestType:
          readString(readCol(row, cols.guestType)).toLowerCase() === 'lxc' ? 'lxc' : 'qemu',
        name: readString(readCol(row, cols.name)),
        parent: readString(readCol(row, cols.parent)),
        dateSerial,
        includeRam: ram === 'true' || ram === 'yes' || ram === '1',
        sizeMib: gibToMib(gib(Math.max(0, readNumber(readCol(row, cols.sizeGib))))),
      }
    })
    .filter((s) => s.name !== '')
}

export const adaptProxmoxStorageContent = (
  sheet: ParsedSheet | undefined,
): ProxmoxStorageContentRow[] => {
  if (!sheet) return []
  const cols = mapColumns(sheet.headers, STORAGE_CONTENT_COLS)
  return sheet.rows
    .map((row): ProxmoxStorageContentRow => {
      const dateRaw = readCol(row, cols.creationDate)
      const creationSerial =
        typeof dateRaw === 'number' && Number.isFinite(dateRaw) ? dateRaw : null
      return {
        node: readString(readCol(row, cols.node)),
        storage: readString(readCol(row, cols.storage)),
        content: readString(readCol(row, cols.content)),
        fileName: readString(readCol(row, cols.fileName)),
        format: readString(readCol(row, cols.format)),
        sizeMib: gibToMib(gib(Math.max(0, readNumber(readCol(row, cols.sizeGib))))),
        // `null` when blank ("not derivable"; ADR-0012) — never coerced to 0.
        usagePercent: cellOrNull(row, cols.usagePercent),
        guestId: readString(readCol(row, cols.guestId)),
        guestName: readString(readCol(row, cols.guestName)),
        creationSerial,
      }
    })
    .filter((r) => r.fileName !== '')
}

const readBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v
  const s = readString(v).toLowerCase()
  return s === 'true' || s === '1' || s === 'yes'
}

// `null` when the source cell is blank/absent ("not derivable"; ADR-0012).
const cellOrNull = (row: Record<string, unknown>, col: string | undefined): number | null => {
  const raw = readCol(row, col)
  if (raw === undefined || raw === null || readString(raw) === '') return null
  return Math.max(0, readNumber(raw))
}

export const adaptProxmoxHaResources = (sheet: ParsedSheet | undefined): ProxmoxHaResourceRow[] => {
  if (!sheet) return []
  const sec = extractStackedSection(sheet.cells, 'Resources')
  const cols = mapColumns(sec.headers, HA_RESOURCE_COLS)
  return sec.rows
    .map(
      (row): ProxmoxHaResourceRow => ({
        sid: readString(readCol(row, cols.sid)),
        type: readString(readCol(row, cols.type)),
        state: readString(readCol(row, cols.state)),
        group: readString(readCol(row, cols.group)),
        failback: readString(readCol(row, cols.failback)),
        maxRestart: cellOrNull(row, cols.maxRestart),
        maxRelocate: cellOrNull(row, cols.maxRelocate),
        comment: readString(readCol(row, cols.comment)),
      }),
    )
    .filter((r) => r.sid !== '')
}

export const adaptProxmoxHaStatus = (sheet: ParsedSheet | undefined): ProxmoxHaStatusRow[] => {
  if (!sheet) return []
  const sec = extractStackedSection(sheet.cells, 'Status')
  const cols = mapColumns(sec.headers, HA_STATUS_COLS)
  return sec.rows
    .map(
      (row): ProxmoxHaStatusRow => ({
        id: readString(readCol(row, cols.id)),
        type: readString(readCol(row, cols.type)),
        status: readString(readCol(row, cols.status)),
        node: readString(readCol(row, cols.node)),
        sid: readString(readCol(row, cols.sid)),
        state: readString(readCol(row, cols.state)),
        crmState: readString(readCol(row, cols.crmState)),
        requestState: readString(readCol(row, cols.requestState)),
        quorate: readString(readCol(row, cols.quorate)),
      }),
    )
    .filter((r) => r.id !== '' || r.type !== '')
}

export const adaptProxmoxBackupJobs = (sheet: ParsedSheet | undefined): ProxmoxBackupJobRow[] => {
  if (!sheet) return []
  const sec = extractStackedSection(sheet.cells, 'Backup Jobs')
  const cols = mapColumns(sec.headers, BACKUP_JOB_COLS)
  return sec.rows
    .map(
      (row): ProxmoxBackupJobRow => ({
        id: readString(readCol(row, cols.id)),
        enabled: readBool(readCol(row, cols.enabled)),
        all: readBool(readCol(row, cols.all)),
        vmId: readString(readCol(row, cols.vmId)),
        mode: readString(readCol(row, cols.mode)),
        storage: readString(readCol(row, cols.storage)),
        startTime: readString(readCol(row, cols.startTime)),
        schedule: readString(readCol(row, cols.schedule)),
        dayOfWeek: readString(readCol(row, cols.dayOfWeek)),
        compress: readString(readCol(row, cols.compress)),
        type: readString(readCol(row, cols.type)),
        node: readString(readCol(row, cols.node)),
      }),
    )
    .filter((r) => r.id !== '')
}

const mapUsageRow = (
  row: Record<string, unknown>,
  cols: ReturnType<typeof mapColumns>,
  clusterName: string,
): VmUsageRow => {
  const memGib = cellOrNull(row, cols.memUsageGib)
  return {
    vmName: readString(readCol(row, cols.vmName)),
    cluster: clusterName,
    vmBiosUuid: '',
    vmInstanceUuid: readString(readCol(row, cols.vmId)),
    activeMib: null,
    consumedMib: memGib === null ? null : gibToMib(gib(memGib)),
    balloonedMib: null,
    swappedMib: null,
    cpuUsageMhz: null, // Proxmox reports CPU as %, not MHz; derived later if needed
  }
}

export const adaptProxmoxUsage = (
  vmsSheet: ParsedSheet | undefined,
  ctSheet: ParsedSheet | undefined,
  clusterName: string,
): VmUsageRow[] => {
  const out: VmUsageRow[] = []
  for (const sheet of [vmsSheet, ctSheet]) {
    if (!sheet) continue
    const cols = mapColumns(sheet.headers, GUEST_COLS)
    for (const row of sheet.rows) out.push(mapUsageRow(row, cols, clusterName))
  }
  return out.filter((u) => u.vmName !== '')
}

/**
 * Throw a structured fatal `ParseError`. `name === 'ParseError'` is the
 * discriminator the worker boundary serializes; `sheet`/`kind` ride along
 * as own properties (mirrors rvtools.ts parseError — NO `cause`, STRIDE T-04-04).
 */
const parseError = (message: string, meta: { sheet?: string; kind: ParseError['kind'] }): never => {
  const e = new Error(message) as Error & {
    sheet?: string
    kind?: ParseError['kind']
  }
  e.name = 'ParseError'
  e.sheet = meta.sheet
  e.kind = meta.kind
  throw e
}

/**
 * Assemble the canonical patlas bundle from a parsed Proxmox workbook.
 * REQUIRED sheets: Nodes, and at least one of VMs or Containers.
 * OPTIONAL sheets: Cluster (name defaults to ''), Storages (warning collected).
 */
export const adaptProxmox = (
  workbook: ParsedWorkbook,
): {
  vinfo: VInfoRow[]
  vhost: VHostRow[]
  vdatastore: VDatastoreRow[]
  vmUsage: VmUsageRow[]
  proxmoxSnapshots: ProxmoxSnapshotRow[]
  proxmoxStorageContent: ProxmoxStorageContentRow[]
  proxmoxHaResources: ProxmoxHaResourceRow[]
  proxmoxHaStatus: ProxmoxHaStatusRow[]
  proxmoxBackupJobs: ProxmoxBackupJobRow[]
  clusterName: string
  warnings: ParseError[]
} => {
  const warnings: ParseError[] = []
  // Standalone Proxmox has no cluster name; a non-empty bucket keeps the estate
  // visible (aggregateClusters drops empty-cluster hosts). Matches design decision
  // D4: cluster pivot = Proxmox cluster name; standalone ⇒ single implicit bucket.
  const clusterSheet = findSheet(workbook, ['cluster'])
  const clusterName = extractClusterName(clusterSheet) || 'proxmox'

  const nodesSheet = findSheet(workbook, ['nodes'])
  if (!nodesSheet) {
    const present = [...workbook.sheets.keys()].sort().join(', ')
    return parseError(`missing sheet: Nodes (workbook contained: ${present})`, {
      sheet: 'Nodes',
      kind: 'missing-sheet',
    })
  }

  const vmsSheet = findSheet(workbook, ['vms'])
  const ctSheet = findSheet(workbook, ['containers'])
  if (!vmsSheet && !ctSheet) {
    return parseError('missing both VMs and Containers sheets — nothing to inventory', {
      sheet: 'VMs',
      kind: 'missing-sheet',
    })
  }

  const storageSheet = findSheet(workbook, ['storages'])
  if (!storageSheet) {
    warnings.push({
      sheet: 'Storages',
      kind: 'missing-sheet',
      message: 'optional sheet Storages absent — storage views will be empty',
    })
  }

  const snapshotsSheet = findSheet(workbook, ['snapshots'])
  if (!snapshotsSheet) {
    warnings.push({
      sheet: 'Snapshots',
      kind: 'missing-sheet',
      message: 'optional sheet Snapshots absent — snapshot sprawl will be empty',
    })
  }

  const storageContentSheet = findSheet(workbook, ['storage content'])
  if (!storageContentSheet) {
    warnings.push({
      sheet: 'Storage Content',
      kind: 'missing-sheet',
      message: 'optional sheet Storage Content absent — storage content views will be empty',
    })
  }

  const clusterHaSheet = findSheet(workbook, ['cluster ha'])

  return {
    vhost: adaptProxmoxNodes(nodesSheet, clusterName),
    vinfo: adaptProxmoxGuests(vmsSheet, ctSheet, clusterName),
    vdatastore: adaptProxmoxStorages(storageSheet),
    vmUsage: adaptProxmoxUsage(vmsSheet, ctSheet, clusterName),
    proxmoxSnapshots: adaptProxmoxSnapshots(snapshotsSheet),
    proxmoxStorageContent: adaptProxmoxStorageContent(storageContentSheet),
    proxmoxHaResources: adaptProxmoxHaResources(clusterHaSheet),
    proxmoxHaStatus: adaptProxmoxHaStatus(clusterHaSheet),
    proxmoxBackupJobs: adaptProxmoxBackupJobs(clusterSheet),
    clusterName,
    warnings,
  }
}
