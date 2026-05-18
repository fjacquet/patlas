import type { ColumnDef } from '@tanstack/react-table'
import type { DvSwitchAgg, PortgroupAgg, VSwitchAgg } from '@/engines/aggregation'
import { fmtInt } from '@/utils/format'

/**
 * P9 network table column definitions (LC-3). Pure config modeled on
 * `datastoreColumns.ts` VERBATIM (zero React, zero `useMemo`, zero engine
 * runtime import — the type import is erased). Every `id` has a matching
 * `inventory:col.<id>` key in BOTH `en/` + `fr/` (Pitfall-3). Counts tier
 * via the shipped `fmtInt`; the CSV path bypasses cells (raw accessor).
 */
export const vswitchColumns: ColumnDef<VSwitchAgg>[] = [
  { accessorKey: 'host', id: 'host', header: 'inventory.col.host', enableHiding: false },
  { accessorKey: 'cluster', id: 'cluster', header: 'inventory.col.cluster' },
  { accessorKey: 'switch', id: 'switch', header: 'inventory.col.switch' },
  {
    accessorKey: 'ports',
    id: 'ports',
    header: 'inventory.col.ports',
    cell: (c) => fmtInt(c.getValue<number>()),
  },
  {
    accessorKey: 'freePorts',
    id: 'freePorts',
    header: 'inventory.col.freePorts',
    cell: (c) => fmtInt(c.getValue<number>()),
  },
  {
    accessorKey: 'mtu',
    id: 'mtu',
    header: 'inventory.col.mtu',
    cell: (c) => fmtInt(c.getValue<number>()),
  },
  {
    accessorKey: 'vmCount',
    id: 'vmCount',
    header: 'inventory.col.vmCount',
    cell: (c) => fmtInt(c.getValue<number>()),
  },
]

export const dvswitchColumns: ColumnDef<DvSwitchAgg>[] = [
  { accessorKey: 'switch', id: 'switch', header: 'inventory.col.switch', enableHiding: false },
  { accessorKey: 'name', id: 'name', header: 'inventory.col.name' },
  { accessorKey: 'version', id: 'version', header: 'inventory.col.version' },
  { accessorKey: 'hostMembers', id: 'hostMembers', header: 'inventory.col.hostMembers' },
  {
    accessorKey: 'ports',
    id: 'ports',
    header: 'inventory.col.ports',
    cell: (c) => fmtInt(c.getValue<number>()),
  },
  {
    accessorKey: 'vms',
    id: 'vms',
    header: 'inventory.col.vms',
    cell: (c) => fmtInt(c.getValue<number>()),
  },
  {
    accessorKey: 'maxMtu',
    id: 'maxMtu',
    header: 'inventory.col.maxMtu',
    cell: (c) => fmtInt(c.getValue<number>()),
  },
]

export const vnetworkColumns: ColumnDef<PortgroupAgg>[] = [
  { accessorKey: 'network', id: 'network', header: 'inventory.col.network', enableHiding: false },
  { accessorKey: 'switch', id: 'switch', header: 'inventory.col.switch' },
  {
    accessorKey: 'vmCount',
    id: 'vmCount',
    header: 'inventory.col.vmCount',
    cell: (c) => fmtInt(c.getValue<number>()),
  },
]
