import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { adaptProxmox } from './adapters/proxmox'
import { parseXlsx } from './parseXlsx'

const fixture = join(__dirname, '__fixtures__/proxmox-report.xlsx')
const maybe = existsSync(fixture) ? it : it.skip

describe('proxmox real-file integration', () => {
  maybe('parses the real Proxmox report into a non-empty estate', () => {
    const wb = parseXlsx(readFileSync(fixture))
    const b = adaptProxmox(wb)
    expect(b.vhost.length).toBeGreaterThan(0)
    expect(b.vinfo.length).toBeGreaterThan(0)
    expect(b.vinfo.some((g) => g.guestType === 'qemu')).toBe(true)
    expect(b.vinfo.some((g) => g.guestType === 'lxc')).toBe(true)
    expect(b.vinfo.every((g) => g.vramMib >= 0)).toBe(true)
    // Plan 3A: the Snapshots sheet parses; the real report holds only the
    // per-guest 'current' live-state markers (no real checkpoints).
    expect(b.proxmoxSnapshots.length).toBeGreaterThan(0)
    expect(b.proxmoxSnapshots.every((s) => ['qemu', 'lxc'].includes(s.guestType))).toBe(true)
    expect(b.proxmoxSnapshots.every((s) => s.name.toLowerCase() === 'current')).toBe(true)
    // Plan 3B: the Storage Content sheet parses; the real report has disk images, ISOs, templates.
    expect(b.proxmoxStorageContent.length).toBeGreaterThan(0)
    expect(b.proxmoxStorageContent.some((r) => r.contentType === 'images')).toBe(true)
    expect(b.proxmoxStorageContent.every((r) => r.fileName !== '')).toBe(true)
  })
})
