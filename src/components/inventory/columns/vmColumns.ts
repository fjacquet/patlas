import type { ColumnDef } from '@tanstack/react-table'
import i18n from '@/i18n'
import type { VmDisplayRow } from '@/types/estate'
import { fmtInt, fmtMemMb } from '@/utils/format'

/**
 * INV-02 VM table column definitions — bound to the projected
 * `EstateView.vmRows` (`VmDisplayRow`), produced inside the single
 * `buildEstateView` pass. This module is PURE CONFIG: zero React, zero
 * `useMemo`, zero `@/engines` import. `accessorKey` references ONLY
 * `VmDisplayRow` fields — never the per-family OS-count interface fields;
 * referencing those is the 03-RESEARCH Pitfall-1 warning sign (the VM
 * table is a projection of source VM rows, not the OS-family donut).
 *
 * Header text is carried as the i18n key id `inventory.col.<field>`; the
 * DataTable `headerFor` callback resolves it at render (the `inventory`
 * namespace is registered in 03-03 and exercised end-to-end there).
 *
 * Numeric cells format for DISPLAY via the inherited `src/utils/format.ts`
 * formatters (em-dash `—` sentinel on non-finite — UI-SPEC §Copywriting).
 * The CSV export deliberately bypasses these (it reads the RAW accessor
 * value via `row.getValue`) — the two-path discipline (03-RESEARCH
 * Pitfall 4). `vmName` is the identity column → `enableHiding: false`
 * (03-RESEARCH §Column visibility). `VmDisplayRow` is already the lean
 * 8-field subset, so every column is default-visible.
 */
export const vmColumns: ColumnDef<VmDisplayRow>[] = [
  {
    accessorKey: 'vmName',
    id: 'vmName',
    header: 'inventory.col.vmName',
    enableHiding: false,
  },
  {
    accessorKey: 'cluster',
    id: 'cluster',
    header: 'inventory.col.cluster',
  },
  {
    accessorKey: 'host',
    id: 'host',
    header: 'inventory.col.host',
  },
  {
    accessorKey: 'vcpu',
    id: 'vcpu',
    header: 'inventory.col.vcpu',
    cell: (ctx) => fmtInt(ctx.getValue<number>()),
  },
  {
    accessorKey: 'vramMib',
    id: 'vramMib',
    header: 'inventory.col.vramMib',
    cell: (ctx) => fmtMemMb(ctx.getValue<number>()),
  },
  {
    accessorKey: 'os',
    id: 'os',
    header: 'inventory.col.os',
  },
  {
    accessorKey: 'poweredOn',
    id: 'poweredOn',
    header: 'inventory.col.poweredOn',
  },
  {
    accessorKey: 'provisionedMib',
    id: 'provisionedMib',
    header: 'inventory.col.provisionedMib',
    cell: (ctx) => fmtMemMb(ctx.getValue<number>()),
  },
  {
    accessorKey: 'guestType',
    id: 'guestType',
    header: 'inventory.col.guestType',
    cell: (ctx) => i18n.t(`inventory:guestType.${ctx.getValue<'qemu' | 'lxc'>()}`),
  },
]
