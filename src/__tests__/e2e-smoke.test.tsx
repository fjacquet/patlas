import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSnapshotStore } from '@/store/snapshotStore'

// jsdom cannot drive a real module Worker, so we mock the `parseInWorker`
// boundary to run the SAME pure pipeline the worker runs (parseXlsx →
// parseSnapshot → capture/vCenter/version inference) synchronously in-process.
// STRIDE T-05-05: this mock is test-only and exercises the identical code
// path; in production the real worker runs the privacy guard at its top.
vi.mock('@/engines/parser', async () => {
  const { parseXlsx } = await import('@/engines/parser/parseXlsx')
  const { parseSnapshot } = await import('@/engines/parser/normalizeColumns')
  const { inferCaptureDate, inferVCenterLabel, inferRvtoolsVersion } = await import(
    '@/engines/parser/captureDate'
  )

  return {
    parseInWorker: async (file: File) => {
      const buf = await file.arrayBuffer()
      const sheets = parseXlsx(buf)
      const { snapshot: rows, warnings } = parseSnapshot(sheets)
      const capturedAt = inferCaptureDate(file.name, file.lastModified, sheets)
      const vCenterLabel = inferVCenterLabel(rows.vinfo, file.name)
      const rvtoolsVersion = inferRvtoolsVersion(sheets)
      return {
        snapshot: {
          filename: file.name,
          fileSize: buf.byteLength,
          capturedAt,
          vCenterLabel,
          rvtoolsVersion,
          viSdkUuid: rows.viSdkUuid,
          source: 'rvtools' as const,
          vinfo: rows.vinfo,
          vhost: rows.vhost,
          vdatastore: rows.vdatastore,
          vpartition: rows.vpartition,
          parseErrors: rows.parseErrors,
        },
        warnings,
      }
    },
  }
})

// App imports `parseInWorker` transitively via useSnapshotUpload — import
// AFTER the mock is registered.
import App from '@/App'

describe('Phase 1 end-to-end smoke: drop → parse → render', () => {
  beforeEach(() => {
    useSnapshotStore.getState().clearAll()
  })

  it('renders the hero UploadZone when no snapshots are loaded', () => {
    render(<App />)
    expect(screen.queryByText(/vatlas/)).not.toBeNull()
    expect(screen.queryAllByRole('button').length).toBeGreaterThan(0)
  })

  it('drops the MiB canary fixture and renders a SnapshotCard with the expected metadata', async () => {
    const buf = readFileSync(resolve(process.cwd(), 'src/__fixtures__/rvtools-mib-canary.xlsx'))
    const file = new File([buf], 'rvtools-mib-canary.xlsx', {
      lastModified: Date.UTC(2026, 4, 15),
    })

    render(<App />)

    const inputs = document.querySelectorAll('input[type="file"]')
    expect(inputs.length).toBeGreaterThanOrEqual(1)
    const fileInput = inputs[0] as HTMLInputElement
    Object.defineProperty(fileInput, 'files', { value: [file] })

    await act(async () => {
      fireEvent.change(fileInput)
    })

    await waitFor(() => {
      expect(screen.queryByText(/rvtools-mib-canary\.xlsx/)).not.toBeNull()
    })

    // Capture-date indicator visible (FND-05). The canary's vMetaData carries
    // an Exported Timestamp in 2026; we assert the year appears (locale format
    // of toLocaleDateString varies, so we do not lock the exact string).
    expect(screen.getByText(/2026/).textContent).toMatch(/2026/)

    // vCenter label from the canary fixture.
    expect(screen.queryByText(/vcenter\.canary\.local/)).not.toBeNull()

    // RVTools version from vMetaData.
    expect(screen.queryByText(/4\.4\.0/)).not.toBeNull()

    // Row counts: 1 VM, 1 ESX, 1 cluster, 0 datastores (per the canary).
    expect(screen.getByText(/1 VMs/i)).not.toBeNull()
  })

  it('PAR-05: clearing the store mimics a refresh — no persisted dataset rows remain', () => {
    const { addSnapshot } = useSnapshotStore.getState()
    addSnapshot({
      id: 'test-id',
      filename: 'test.xlsx',
      fileSize: 0,
      capturedAt: new Date(),
      vCenterLabel: 'x',
      rvtoolsVersion: '4.4',
      parsedAt: new Date(),
      source: 'rvtools',
      viSdkUuid: null,
      vinfo: [],
      vhost: [],
      vdatastore: [],
      vpartition: [],
      parseErrors: [],
    } as unknown as Parameters<typeof addSnapshot>[0])
    expect(useSnapshotStore.getState().snapshots.size).toBe(1)

    // A page reload re-initializes the module-scope `new Map()`; clearAll is
    // the test-time equivalent. Nothing in this plan persists dataset rows.
    useSnapshotStore.getState().clearAll()
    expect(useSnapshotStore.getState().snapshots.size).toBe(0)

    // Only vatlas-lang / vatlas-theme UI prefs are allowed in localStorage.
    const stray = Object.keys(localStorage).filter(
      (k) => !k.startsWith('vatlas-lang') && !k.startsWith('vatlas-theme'),
    )
    expect(stray).toEqual([])
  })
})
