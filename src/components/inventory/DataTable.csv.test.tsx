import type { ColumnDef } from '@tanstack/react-table'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { DataTable } from './DataTable'

/**
 * INV-05 × INV-06 end-to-end contract: the CSV "Export current view"
 * serialises EXACTLY the filtered rows × the visible columns, with RAW
 * values (no locale grouping, no unit suffix), an embedded newline
 * preserved and RFC-4180 quoted, and a `vatlas-{kind}-YYYYMMDD.csv`
 * filename. Component-test idiom lifted from `AccountingModeToggle.test.tsx`
 * (`render`/`screen`/`userEvent`, `i18n.changeLanguage('en')`); the
 * `inventory` namespace is registered in 03-03, so `headerFor` resolves to
 * the raw `col.<id>` key here — the contract under test is the row/column
 * projection + raw-value discipline, not the localized header text.
 */

interface Fixture {
  name: string
  cluster: string
  // value deliberately carries an embedded newline (multi-line annotation)
  note: string
  vcpu: number
}

const fixtureColumns: ColumnDef<Fixture>[] = [
  { accessorKey: 'name', id: 'name', header: 'col.name', enableHiding: false },
  { accessorKey: 'cluster', id: 'cluster', header: 'col.cluster' },
  { accessorKey: 'note', id: 'note', header: 'col.note' },
  {
    accessorKey: 'vcpu',
    id: 'vcpu',
    header: 'col.vcpu',
    // DISPLAY cell formats with grouping — the CSV must BYPASS this and
    // emit the raw value (two-path discipline, 03-RESEARCH Pitfall 4).
    cell: (ctx) => ctx.getValue<number>().toLocaleString('en-US'),
  },
]

const data: Fixture[] = [
  { name: 'alpha', cluster: 'C1', note: 'line-1\nline-2', vcpu: 12_000 },
  { name: 'bravo', cluster: 'C2', note: 'plain', vcpu: 4 },
  { name: 'charlie', cluster: 'C1', note: 'plain', vcpu: 8 },
]

describe('DataTable CSV-of-current-view (INV-05 × INV-06)', () => {
  let capturedBlob: Blob | null
  let capturedDownloadName: string

  beforeEach(async () => {
    await i18n.changeLanguage('en')
    capturedBlob = null
    capturedDownloadName = ''

    // Capture the Blob handed to createObjectURL; its `.text()` Promise is
    // resolved in-test via `waitFor` (jsdom's Blob.text is supported).
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      capturedBlob = obj as Blob
      return 'blob:mock'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    // Capture the anchor download name (suppress the jsdom navigation).
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      capturedDownloadName = this.download
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports only the filtered rows × visible columns, raw values, newline preserved + quoted', async () => {
    const user = userEvent.setup()

    render(
      <DataTable data={data} columns={fixtureColumns} headerFor={(id) => id} objectKind="vm" />,
    )

    // Filter to the two C1 rows (excludes 'bravo' / C2).
    const filter = screen.getByRole('searchbox')
    await user.type(filter, 'C1')

    // Hide the 'cluster' column via the ColumnPicker (a hideable column).
    await user.click(screen.getByRole('button', { name: /columns\.button/i }))
    const clusterToggle = await screen.findByRole('checkbox', { name: /cluster/i })
    await user.click(clusterToggle)

    const exportBtn = screen.getByRole('button', { name: /export\.csv/i })

    // The global filter is debounced (FILTER_DEBOUNCE_MS). Re-export until
    // the captured CSV reflects the settled filtered model — this naturally
    // waits out the debounce without depending on the virtualised DOM.
    let capturedBlobText = ''
    await waitFor(
      async () => {
        await user.click(exportBtn)
        expect(capturedBlob).not.toBeNull()
        capturedBlobText = await (capturedBlob as unknown as Blob).text()
        expect(capturedBlobText).not.toContain('bravo')
      },
      { timeout: 2000 },
    )

    // Header row: visible columns only, 'cluster' absent.
    const lines = capturedBlobText.split('\r\n')
    expect(lines[0]).toBe('name,note,vcpu')
    expect(capturedBlobText).not.toContain('cluster')

    // Filtered out: 'bravo' (C2) must be absent; 'alpha' + 'charlie' present.
    expect(capturedBlobText).not.toContain('bravo')
    expect(capturedBlobText).toContain('alpha')
    expect(capturedBlobText).toContain('charlie')

    // RAW value: 12000 NOT '12,000' (display formatter bypassed).
    expect(capturedBlobText).toContain('12000')
    expect(capturedBlobText).not.toContain('12,000')

    // Embedded newline preserved AND RFC-4180 quoted.
    expect(capturedBlobText).toContain('"line-1\nline-2"')

    // Exactly header + 2 filtered data rows.
    expect(lines).toHaveLength(3)
  })

  it('names the file vatlas-{objectKind}-YYYYMMDD.csv', async () => {
    const user = userEvent.setup()
    render(
      <DataTable
        data={data}
        columns={fixtureColumns}
        headerFor={(id) => id}
        objectKind="datastore"
      />,
    )
    await user.click(screen.getByRole('button', { name: /export\.csv/i }))
    expect(capturedDownloadName).toMatch(/^vatlas-datastore-\d{8}\.csv$/)
  })
})
