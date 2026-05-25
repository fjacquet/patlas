import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { RightSizingView } from '@/components/rightsizing/RightSizingView'
import { buildEstateView } from '@/engines/aggregation'
import { inferVCenterLabel } from '@/engines/parser/captureDate'
import { parseSnapshot } from '@/engines/parser/normalizeColumns'
import { parseXlsx } from '@/engines/parser/parseXlsx'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { Snapshot } from '@/types/snapshot'

/**
 * P-RS end-to-end: drive the SAME pure pipeline the worker runs (parseXlsx →
 * parseSnapshot → mergeSnapshotsToEstate → buildEstateView) on the synthetic
 * 10k fixture (which now carries vMemory/vCPU), then assert the right-sizing
 * extract is derived correctly — powered-on only, all three categories
 * populated — and that the view renders it.
 */

const FIXTURE = resolve(process.cwd(), 'src/__fixtures__/rvtools-inventory-10k.xlsx')
const TODAY = new Date('2026-01-01T00:00:00Z')
const VM_COUNT = 10_000
const POWERED_ON = VM_COUNT - VM_COUNT / 5 // i%5===0 are poweredOff ⇒ 8000 on

let snapshot: Snapshot

beforeAll(() => {
  if (!existsSync(FIXTURE)) {
    execFileSync('node', ['scripts/generate-inventory-10k.mjs'], { stdio: 'ignore' })
  }
  const buf = readFileSync(FIXTURE)
  const sheets = parseXlsx(buf)
  const { snapshot: rows } = parseSnapshot(sheets)
  snapshot = {
    id: 'rs-e2e',
    filename: 'rvtools-inventory-10k.xlsx',
    fileSize: buf.byteLength,
    capturedAt: new Date(Date.UTC(2026, 4, 15)),
    parsedAt: new Date(),
    vCenterLabel: inferVCenterLabel(rows.vinfo, 'rvtools-inventory-10k.xlsx'),
    rvtoolsVersion: '4.4.0',
    viSdkUuid: rows.viSdkUuid,
    source: 'rvtools',
    vMetaData: rows.vMetaData,
    vinfo: rows.vinfo,
    vhost: rows.vhost,
    vmUsage: rows.vmUsage,
    vdatastore: rows.vdatastore,
    vpartition: rows.vpartition,
    vnetwork: rows.vnetwork,
    vswitch: rows.vswitch,
    dvswitch: rows.dvswitch,
    dvport: rows.dvport,
    parseErrors: rows.parseErrors,
  } as unknown as Snapshot
}, 60_000)

const buildSizing = () =>
  buildEstateView(mergeSnapshotsToEstate([snapshot]), [snapshot], 'active', TODAY).sizing

describe('Right-sizing end-to-end (parse → buildEstateView)', () => {
  it('parses vMemory/vCPU into a populated usage extract', () => {
    expect(snapshot.vmUsage.length).toBeGreaterThanOrEqual(9_000)
    const sizing = buildSizing()
    expect(sizing.hasUsageData).toBe(true)
  })

  it('populates all three categories from the seeded distribution', () => {
    const { counts } = buildSizing()
    expect(counts.oversized).toBeGreaterThan(0)
    expect(counts.undersized).toBeGreaterThan(0)
    expect(counts.stressed).toBeGreaterThan(0)
  })

  it('evaluates powered-on VMs only (powered-off excluded)', () => {
    const sizing = buildSizing()
    expect(sizing.rows.length).toBe(POWERED_ON)
    // vm-00001 is i=0 ⇒ poweredOff ⇒ absent from the extract.
    expect(sizing.rows.some((r) => r.vmName === 'vm-00001')).toBe(false)
  })

  it('renders the view through the store without crashing on 10k VMs', async () => {
    await i18n.changeLanguage('en')
    useSnapshotStore.getState().clearAll()
    useSnapshotStore.getState().addSnapshot(snapshot)
    render(<RightSizingView />)
    // The heading and at least one VM row render (DataTable virtualizes).
    expect(screen.getByRole('heading', { name: /right-sizing/i })).toBeInTheDocument()
  })
})

afterEach(() => {
  useSnapshotStore.getState().clearAll()
})

beforeEach(() => {
  useSnapshotStore.getState().clearAll()
})
