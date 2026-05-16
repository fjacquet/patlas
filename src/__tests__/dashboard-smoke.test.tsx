import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'

// SVG-assertion path — identical documented fallback 02-01's Chart.test.tsx
// chose (RESEARCH Open Question 2): jsdom cannot mount real ReactEChartsCore /
// produce ECharts SVG geometry, so we mock `echarts-for-react/esm/core` with a
// stand-in that emits an inline <svg> IFF the centrally-injected
// `opts.renderer === 'svg'` (VIZ-01), else a <canvas>. This proves the
// dashboard's charts are SVG-wired (Pitfall 3) deterministically.
vi.mock('echarts-for-react/esm/core', () => ({
  default: (props: { opts?: { renderer?: string }; theme?: string }) =>
    props.opts?.renderer === 'svg' ? (
      <svg data-testid="echarts-svg" data-theme={props.theme} />
    ) : (
      <canvas data-testid="echarts-canvas" />
    ),
}))

// Same synchronous-pipeline boundary mock as e2e-smoke: run the real pure
// parse pipeline in-process (jsdom cannot drive a module Worker).
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
      return {
        snapshot: {
          filename: file.name,
          fileSize: buf.byteLength,
          capturedAt: inferCaptureDate(file.name, file.lastModified, sheets),
          vCenterLabel: inferVCenterLabel(rows.vinfo, file.name),
          rvtoolsVersion: inferRvtoolsVersion(sheets),
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

import App from '@/App'

const dropFile = async (path: string, name: string) => {
  const buf = readFileSync(path)
  const file = new File([buf], name, { lastModified: Date.UTC(2026, 4, 15) })
  const fileInput = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement
  Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
  await act(async () => {
    fireEvent.change(fileInput)
  })
}

describe('Phase 2 dashboard smoke: drop → buildEstateView → <GlobalDashboard>', () => {
  beforeEach(async () => {
    useSnapshotStore.getState().clearAll()
    await i18n.changeLanguage('en')
  })
  afterEach(cleanup)

  it('renders the empty-state hero before any snapshot is loaded', () => {
    render(<App />)
    // No snapshot → App shows the hero UploadZone branch (dashboard not mounted).
    expect(screen.queryByText(/No snapshot loaded/)).toBeNull()
    expect(document.querySelectorAll('input[type="file"]').length).toBeGreaterThan(0)
  })

  it('drops the MiB canary and renders the estate dashboard (DSH-01..06, SVG-wired)', async () => {
    render(<App />)
    await dropFile(
      resolve(process.cwd(), 'src/__fixtures__/rvtools-mib-canary.xlsx'),
      'rvtools-mib-canary.xlsx',
    )

    // Section titles present (i18n dashboard namespace, EN). "Clusters" also
    // appears as a summary tile label, so query the section <h2> by role.
    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: 'Clusters' })).not.toBeNull()
    })
    expect(screen.queryByRole('heading', { level: 2, name: 'Operating systems' })).not.toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: 'CPU Ready' })).not.toBeNull()

    // Exactly one cluster column for the single-cluster canary (the cluster
    // heading is an <h3>; "Clusters" section title is an <h2>).
    const clusterHeadings = screen
      .getAllByRole('heading', { level: 3 })
      .filter((h) => h.textContent && h.textContent.trim().length > 0)
    expect(clusterHeadings.length).toBe(1)

    // ESX label present in the cluster column (DSH-01).
    expect(screen.getAllByText('ESX').length).toBeGreaterThan(0)

    // CPU Ready estate panel + the gold count label (DSH-05).
    expect(screen.getAllByText(/VMs > 5% CPU Ready/).length).toBeGreaterThan(0)

    // SVG renderer wired (Pitfall 3): every chart host emitted an <svg>, no
    // <canvas> anywhere in the rendered dashboard.
    expect(document.querySelectorAll('[data-testid="echarts-svg"]').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-testid="echarts-canvas"]')).toBeNull()
  })

  it('toggling accounting mode recomputes via useEstateView (Critical-6 / ROADMAP #2)', async () => {
    // Use the realistic ~50/50 powered-on fixture so Configured ≠ Active.
    // tests/fixtures/*.xlsx are gitignored (01-04) — guard so CI (no real
    // fixtures) still passes on the canary path; this block is best-effort.
    const realFixture = resolve(
      process.cwd(),
      'tests/fixtures/RVTools_export_all_2026-04-17_16.51.38-MOM-vCenter.xlsx',
    )
    if (!existsSync(realFixture)) {
      // Canary has all-powered-on VMs, so modes may not differ — assert the
      // toggle at least re-renders without throwing (structural fallback).
      render(<App />)
      await dropFile(
        resolve(process.cwd(), 'src/__fixtures__/rvtools-mib-canary.xlsx'),
        'rvtools-mib-canary.xlsx',
      )
      await waitFor(() =>
        expect(screen.queryByRole('heading', { level: 2, name: 'Clusters' })).not.toBeNull(),
      )
      await userEvent.click(screen.getByText('Configured'))
      expect(screen.getByText('Configured').getAttribute('aria-pressed')).toBe('true')
      return
    }

    render(<App />)
    await dropFile(realFixture, 'RVTools_export_all_2026-04-17_16.51.38-MOM-vCenter.xlsx')
    await waitFor(() =>
      expect(screen.queryByRole('heading', { level: 2, name: 'Clusters' })).not.toBeNull(),
    )

    // Multiple per-cluster columns render for the multi-cluster real estate.
    const clusterHeadings = screen
      .getAllByRole('heading', { level: 3 })
      .filter((h) => h.textContent && h.textContent.trim().length > 0)
    expect(clusterHeadings.length).toBeGreaterThan(1)

    // Read a summary figure (vCPU tile) in Active (default), then Configured.
    const summary = screen.getByLabelText('Estate summary')
    const vcpuActive = within(summary).getByText('vCPU').nextElementSibling?.textContent ?? ''

    await userEvent.click(screen.getByText('Configured'))
    await waitFor(() => {
      expect(screen.getByText('Configured').getAttribute('aria-pressed')).toBe('true')
    })
    const summary2 = screen.getByLabelText('Estate summary')
    const vcpuConfigured = within(summary2).getByText('vCPU').nextElementSibling?.textContent ?? ''

    // Configured (all VMs incl. powered-off) ≠ Active (powered-on only) — the
    // powered-off-VM trap is surfaced (three distinct totals, ROADMAP #2/#6).
    expect(vcpuConfigured).not.toBe(vcpuActive)
  })
})
