import { cores, mhz, sockets } from '@/engines/units'
import { gibToMib } from '@/engines/units/converters'
import { gib } from '@/engines/units/types'
import type { VHostRow } from '@/types'
import type { ParsedSheet } from '../parseXlsx'
import { mapColumns, readCol, readNumber, readString } from './columnMap'
import { CLUSTER_COLS, NODE_COLS } from './proxmoxColumns'

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
