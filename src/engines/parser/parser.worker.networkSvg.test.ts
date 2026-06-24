/**
 * TDD test for Task pC-01: verify `parser.worker.ts` carries `networkSvg`
 * from a Proxmox `.zip` bundle onto the posted snapshot, and sets it to
 * `null` for a bare `.xlsx`.
 *
 * Approach: import the worker module directly (jsdom environment means
 * `self === window`). Stub `parseXlsx` and `adaptProxmox` so we don't need
 * a real SheetJS workbook. Drive the `self.onmessage` / `window.onmessage`
 * handler with synthetic message events and capture `self.postMessage` output.
 */
import { strToU8, zipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock heavy deps before the worker module is imported ──────────────────
vi.mock('./parseXlsx', () => ({
  parseXlsx: vi.fn(() => ({})),
}))

vi.mock('./adapters/proxmox', () => ({
  adaptProxmox: vi.fn(() => ({
    clusterName: 'test-cluster',
    vinfo: [],
    vhost: [],
    vmUsage: [],
    proxmoxSnapshots: [],
    proxmoxStorageContent: [],
    proxmoxHaResources: [],
    proxmoxHaStatus: [],
    proxmoxBackupJobs: [],
    vdatastore: [],
    warnings: [],
  })),
}))

// ── Helpers ───────────────────────────────────────────────────────────────

/** Build a Proxmox bundle `.zip` containing a fake `report.xlsx` and the
 *  given SVG content (or omit the SVG entry when `svgContent` is null). */
const makeProxmoxZip = (svgContent: string | null): Uint8Array => {
  const entries: Record<string, Uint8Array> = {
    'report.xlsx': strToU8('FAKEXLSX'),
  }
  if (svgContent !== null) {
    entries['network-diagram.svg'] = strToU8(svgContent)
  }
  return zipSync(entries)
}

/** Build a bare `.xlsx` (no inner `.xlsx` entry — just OOXML content). */
const makeBareXlsx = (): Uint8Array =>
  zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'xl/workbook.xml': strToU8('<workbook/>'),
  })

// ── Test suite ────────────────────────────────────────────────────────────

describe('parser.worker networkSvg assignment (pC-01)', () => {
  let posted: unknown[] = []
  let originalPostMessage: typeof self.postMessage

  beforeEach(async () => {
    // Capture postMessage calls made by the worker
    posted = []
    originalPostMessage = self.postMessage
    self.postMessage = (msg: unknown) => {
      posted.push(msg)
    }
    // Re-import the worker module so onmessage is installed fresh each test
    vi.resetModules()
    await import('./parser.worker')
  })

  afterEach(() => {
    self.postMessage = originalPostMessage
  })

  it('posts a snapshot with networkSvg containing "<svg" when given a Proxmox bundle zip', async () => {
    const zip = makeProxmoxZip('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>')
    const buf = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer

    const event = new MessageEvent('message', {
      data: { kind: 'parse', buf, filename: 'Report_20260101_120000.zip', mtime: 0 },
    })
    window.onmessage?.(event)
    // allow any microtasks to settle
    await Promise.resolve()

    expect(posted).toHaveLength(1)
    const msg = posted[0] as { kind: string; snapshot: { networkSvg?: string | null } }
    expect(msg.kind).toBe('ok')
    expect(msg.snapshot.networkSvg).toContain('<svg')
  })

  it('posts a snapshot with networkSvg === null when given a bare .xlsx', async () => {
    const xlsxBytes = makeBareXlsx()
    const buf = xlsxBytes.buffer.slice(
      xlsxBytes.byteOffset,
      xlsxBytes.byteOffset + xlsxBytes.byteLength,
    ) as ArrayBuffer

    const event = new MessageEvent('message', {
      data: { kind: 'parse', buf, filename: 'Report_20260101_120000.xlsx', mtime: 0 },
    })
    window.onmessage?.(event)
    await Promise.resolve()

    expect(posted).toHaveLength(1)
    const msg = posted[0] as { kind: string; snapshot: { networkSvg?: string | null } }
    expect(msg.kind).toBe('ok')
    expect(msg.snapshot.networkSvg).toBeNull()
  })
})
