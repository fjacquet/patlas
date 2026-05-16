import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { InventoryTree } from '@/components/inventory/InventoryTree'
import { VmTable } from '@/components/inventory/VmTable'
import { buildEstateView } from '@/engines/aggregation'
import { inferVCenterLabel } from '@/engines/parser/captureDate'
import { parseSnapshot } from '@/engines/parser/normalizeColumns'
import { parseXlsx } from '@/engines/parser/parseXlsx'
import i18n from '@/i18n'
import type { Snapshot } from '@/types/snapshot'

/**
 * 10k-VM synthetic stress proof (ROADMAP Phase-3 success #1/#2/#4). Loads the
 * `generate-inventory-10k` fixture through the SAME pure parse pipeline the
 * worker runs (parseXlsx → parseSnapshot → buildEstateView), then asserts:
 *  - VM sort by `provisionedMib` desc completes < 200 ms (#2)
 *  - the virtualised tree keeps a BOUNDED rendered window at 10k (#1 proxy —
 *    fps is not measurable in jsdom; assert window node count ≪ total,
 *    03-RESEARCH line 462)
 *  - CSV export of a filtered VM view is the filtered rows, raw values,
 *    newline preserved, under BOTH `light` and `dark` theme classes (#4)
 *
 * The fixture is gitignored (regenerated on demand); generate it in
 * `beforeAll` if absent so CI is self-contained.
 */

const FIXTURE = resolve(process.cwd(), 'src/__fixtures__/rvtools-inventory-10k.xlsx')

let snapshot: Snapshot

beforeAll(() => {
  if (!existsSync(FIXTURE)) {
    execFileSync('node', ['scripts/generate-inventory-10k.mjs'], { stdio: 'ignore' })
  }
  const buf = readFileSync(FIXTURE)
  const sheets = parseXlsx(buf)
  const { snapshot: rows } = parseSnapshot(sheets)
  snapshot = {
    filename: 'rvtools-inventory-10k.xlsx',
    fileSize: buf.byteLength,
    capturedAt: new Date(Date.UTC(2026, 4, 15)),
    vCenterLabel: inferVCenterLabel(rows.vinfo, 'rvtools-inventory-10k.xlsx'),
    rvtoolsVersion: '4.4.0',
    viSdkUuid: rows.viSdkUuid,
    source: 'rvtools',
    vinfo: rows.vinfo,
    vhost: rows.vhost,
    vdatastore: rows.vdatastore,
    vpartition: rows.vpartition,
    parseErrors: rows.parseErrors,
  } as unknown as Snapshot
}, 60_000)

describe('Inventory 10k stress (ROADMAP Phase-3 #1/#2/#4)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })
  afterEach(() => {
    document.documentElement.classList.remove('dark')
    vi.restoreAllMocks()
  })

  it('parses ~10k VMs and projects vmRows in the single estate pass', () => {
    expect(snapshot.vinfo.length).toBeGreaterThanOrEqual(9_000)
    const view = buildEstateView(snapshot, 'active')
    expect(view.vmRows.length).toBe(snapshot.vinfo.length)
  })

  it('sorts the VM rows by provisionedMib desc in < 200 ms at 10k (#2)', () => {
    const view = buildEstateView(snapshot, 'active')
    const rows = view.vmRows.slice()
    const t0 = performance.now()
    rows.sort((a, b) => Number(b.provisionedMib) - Number(a.provisionedMib))
    const elapsed = performance.now() - t0
    // Sorted invariant + the ROADMAP #2 budget (do NOT widen — surface a
    // breach instead, 03-RESEARCH Pitfall 3).
    for (let i = 1; i < rows.length; i++) {
      expect(Number(rows[i - 1]?.provisionedMib)).toBeGreaterThanOrEqual(
        Number(rows[i]?.provisionedMib),
      )
    }
    expect(elapsed).toBeLessThan(200)
  })

  it('keeps the virtualised tree window bounded on expand/collapse at 10k (#1 proxy)', async () => {
    const view = buildEstateView(snapshot, 'active')
    const clustersOrdered = view.clusters.map((c) => c.cluster)
    const hostsByCluster = new Map<string, typeof view.hosts>()
    for (const h of view.hosts) {
      const l = hostsByCluster.get(h.cluster)
      if (l) l.push(h)
      else hostsByCluster.set(h.cluster, [h])
    }
    const vmsByHost = new Map<string, typeof view.vmRows>()
    for (const v of view.vmRows) {
      const l = vmsByHost.get(v.host)
      if (l) l.push(v)
      else vmsByHost.set(v.host, [v])
    }

    render(
      <InventoryTree
        rootLabel="vcenter.stress.local"
        clustersOrdered={clustersOrdered}
        hostsByCluster={hostsByCluster}
        vmsByHost={vmsByHost}
        selectedId={null}
        onSelect={() => {}}
      />,
    )

    const windowCount = () => document.querySelectorAll('[role="treeitem"]').length

    // Root-expanded default: only the root + clusters are flattened — the
    // 10k VM leaves are NOT materialised (lazy children, Critical-5).
    const collapsed = windowCount()
    expect(collapsed).toBeLessThan(200)

    // Expand the first cluster, then its first host — even with thousands of
    // VMs under a host the rendered window stays a bounded virtualised slice.
    const firstCluster = clustersOrdered[0]
    if (firstCluster) {
      await userEvent.click(screen.getByRole('button', { name: firstCluster }))
      const firstHost = hostsByCluster.get(firstCluster)?.[0]?.hostName
      if (firstHost) {
        await userEvent.click(screen.getByRole('button', { name: firstHost }))
      }
    }
    await waitFor(() => {
      // Far below the total leaf count — the virtualiser windows the DOM.
      expect(windowCount()).toBeLessThan(200)
    })
    expect(windowCount()).toBeLessThan(view.vmRows.length)
  })

  it('exports the filtered VM view (raw values, newline preserved) in light AND dark (#4)', async () => {
    const view = buildEstateView(snapshot, 'active')
    let capturedText = ''
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      void (obj as Blob).text().then((s) => {
        capturedText = s
      })
      return 'blob:mock'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    for (const theme of ['light', 'dark'] as const) {
      capturedText = ''
      document.documentElement.classList.toggle('dark', theme === 'dark')
      const user = userEvent.setup()
      const { unmount } = render(<VmTable rows={view.vmRows} />)

      // Filter to the deterministic multi-line annotation row the generator
      // embeds (row i===4242: its `os` carries a "\n" + the unique token
      // "maintenance window"); narrow + assert RFC-4180 quoting.
      const filter = screen.getByRole('searchbox')
      await user.type(filter, 'maintenance')

      const exportBtn = screen.getByRole('button', { name: /export csv/i })
      await waitFor(
        async () => {
          await user.click(exportBtn)
          expect(capturedText.length).toBeGreaterThan(0)
          expect(capturedText).toContain('\n')
        },
        { timeout: 2000 },
      )
      // RFC-4180: a field containing a newline is double-quoted.
      expect(capturedText).toMatch(/"[^"]*\n[^"]*"/)
      unmount()
    }
  })
})
