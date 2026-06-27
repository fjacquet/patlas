import { describe, expect, it } from 'vitest'
import { classifyStorageRole } from '@/engines/parser/adapters/proxmox'
import { mib } from '@/engines/units'
import type { StorageRole, StorageRow } from '@/types/snapshot'
import { storageByRole } from './storageByRole'

const ds = (over: Partial<StorageRow>): StorageRow => ({
  name: 'DS',
  capacityMib: mib(0),
  freeMib: mib(0),
  provisionedMib: mib(0),
  naa: null,
  type: 'dir',
  role: 'other',
  hosts: '',
  clusterName: '',
  ...over,
})

describe('classifyStorageRole (cv4pve Storages sheet)', () => {
  it('PBS plugin → backup regardless of content/shared', () => {
    expect(classifyStorageRole('pbs', 'backup', true)).toBe('backup')
    expect(classifyStorageRole('PBS', '', true)).toBe('backup')
  })

  it('content dedicated to backup → backup', () => {
    expect(classifyStorageRole('dir', 'backup', true)).toBe('backup')
  })

  it('non-shared local/local-lvm → local (boot/OS), even with mixed content', () => {
    // Real cv4pve `local` carries `vztmpl,backup,iso`; still node-local boot.
    expect(classifyStorageRole('dir', 'vztmpl\nbackup\niso', false)).toBe('local')
    expect(classifyStorageRole('lvmthin', 'images\nrootdir', false)).toBe('local')
  })

  it('shared with images/rootdir → vmdata', () => {
    expect(classifyStorageRole('lvm', 'images', true)).toBe('vmdata')
    expect(classifyStorageRole('nfs', 'rootdir\nimages', true)).toBe('vmdata')
  })

  it('shared ISO/template-only library → other', () => {
    expect(classifyStorageRole('nfs', 'iso\nvztmpl', true)).toBe('other')
  })
})

describe('storageByRole', () => {
  it('sums capacity / used / free per role (used = capacity − free)', () => {
    const rows = [
      ds({ role: 'vmdata', capacityMib: mib(1000), freeMib: mib(400) }),
      ds({ role: 'vmdata', capacityMib: mib(500), freeMib: mib(100) }),
      ds({ role: 'backup', capacityMib: mib(2000), freeMib: mib(1500) }),
      ds({ role: 'local', capacityMib: mib(100), freeMib: mib(100) }),
    ]
    const out = storageByRole(rows)
    const vm = out.find((g) => g.role === 'vmdata')
    expect(vm).toBeDefined()
    expect(Number(vm?.capacityMib)).toBe(1500)
    expect(Number(vm?.usedMib)).toBe(1000) // (1000−400)+(500−100)
    expect(Number(vm?.freeMib)).toBe(500)
    expect(vm?.count).toBe(2)
    expect(vm?.usedRatio).toBeCloseTo(1000 / 1500)
  })

  it('does NOT dedupe by name — six per-node "local" storages all count', () => {
    const rows: StorageRow[] = Array.from({ length: 6 }, () =>
      ds({ name: 'local', role: 'local', capacityMib: mib(96), freeMib: mib(74) }),
    )
    const [local] = storageByRole(rows)
    expect(local?.count).toBe(6)
    expect(Number(local?.capacityMib)).toBe(576) // 6 × 96 — not collapsed to one
  })

  it('emits roles in canonical order (vmdata, backup, local, other), skipping empties', () => {
    const rows: StorageRow[] = [
      ds({ role: 'other', capacityMib: mib(10), freeMib: mib(10) }),
      ds({ role: 'backup', capacityMib: mib(10), freeMib: mib(10) }),
      ds({ role: 'vmdata', capacityMib: mib(10), freeMib: mib(10) }),
    ]
    expect(storageByRole(rows).map((g) => g.role)).toEqual<StorageRole[]>([
      'vmdata',
      'backup',
      'other',
    ])
  })

  it('zero capacity → usedRatio 0 (no divide-by-zero)', () => {
    const [g] = storageByRole([ds({ role: 'vmdata', capacityMib: mib(0), freeMib: mib(0) })])
    expect(g?.usedRatio).toBe(0)
  })

  it('empty input → empty result', () => {
    expect(storageByRole([])).toEqual([])
  })
})
