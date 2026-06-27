import { cores, mhz, sockets } from '@/engines/units'
import { gibToMib } from '@/engines/units/converters'
import { gib } from '@/engines/units/types'
import type {
  GuestRow,
  NodeInterfaceRow,
  NodeRow,
  ParseError,
  ProxmoxAccessAclRow,
  ProxmoxAccessRoleRow,
  ProxmoxAccessTokenRow,
  ProxmoxAccessUserRow,
  ProxmoxBackupJobRow,
  ProxmoxDiskRow,
  ProxmoxHaResourceRow,
  ProxmoxHaStatusRow,
  ProxmoxIssueRow,
  ProxmoxPartitionRow,
  ProxmoxPoolMemberRow,
  ProxmoxSnapshotRow,
  ProxmoxStorageContentRow,
  ProxmoxTaskRow,
  RrdGuestRow,
  RrdNodeRow,
  RrdStorageRow,
  StorageRole,
  StorageRow,
  VmNicRow,
  VmUsageRow,
} from '@/types'
import type { ParsedSheet, ParsedWorkbook } from '../parseXlsx'
import { findSheet, mapColumns, readCol, readNumber, readString } from './columnMap'
import {
  ACCESS_ACL_COLS,
  ACCESS_ROLE_COLS,
  ACCESS_TOKEN_COLS,
  ACCESS_USER_COLS,
  BACKUP_JOB_COLS,
  CLUSTER_COLS,
  DISK_COLS,
  GUEST_COLS,
  HA_RESOURCE_COLS,
  HA_STATUS_COLS,
  ISSUE_COLS,
  NETWORK_NODES_COLS,
  NETWORK_VMS_COLS,
  NODE_COLS,
  PARTITION_COLS,
  POOL_MEMBER_COLS,
  RRD_GUEST_COLS,
  RRD_NODE_COLS,
  RRD_STORAGE_COLS,
  SNAPSHOT_COLS,
  STORAGE_COLS,
  STORAGE_CONTENT_COLS,
  TASK_COLS,
} from './proxmoxColumns'
import { extractStackedSection } from './stackedSection'

export const extractClusterName = (sheet: ParsedSheet | undefined): string => {
  if (!sheet || sheet.rows.length === 0) return ''
  const cols = mapColumns(sheet.headers, CLUSTER_COLS)
  const row = sheet.rows[0]
  return readString(readCol(row ?? {}, cols.name))
}

/**
 * Parse "RRD Nodes" time-series sheet into a per-node cpuRatio map.
 * For each node, the LATEST sample (by lexicographic sort on timeDate, which
 * is ISO-like "YYYY-MM-DD HH:MM:SS") is used. Returns an empty Map when the
 * sheet is absent or contains no valid rows.
 */
export const adaptProxmoxRrdNodes = (sheet: ParsedSheet | undefined): Map<string, number> => {
  if (!sheet) return new Map()
  const cols = mapColumns(sheet.headers, RRD_NODE_COLS)
  const latestByNode = new Map<string, { timeDate: string; cpuUsagePct: number }>()
  for (const row of sheet.rows) {
    const node = readString(readCol(row, cols.node))
    if (!node) continue
    const timeDate = readString(readCol(row, cols.timeDate))
    const cpuRaw = cellOrNull(row, cols.cpuUsagePct)
    if (cpuRaw === null) continue
    const prev = latestByNode.get(node)
    if (!prev || timeDate > prev.timeDate) {
      latestByNode.set(node, { timeDate, cpuUsagePct: cpuRaw })
    }
  }
  const out = new Map<string, number>()
  for (const [node, { cpuUsagePct }] of latestByNode) out.set(node, cpuUsagePct)
  return out
}

// Dense time-series numeric read: blank/non-numeric → 0 (a missing sample
// value is a real 0, unlike capacity columns where blank means "unknown").
const num = (row: Record<string, unknown>, col: string | undefined): number =>
  Math.max(0, readNumber(readCol(row, col)))

/**
 * Parse the FULL "RRD Nodes" time-series into per-node samples (P8 Pack A).
 * One pass over the ~8.6k-row sheet, reading only the headroom columns.
 * `timeSerial` is the raw Excel serial day (numeric in the cv4pve export).
 * "%" columns are 0-1 fractions. Returns `[]` when the sheet is absent.
 *
 * Separate from `adaptProxmoxRrdNodes` (which keeps the latest-sample cpuRatio
 * map on a lexicographic string compare) — that one feeds NodeRow.cpuRatio and
 * its contract/tests are unchanged; this one feeds the headroom analytics.
 */
export const adaptProxmoxRrdNodeSeries = (sheet: ParsedSheet | undefined): RrdNodeRow[] => {
  if (!sheet) return []
  const cols = mapColumns(sheet.headers, RRD_NODE_COLS)
  const out: RrdNodeRow[] = []
  for (const row of sheet.rows) {
    const node = readString(readCol(row, cols.node))
    if (!node) continue
    const timeSerial = readNumber(readCol(row, cols.timeDate))
    if (!Number.isFinite(timeSerial)) continue
    out.push({
      node,
      timeSerial,
      cpuRatio: num(row, cols.cpuUsagePct),
      memRatio: num(row, cols.memUsagePct),
      ioWaitRatio: num(row, cols.ioWaitPct),
      loadavg: num(row, cols.loadavg),
      netInMb: num(row, cols.netInMb),
      netOutMb: num(row, cols.netOutMb),
      psiMemSomeRatio: num(row, cols.psiMemSomePct),
    })
  }
  return out
}

/**
 * Parse the "RRD Storage" time-series into per-storage samples (P8 Pack A).
 * One pass over the LARGE (~36k-row) sheet, reading only the six needed
 * columns to keep worker memory bounded. `Size GB`/`Used GB` are reinterpreted
 * as GiB (ADR-0010); `Usage %` is a 0-1 fraction. Returns `[]` when absent.
 */
export const adaptProxmoxRrdStorage = (sheet: ParsedSheet | undefined): RrdStorageRow[] => {
  if (!sheet) return []
  const cols = mapColumns(sheet.headers, RRD_STORAGE_COLS)
  const out: RrdStorageRow[] = []
  for (const row of sheet.rows) {
    const node = readString(readCol(row, cols.node))
    const storage = readString(readCol(row, cols.storage))
    if (!node || !storage) continue
    const timeSerial = readNumber(readCol(row, cols.timeDate))
    if (!Number.isFinite(timeSerial)) continue
    out.push({
      node,
      storage,
      timeSerial,
      sizeGib: num(row, cols.sizeGib),
      usedGib: num(row, cols.usedGib),
      usageRatio: num(row, cols.usagePct),
    })
  }
  return out
}

/**
 * Parse the OPTIONAL "RRD Guests" time-series (P8 Pack A, defensive). Empty in
 * current exports but supported; returns `[]` when the sheet is absent or
 * carries no identifiable rows. `*Ratio` columns are 0-1 fractions.
 */
export const adaptProxmoxRrdGuests = (sheet: ParsedSheet | undefined): RrdGuestRow[] => {
  if (!sheet) return []
  const cols = mapColumns(sheet.headers, RRD_GUEST_COLS)
  const out: RrdGuestRow[] = []
  for (const row of sheet.rows) {
    const vmId = readString(readCol(row, cols.vmId))
    const node = readString(readCol(row, cols.node))
    if (!vmId && !node) continue
    const timeSerial = readNumber(readCol(row, cols.timeDate))
    if (!Number.isFinite(timeSerial)) continue
    out.push({
      vmId,
      node,
      timeSerial,
      cpuRatio: num(row, cols.cpuUsagePct),
      memRatio: num(row, cols.memUsagePct),
    })
  }
  return out
}

/**
 * Fallback: derive per-node cpuRatio from VM-level cpuUsagePct when "RRD
 * Nodes" is absent. Formula: sum(VM cpuUsagePct × vcpu) / nodePhysicalCores.
 * Nodes without any powered-on VM measurements are omitted from the Map so
 * the caller can fall through to 0 naturally.
 */
const deriveCpuRatioFromGuests = (
  vmsSheet: ParsedSheet | undefined,
  ctSheet: ParsedSheet | undefined,
  nodes: NodeRow[],
): Map<string, number> => {
  const nodeCores = new Map<string, number>()
  for (const n of nodes) {
    if (n.hostName) nodeCores.set(n.hostName, (n.cores as number) * (n.sockets as number))
  }
  const weightedSum = new Map<string, number>()
  for (const sheet of [vmsSheet, ctSheet]) {
    if (!sheet) continue
    const cols = mapColumns(sheet.headers, GUEST_COLS)
    for (const row of sheet.rows) {
      const node = readString(readCol(row, cols.node))
      if (!node) continue
      const sock = Math.max(1, Math.trunc(readNumber(readCol(row, cols.sockets))))
      const core = Math.max(0, Math.trunc(readNumber(readCol(row, cols.cores))))
      const vcpu = core * sock
      const cpuPct = cellOrNull(row, cols.cpuUsagePct)
      if (cpuPct === null || vcpu === 0) continue
      weightedSum.set(node, (weightedSum.get(node) ?? 0) + cpuPct * vcpu)
    }
  }
  const out = new Map<string, number>()
  for (const [node, wsum] of weightedSum) {
    const totalCores = nodeCores.get(node)
    if (totalCores && totalCores > 0) out.set(node, Math.min(1.5, wsum / totalCores))
  }
  return out
}

export const adaptProxmoxNodes = (
  sheet: ParsedSheet,
  clusterName: string,
  rrdCpuByNode: Map<string, number> = new Map(),
): NodeRow[] => {
  const cols = mapColumns(sheet.headers, NODE_COLS)
  return sheet.rows
    .map((row): NodeRow => {
      const hostName = readString(readCol(row, cols.node))
      return {
        hostName,
        cluster: clusterName,
        sockets: sockets(Math.max(0, Math.trunc(readNumber(readCol(row, cols.sockets))))),
        cores: cores(Math.max(0, Math.trunc(readNumber(readCol(row, cols.cores))))),
        speedMhz: mhz(Math.max(0, readNumber(readCol(row, cols.speedMhz)))),
        memoryMib: gibToMib(gib(Math.max(0, readNumber(readCol(row, cols.memoryGib))))),
        // cpuRatio: sourced from "RRD Nodes" latest sample (0-1 fraction);
        // falls back to 0 when the sheet is absent (factual-degrade).
        cpuRatio: rrdCpuByNode.get(hostName) ?? 0,
        ramRatio: Math.max(0, readNumber(readCol(row, cols.memUsagePct))) / 100,
        faultDomain: '',
        model: readString(readCol(row, cols.model)),
        vendor: '',
        serialNumber: '',
        esxVersion: readString(readCol(row, cols.pveVersion)),
      }
    })
    .filter((h) => h.hostName !== '')
}

const mapGuestRow = (
  row: Record<string, unknown>,
  cols: ReturnType<typeof mapColumns>,
  clusterName: string,
  guestType: 'qemu' | 'lxc',
): GuestRow => {
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
): GuestRow[] => {
  const out: GuestRow[] = []
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

/**
 * Classify a cv4pve storage into its {@link StorageRole} from the Storages
 * sheet's `Plugin Type` + `Content` + `Shared` columns. Order matters:
 *  1. PBS (`pbs`) or a target whose Content is *only* `backup` → `backup`.
 *  2. Non-shared (`Shared` blank) `local`/`local-lvm` → `local` (boot/OS).
 *  3. Shared with `images`/`rootdir` content → `vmdata` (VM disks / CT rootfs).
 *  4. Everything else (ISO/template libraries, unconfigured) → `other`.
 * Pure string logic — no estate context, safe at the parser boundary.
 */
export const classifyStorageRole = (
  pluginType: string,
  content: string,
  shared: boolean,
): StorageRole => {
  const plugin = pluginType.toLowerCase().trim()
  // Split on the whitespace-inclusive delimiter class — tokens carry no
  // boundary whitespace, so only empty strings need filtering.
  const tokens = content
    .toLowerCase()
    .split(/[\s,;]+/)
    .filter((t) => t.length > 0)
  if (plugin === 'pbs') return 'backup'
  if (tokens.length > 0 && tokens.every((t) => t === 'backup')) return 'backup'
  if (!shared) return 'local'
  if (tokens.includes('images') || tokens.includes('rootdir')) return 'vmdata'
  return 'other'
}

export const adaptProxmoxStorages = (sheet: ParsedSheet | undefined): StorageRow[] => {
  if (!sheet) return []
  const cols = mapColumns(sheet.headers, STORAGE_COLS)
  return sheet.rows
    .map((row): StorageRow => {
      const cap = Math.max(0, readNumber(readCol(row, cols.capacityGib)))
      const used = Math.max(0, readNumber(readCol(row, cols.usageGib)))
      const pluginType = readString(readCol(row, cols.pluginType))
      return {
        name: readString(readCol(row, cols.name)),
        capacityMib: gibToMib(gib(cap)),
        freeMib: gibToMib(gib(Math.max(0, cap - used))),
        provisionedMib: gibToMib(gib(used)),
        naa: null,
        type: pluginType,
        role: classifyStorageRole(
          pluginType,
          readString(readCol(row, cols.content)),
          readString(readCol(row, cols.shared)).trim() !== '',
        ),
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
  nodeSpeedByName: Map<string, number>,
): VmUsageRow => {
  const memGib = cellOrNull(row, cols.memUsageGib)
  const nodeName = readString(readCol(row, cols.node))
  const coreMhz = nodeSpeedByName.get(nodeName)
  // cpuUsagePct is a 0-1 fraction in the Proxmox report ("Cpu Usage %" column).
  // "Host Cpu Usage %" is a non-numeric string ("0 % of 64 CPUs") — never used.
  const cpuPct = cellOrNull(row, cols.cpuUsagePct)
  const sock = Math.max(1, Math.trunc(readNumber(readCol(row, cols.sockets))))
  const core = Math.max(0, Math.trunc(readNumber(readCol(row, cols.cores))))
  const vcpu = core * sock
  // Derive MHz from fraction × allocated vCPUs × per-core MHz. Null when any
  // input is missing (not derivable; ADR-0012 — never coerced to 0).
  const cpuUsageMhz =
    cpuPct !== null && coreMhz !== undefined && vcpu > 0 ? mhz(cpuPct * vcpu * coreMhz) : null
  return {
    vmName: readString(readCol(row, cols.vmName)),
    cluster: clusterName,
    vmBiosUuid: '',
    vmInstanceUuid: readString(readCol(row, cols.vmId)),
    activeMib: null,
    consumedMib: memGib === null ? null : gibToMib(gib(memGib)),
    balloonedMib: null,
    swappedMib: null,
    cpuUsageMhz,
  }
}

export const adaptProxmoxUsage = (
  vmsSheet: ParsedSheet | undefined,
  ctSheet: ParsedSheet | undefined,
  clusterName: string,
  nodeSpeedByName: Map<string, number> = new Map(),
): VmUsageRow[] => {
  const out: VmUsageRow[] = []
  for (const sheet of [vmsSheet, ctSheet]) {
    if (!sheet) continue
    const cols = mapColumns(sheet.headers, GUEST_COLS)
    for (const row of sheet.rows) out.push(mapUsageRow(row, cols, clusterName, nodeSpeedByName))
  }
  return out.filter((u) => u.vmName !== '')
}

/**
 * Parse the "Nodes Networks" stacked sub-table from the Proxmox "Network"
 * sheet. Uses `extractStackedSection` (same helper as Cluster HA). Returns
 * an empty array when the sheet or sub-table is absent (factual-degrade).
 */
export const adaptProxmoxNodeInterfaces = (sheet: ParsedSheet | undefined): NodeInterfaceRow[] => {
  if (!sheet) return []
  const sec = extractStackedSection(sheet.cells, 'Nodes Networks')
  if (sec.headers.length === 0) return []
  const cols = mapColumns(sec.headers, NETWORK_NODES_COLS)
  const readX = (v: unknown): boolean => readString(v).trim() === 'X'
  const readMaybeInt = (v: unknown): number | null => {
    const raw = readCol({ _: v }, '_')
    if (raw === undefined || raw === null || readString(raw) === '') return null
    const n = Math.round(readNumber(raw))
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  return sec.rows
    .map((row): NodeInterfaceRow => {
      const slavesRaw = readString(readCol(row, cols.slaves)).trim()
      const slaves = slavesRaw === '' ? [] : slavesRaw.split(/\s+/).filter(Boolean)
      const bridgeVlanAwareRaw = readCol(row, cols.bridgeVlanAware)
      const bridgeVlanAware =
        bridgeVlanAwareRaw === true ||
        readString(bridgeVlanAwareRaw).toLowerCase() === 'true' ||
        readString(bridgeVlanAwareRaw) === '1'
      return {
        node: readString(readCol(row, cols.node)),
        name: readString(readCol(row, cols.name)),
        type: readString(readCol(row, cols.type)).toLowerCase(),
        active: readX(readCol(row, cols.active)),
        autostart: readX(readCol(row, cols.autostart)),
        method: readString(readCol(row, cols.method)),
        cidr: readString(readCol(row, cols.cidr)),
        address: readString(readCol(row, cols.address)),
        gateway: readString(readCol(row, cols.gateway)),
        mtu: readMaybeInt(readCol(row, cols.mtu)),
        bondMode: readString(readCol(row, cols.bondMode)),
        slaves,
        bridgePorts: readString(readCol(row, cols.bridgePorts)),
        bridgeVlanAware,
        vlanId: readMaybeInt(readCol(row, cols.vlanId)),
        vlanRawDevice: readString(readCol(row, cols.vlanRawDevice)),
        comments: readString(readCol(row, cols.comments)),
      }
    })
    .filter((r) => r.node !== '' && r.name !== '')
}

/**
 * Parse the "VM Networks" stacked sub-table from the Proxmox "Network"
 * sheet. One row per guest NIC. Returns an empty array when absent.
 */
export const adaptProxmoxVmNics = (sheet: ParsedSheet | undefined): VmNicRow[] => {
  if (!sheet) return []
  const sec = extractStackedSection(sheet.cells, 'VM Networks')
  if (sec.headers.length === 0) return []
  const cols = mapColumns(sec.headers, NETWORK_VMS_COLS)
  return sec.rows
    .map((row): VmNicRow => {
      const tagRaw = readCol(row, cols.tag)
      const tag =
        tagRaw === null || tagRaw === undefined || readString(tagRaw) === ''
          ? null
          : Math.round(readNumber(tagRaw))
      return {
        node: readString(readCol(row, cols.node)),
        vmId: readString(readCol(row, cols.vmId)),
        vmName: readString(readCol(row, cols.vmName)),
        vmType: readString(readCol(row, cols.vmType)).toLowerCase(),
        macAddress: readString(readCol(row, cols.macAddress)),
        bridge: readString(readCol(row, cols.bridge)),
        tag: Number.isFinite(tag) && tag !== null && tag >= 0 ? tag : null,
        model: readString(readCol(row, cols.model)),
      }
    })
    .filter((r) => r.node !== '' && r.vmId !== '')
}

const readX = (v: unknown): boolean => readString(v).trim() === 'X'

export const adaptProxmoxPartitions = (sheet: ParsedSheet | undefined): ProxmoxPartitionRow[] => {
  if (!sheet) return []
  const cols = mapColumns(sheet.headers, PARTITION_COLS)
  return sheet.rows
    .map((row): ProxmoxPartitionRow => {
      const pctRaw = readCol(row, cols.usedPct)
      const usedFraction =
        pctRaw === undefined || pctRaw === null || readString(pctRaw) === ''
          ? null
          : Math.max(0, readNumber(pctRaw))
      return {
        node: readString(readCol(row, cols.node)),
        vmId: readString(readCol(row, cols.vmId)),
        vmName: readString(readCol(row, cols.vmName)),
        vmType: readString(readCol(row, cols.vmType)),
        vmStatus: readString(readCol(row, cols.vmStatus)),
        mountPoint: readString(readCol(row, cols.mountPoint)),
        fsType: readString(readCol(row, cols.fsType)),
        totalGb: Math.max(0, readNumber(readCol(row, cols.totalGb))),
        usedGb: Math.max(0, readNumber(readCol(row, cols.usedGb))),
        usedFraction,
        error: readString(readCol(row, cols.error)),
        name: readString(readCol(row, cols.name)),
        disks: readString(readCol(row, cols.disks)),
      }
    })
    .filter((r) => r.node !== '' && r.mountPoint !== '')
}

export const adaptProxmoxDisks = (sheet: ParsedSheet | undefined): ProxmoxDiskRow[] => {
  if (!sheet) return []
  const cols = mapColumns(sheet.headers, DISK_COLS)
  return sheet.rows
    .map((row): ProxmoxDiskRow => {
      const usageRaw = readCol(row, cols.storageUsagePct)
      const storageUsageFraction =
        usageRaw === undefined || usageRaw === null || readString(usageRaw) === ''
          ? null
          : Math.max(0, readNumber(usageRaw))
      return {
        node: readString(readCol(row, cols.node)),
        vmId: readString(readCol(row, cols.vmId)),
        vmName: readString(readCol(row, cols.vmName)),
        vmType: readString(readCol(row, cols.vmType)),
        vmStatus: readString(readCol(row, cols.vmStatus)),
        kind: readString(readCol(row, cols.kind)),
        id: readString(readCol(row, cols.id)),
        storage: readString(readCol(row, cols.storage)),
        storageType: readString(readCol(row, cols.storageType)),
        storageShared: readX(readCol(row, cols.storageShared)),
        fileName: readString(readCol(row, cols.fileName)),
        sizeGb: Math.max(0, readNumber(readCol(row, cols.sizeGb))),
        storageUsageFraction,
        cache: readString(readCol(row, cols.cache)),
        backup: readString(readCol(row, cols.backup)),
        isUnused: readX(readCol(row, cols.isUnused)),
        device: readString(readCol(row, cols.device)),
        mountPoint: readString(readCol(row, cols.mountPoint)),
      }
    })
    .filter((r) => r.node !== '')
}

export const adaptProxmoxTasks = (sheet: ParsedSheet | undefined): ProxmoxTaskRow[] => {
  if (!sheet) return []
  const cols = mapColumns(sheet.headers, TASK_COLS)
  const readSerial = (v: unknown): number | null => {
    if (v === undefined || v === null || readString(v) === '') return null
    const n = readNumber(v)
    return Number.isFinite(n) ? n : null
  }
  return sheet.rows
    .map((row): ProxmoxTaskRow => {
      const statusOkRaw = readCol(row, cols.statusOk)
      return {
        node: readString(readCol(row, cols.node)),
        taskId: readString(readCol(row, cols.taskId)),
        type: readString(readCol(row, cols.type)),
        user: readString(readCol(row, cols.user)),
        status: readString(readCol(row, cols.status)),
        statusOk: readString(statusOkRaw).trim() === 'X',
        startSerial: readSerial(readCol(row, cols.startTime)),
        endSerial: readSerial(readCol(row, cols.endTime)),
        durationDays: readSerial(readCol(row, cols.duration)),
      }
    })
    .filter((r) => r.node !== '' && r.type !== '')
}

/** Parse the flat `Issues` sheet (Pack C). */
export const adaptProxmoxIssues = (sheet: ParsedSheet | undefined): ProxmoxIssueRow[] => {
  if (!sheet) return []
  const cols = mapColumns(sheet.headers, ISSUE_COLS)
  return sheet.rows
    .map((row): ProxmoxIssueRow => {
      const tsRaw = readCol(row, cols.timestamp)
      const timestampSerial = typeof tsRaw === 'number' && Number.isFinite(tsRaw) ? tsRaw : null
      return {
        severity: readString(readCol(row, cols.severity)),
        section: readString(readCol(row, cols.section)),
        message: readString(readCol(row, cols.message)),
        timestampSerial,
        linkKey: readString(readCol(row, cols.linkKey)),
      }
    })
    .filter((r) => r.message !== '')
}

/** Parse the "Users" stacked sub-table from `Cluster Access` (Pack C). */
export const adaptProxmoxAccessUsers = (sheet: ParsedSheet | undefined): ProxmoxAccessUserRow[] => {
  if (!sheet) return []
  const sec = extractStackedSection(sheet.cells, 'Users')
  if (sec.headers.length === 0) return []
  const cols = mapColumns(sec.headers, ACCESS_USER_COLS)
  return sec.rows
    .map(
      (row): ProxmoxAccessUserRow => ({
        id: readString(readCol(row, cols.id)),
        enabled: readX(readCol(row, cols.enable)),
        firstname: readString(readCol(row, cols.firstname)),
        lastname: readString(readCol(row, cols.lastname)),
        email: readString(readCol(row, cols.email)),
        groups: readString(readCol(row, cols.groups)),
        keys: readString(readCol(row, cols.keys)),
        totpLocked: readX(readCol(row, cols.totpLocked)),
        expire: readString(readCol(row, cols.expire)),
        comment: readString(readCol(row, cols.comment)),
      }),
    )
    .filter((r) => r.id !== '')
}

/** Parse the "API Tokens" stacked sub-table from `Cluster Access` (Pack C). */
export const adaptProxmoxAccessTokens = (
  sheet: ParsedSheet | undefined,
): ProxmoxAccessTokenRow[] => {
  if (!sheet) return []
  const sec = extractStackedSection(sheet.cells, 'API Tokens')
  if (sec.headers.length === 0) return []
  const cols = mapColumns(sec.headers, ACCESS_TOKEN_COLS)
  return sec.rows
    .map(
      (row): ProxmoxAccessTokenRow => ({
        user: readString(readCol(row, cols.user)),
        tokenId: readString(readCol(row, cols.tokenId)),
        expire: readString(readCol(row, cols.expire)),
        privSeparated: readX(readCol(row, cols.privSeparated)),
        comment: readString(readCol(row, cols.comment)),
      }),
    )
    .filter((r) => r.user !== '')
}

/** Parse the "Roles" stacked sub-table from `Cluster Access` (Pack C). */
export const adaptProxmoxAccessRoles = (sheet: ParsedSheet | undefined): ProxmoxAccessRoleRow[] => {
  if (!sheet) return []
  const sec = extractStackedSection(sheet.cells, 'Roles')
  if (sec.headers.length === 0) return []
  const cols = mapColumns(sec.headers, ACCESS_ROLE_COLS)
  return sec.rows
    .map(
      (row): ProxmoxAccessRoleRow => ({
        id: readString(readCol(row, cols.id)),
        privileges: readString(readCol(row, cols.privileges)),
        special: readX(readCol(row, cols.special)),
      }),
    )
    .filter((r) => r.id !== '')
}

/** Parse the "ACL" stacked sub-table from `Cluster Access` (Pack C). */
export const adaptProxmoxAccessAcls = (sheet: ParsedSheet | undefined): ProxmoxAccessAclRow[] => {
  if (!sheet) return []
  const sec = extractStackedSection(sheet.cells, 'ACL')
  if (sec.headers.length === 0) return []
  const cols = mapColumns(sec.headers, ACCESS_ACL_COLS)
  return sec.rows
    .map(
      (row): ProxmoxAccessAclRow => ({
        path: readString(readCol(row, cols.path)),
        usersOrGroup: readString(readCol(row, cols.usersOrGroup)),
        type: readString(readCol(row, cols.type)).toLowerCase(),
        roleId: readString(readCol(row, cols.roleId)),
        propagate: readX(readCol(row, cols.propagate)),
      }),
    )
    .filter((r) => r.path !== '')
}

/**
 * Parse the "Pools" data section from the `Cluster Pools` sheet (Pack C).
 */
export const adaptProxmoxPoolMembers = (sheet: ParsedSheet | undefined): ProxmoxPoolMemberRow[] => {
  if (!sheet) return []
  const cells = sheet.cells
  const normCell = (v: unknown): string => (v == null ? '' : String(v).trim())
  const nonEmpty = (row: unknown[]): number =>
    row.reduce<number>((n, c) => (normCell(c) !== '' ? n + 1 : n), 0)

  let headerIdx = -1
  for (let r = 0; r < cells.length; r++) {
    const row = cells[r] ?? []
    if (normCell(row[0]).toLowerCase() === 'pool' && nonEmpty(row) >= 4) {
      headerIdx = r
      break
    }
  }
  if (headerIdx === -1) return []

  const headers = (cells[headerIdx] ?? []).map(normCell)
  const cols = mapColumns(headers, POOL_MEMBER_COLS)
  const out: ProxmoxPoolMemberRow[] = []
  for (let r = headerIdx + 1; r < cells.length; r++) {
    const row = cells[r] ?? []
    if (nonEmpty(row) < 2) continue
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      if (h !== '') obj[h] = row[i] ?? null
    })
    const pool = readString(readCol(obj, cols.pool))
    if (!pool) continue
    const vmIdRaw = readCol(obj, cols.vmId)
    out.push({
      pool,
      type: readString(readCol(obj, cols.type)).toLowerCase(),
      node: readString(readCol(obj, cols.node)),
      vmId: vmIdRaw === null || vmIdRaw === undefined ? '' : String(vmIdRaw).trim(),
      storage: readString(readCol(obj, cols.storage)),
      status: readString(readCol(obj, cols.status)),
      description: readString(readCol(obj, cols.description)),
      comment: readString(readCol(obj, cols.comment)),
    })
  }
  return out
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
  guests: GuestRow[]
  nodes: NodeRow[]
  storages: StorageRow[]
  vmUsage: VmUsageRow[]
  proxmoxSnapshots: ProxmoxSnapshotRow[]
  proxmoxStorageContent: ProxmoxStorageContentRow[]
  proxmoxHaResources: ProxmoxHaResourceRow[]
  proxmoxHaStatus: ProxmoxHaStatusRow[]
  proxmoxBackupJobs: ProxmoxBackupJobRow[]
  proxmoxPartitions: ProxmoxPartitionRow[]
  proxmoxDisks: ProxmoxDiskRow[]
  proxmoxTasks: ProxmoxTaskRow[]
  nodeInterfaces: NodeInterfaceRow[]
  vmNics: VmNicRow[]
  proxmoxIssues: ProxmoxIssueRow[]
  proxmoxAccessUsers: ProxmoxAccessUserRow[]
  proxmoxAccessTokens: ProxmoxAccessTokenRow[]
  proxmoxAccessRoles: ProxmoxAccessRoleRow[]
  proxmoxAccessAcls: ProxmoxAccessAclRow[]
  proxmoxPoolMembers: ProxmoxPoolMemberRow[]
  rrdNodes: RrdNodeRow[]
  rrdStorage: RrdStorageRow[]
  rrdGuests: RrdGuestRow[]
  clusterName: string
  warnings: ParseError[]
} => {
  const warnings: ParseError[] = []
  // When the Cluster sheet is absent (standalone Proxmox node), fall back to
  // the first node's hostname rather than the opaque literal 'proxmox' — gives
  // the estate a meaningful label in the UI (Part C — P5 clarity fix).
  const clusterSheet = findSheet(workbook, ['cluster'])
  const clusterNameFromSheet = extractClusterName(clusterSheet)
  const clusterName: string = (() => {
    if (clusterNameFromSheet) return clusterNameFromSheet
    // Peek at the first row of Nodes to derive a standalone label.
    const nodesPreview = findSheet(workbook, ['nodes'])
    if (nodesPreview && nodesPreview.rows.length > 0) {
      const cols = mapColumns(nodesPreview.headers, NODE_COLS)
      const firstName = readString(readCol(nodesPreview.rows[0] ?? {}, cols.node))
      if (firstName) return firstName
    }
    return 'standalone'
  })()

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
  const networkSheet = findSheet(workbook, ['network'])
  const partitionsSheet = findSheet(workbook, ['partitions'])
  const disksSheet = findSheet(workbook, ['disks'])
  const clusterTasksSheet = findSheet(workbook, ['cluster tasks'])
  const issuesSheet = findSheet(workbook, ['issues'])
  const clusterAccessSheet = findSheet(workbook, ['cluster access'])
  const clusterPoolsSheet = findSheet(workbook, ['cluster pools'])

  // --- RRD Nodes: derive per-node CPU ratio from time-series data ------------
  // Primary source: "RRD Nodes" sheet (optional). Contains one row per
  // node+timestamp; we keep the latest sample for each node.
  const rrdNodesSheet = findSheet(workbook, ['rrd nodes'])
  let rrdCpuByNode = adaptProxmoxRrdNodes(rrdNodesSheet)

  // P8 Pack A: the FULL RRD time-series (node headroom + storage growth +
  // single-file trends). Parsed once here; the analytics engines downstream
  // consume the typed rows off the Snapshot (engines stay pure).
  const rrdNodeSeries = adaptProxmoxRrdNodeSeries(rrdNodesSheet)
  const rrdStorage = adaptProxmoxRrdStorage(findSheet(workbook, ['rrd storage']))
  const rrdGuests = adaptProxmoxRrdGuests(findSheet(workbook, ['rrd guests']))

  // Build nodes early so we have speedMhz for VM usage derivation.
  let nodes = adaptProxmoxNodes(nodesSheet, clusterName, rrdCpuByNode)

  // Fallback: if "RRD Nodes" is absent/empty, approximate node cpuRatio from
  // the VM-sheet "Cpu Usage %" column (weighted by vcpu count). This keeps the
  // dashboard non-zero even when RRD export is disabled.
  if (rrdCpuByNode.size === 0) {
    const fallback = deriveCpuRatioFromGuests(vmsSheet, ctSheet, nodes)
    if (fallback.size > 0) {
      nodes = nodes.map((n) => ({ ...n, cpuRatio: fallback.get(n.hostName) ?? n.cpuRatio }))
      rrdCpuByNode = fallback // reuse same Map shape for nodeSpeedByName derivation below
    }
  }

  // Build nodeSpeedByName for VM cpuUsageMhz derivation.
  const nodeSpeedByName = new Map<string, number>()
  for (const n of nodes) if (n.hostName) nodeSpeedByName.set(n.hostName, n.speedMhz as number)

  return {
    nodes,
    guests: adaptProxmoxGuests(vmsSheet, ctSheet, clusterName),
    storages: adaptProxmoxStorages(storageSheet),
    vmUsage: adaptProxmoxUsage(vmsSheet, ctSheet, clusterName, nodeSpeedByName),
    proxmoxSnapshots: adaptProxmoxSnapshots(snapshotsSheet),
    proxmoxStorageContent: adaptProxmoxStorageContent(storageContentSheet),
    proxmoxHaResources: adaptProxmoxHaResources(clusterHaSheet),
    proxmoxHaStatus: adaptProxmoxHaStatus(clusterHaSheet),
    proxmoxBackupJobs: adaptProxmoxBackupJobs(clusterSheet),
    proxmoxPartitions: adaptProxmoxPartitions(partitionsSheet),
    proxmoxDisks: adaptProxmoxDisks(disksSheet),
    proxmoxTasks: adaptProxmoxTasks(clusterTasksSheet),
    nodeInterfaces: adaptProxmoxNodeInterfaces(networkSheet),
    vmNics: adaptProxmoxVmNics(networkSheet),
    proxmoxIssues: adaptProxmoxIssues(issuesSheet),
    proxmoxAccessUsers: adaptProxmoxAccessUsers(clusterAccessSheet),
    proxmoxAccessTokens: adaptProxmoxAccessTokens(clusterAccessSheet),
    proxmoxAccessRoles: adaptProxmoxAccessRoles(clusterAccessSheet),
    proxmoxAccessAcls: adaptProxmoxAccessAcls(clusterAccessSheet),
    proxmoxPoolMembers: adaptProxmoxPoolMembers(clusterPoolsSheet),
    rrdNodes: rrdNodeSeries,
    rrdStorage,
    rrdGuests,
    clusterName,
    warnings,
  }
}
