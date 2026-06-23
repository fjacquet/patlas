import { cores, mhz, sockets } from '@/engines/units'
import { gibToMib } from '@/engines/units/converters'
import { gib } from '@/engines/units/types'
import type { VDatastoreRow, VHostRow, VInfoRow, VmUsageRow } from '@/types'
import type { ParsedSheet } from '../parseXlsx'
import { mapColumns, readCol, readNumber, readString } from './columnMap'
import { CLUSTER_COLS, GUEST_COLS, NODE_COLS, STORAGE_COLS } from './proxmoxColumns'

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

// `null` when the source cell is blank/absent ("not derivable"; ADR-0012).
const cellOrNull = (row: Record<string, unknown>, col: string | undefined): number | null => {
  const raw = readCol(row, col)
  if (raw === undefined || raw === null || readString(raw) === '') return null
  return Math.max(0, readNumber(raw))
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
