import type { ColumnDef } from '@tanstack/react-table'
import type { NodeNetworkStats } from '@/engines/aggregation/network'
import type { VmNicRow } from '@/types/snapshot'
import { fmtInt } from '@/utils/format'

/**
 * P5 Proxmox network table column definitions. Pure config modeled on
 * `datastoreColumns.ts` (zero React, zero `useMemo`, zero engine runtime
 * import — the type import is erased). Every `id` needs a matching
 * `inventory:col.<id>` key in all four locale files (Pitfall-3).
 * Counts tier via the shipped `fmtInt`; the CSV path bypasses cells.
 */

/** Per-node interface type counts (used in the Node Interfaces section). */
export const nodeNetworkColumns: ColumnDef<NodeNetworkStats>[] = [
  { accessorKey: 'node', id: 'node', header: 'inventory.col.node', enableHiding: false },
  {
    accessorKey: 'nics',
    id: 'nics',
    header: 'inventory.col.nics',
    cell: (c) => fmtInt(c.getValue<number>()),
  },
  {
    accessorKey: 'bonds',
    id: 'bonds',
    header: 'inventory.col.bonds',
    cell: (c) => fmtInt(c.getValue<number>()),
  },
  {
    accessorKey: 'bridges',
    id: 'bridges',
    header: 'inventory.col.bridges',
    cell: (c) => fmtInt(c.getValue<number>()),
  },
  {
    accessorKey: 'vlans',
    id: 'vlans',
    header: 'inventory.col.vlans',
    cell: (c) => fmtInt(c.getValue<number>()),
  },
]

/** Guest NIC attachment columns (used in the VM NICs section). */
export const vmNicColumns: ColumnDef<VmNicRow>[] = [
  { accessorKey: 'node', id: 'node', header: 'inventory.col.node', enableHiding: false },
  { accessorKey: 'vmName', id: 'vmName', header: 'inventory.col.vmName' },
  { accessorKey: 'bridge', id: 'bridge', header: 'inventory.col.bridge' },
  {
    accessorKey: 'tag',
    id: 'tag',
    header: 'inventory.col.tag',
    cell: (c) => {
      const v = c.getValue<number | null>()
      return v === null ? '—' : fmtInt(v)
    },
  },
  { accessorKey: 'model', id: 'model', header: 'inventory.col.model' },
  { accessorKey: 'macAddress', id: 'macAddress', header: 'inventory.col.macAddress' },
]
