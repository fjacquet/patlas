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
  })
})
