import type { MiB } from '@/engines/units'
import { mib } from '@/engines/units'
import type { StorageRole, StorageRow } from '@/types/snapshot'

/**
 * Storage capacity / used / free grouped by cv4pve {@link StorageRole}.
 *
 * Proxmox datastores serve very different purposes — VM disk images, backup
 * repositories, node-local boot/OS storage — so a single "total capacity"
 * figure is misleading (a few PBS backup repos routinely dwarf VM storage by
 * 5×). Grouping by role keeps VM storage legible and shows backup / local as
 * separate labelled groups.
 *
 * Sums the RAW `StorageRow[]` (NOT the NAA-deduped `perDatastore` rollup):
 * cv4pve lists each shared storage once and each node-local storage once per
 * node, so a straight per-row sum is exactly right here. Name-deduping (which
 * `perDatastore` does for shared VMware LUNs) would WRONGLY collapse the six
 * distinct per-node `local`/`local-lvm` storages into one — they merely share
 * a name, they are not the same physical device.
 *
 * `used = capacity − free` (cv4pve reports both; thin pools report 0 used).
 * Pure — no React/Zustand/Zod/DOM.
 */
export interface StorageRoleGroup {
  role: StorageRole
  /** Number of Storages-sheet rows folded into this role. */
  count: number
  capacityMib: MiB
  usedMib: MiB
  freeMib: MiB
}

/** Canonical display order — VM storage leads, backup + local follow. */
const ROLE_ORDER: readonly StorageRole[] = ['vmdata', 'backup', 'local', 'other']

export const storageByRole = (storages: StorageRow[]): StorageRoleGroup[] => {
  const cap = new Map<StorageRole, number>()
  const free = new Map<StorageRole, number>()
  const count = new Map<StorageRole, number>()
  for (const s of storages) {
    cap.set(s.role, (cap.get(s.role) ?? 0) + (s.capacityMib as number))
    free.set(s.role, (free.get(s.role) ?? 0) + (s.freeMib as number))
    count.set(s.role, (count.get(s.role) ?? 0) + 1)
  }
  const out: StorageRoleGroup[] = []
  for (const role of ROLE_ORDER) {
    const n = count.get(role)
    if (n === undefined) continue
    const capacity = cap.get(role) ?? 0
    const freeMib = free.get(role) ?? 0
    const used = Math.max(0, capacity - freeMib)
    out.push({
      role,
      count: n,
      capacityMib: mib(capacity),
      usedMib: mib(used),
      freeMib: mib(freeMib),
    })
  }
  return out
}
