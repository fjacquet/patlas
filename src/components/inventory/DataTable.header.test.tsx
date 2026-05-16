import type { ColumnDef } from '@tanstack/react-table'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { DataTable } from './DataTable'

/**
 * UAT regression (Fix B): the visible `<thead>` MUST render the localized
 * `t('col.<id>')` text, NEVER the raw `inventory.col.*` / `col.*` key
 * string — and the CSV header row MUST use the SAME localized text (single
 * source of truth). Verified in BOTH EN and FR.
 */

interface Fixture {
  capacityMib: number
  cluster: string
}

const fixtureColumns: ColumnDef<Fixture>[] = [
  {
    accessorKey: 'capacityMib',
    id: 'capacityMib',
    header: 'inventory.col.capacityMib',
    enableHiding: false,
  },
  { accessorKey: 'cluster', id: 'cluster', header: 'inventory.col.cluster' },
]

const data: Fixture[] = [{ capacityMib: 1024, cluster: 'C1' }]

describe('DataTable header localization (Fix B UAT regression)', () => {
  let capturedBlob: Blob | null

  beforeEach(() => {
    capturedBlob = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      capturedBlob = obj as Blob
      return 'blob:mock'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the EN localized header — not the raw key — and the CSV uses the same text', async () => {
    await i18n.changeLanguage('en')
    const user = userEvent.setup()
    render(
      <DataTable
        data={data}
        columns={fixtureColumns}
        headerFor={(id) => i18n.t(`col.${id}`, { ns: 'inventory' })}
        objectKind="datastore"
      />,
    )

    const head = screen.getByRole('columnheader', { name: /capacity \(mib\)/i })
    expect(head.textContent).toContain('Capacity (MiB)')
    // The raw key string must NOT leak into the DOM.
    expect(head.textContent).not.toContain('inventory.col.capacityMib')
    expect(head.textContent).not.toContain('col.capacityMib')

    await user.click(screen.getByRole('button', { name: /export csv/i }))
    await waitFor(async () => {
      expect(capturedBlob).not.toBeNull()
    })
    const csv = await (capturedBlob as unknown as Blob).text()
    // CSV header row uses the SAME localized text as the visible <thead>.
    expect(csv.split('\r\n')[0]).toBe('Capacity (MiB),Cluster')
    expect(csv).not.toContain('col.capacityMib')
  })

  it('renders the FR localized header — not the raw key — and the CSV uses the same text', async () => {
    await i18n.changeLanguage('fr')
    const user = userEvent.setup()
    render(
      <DataTable
        data={data}
        columns={fixtureColumns}
        headerFor={(id) => i18n.t(`col.${id}`, { ns: 'inventory' })}
        objectKind="datastore"
      />,
    )

    const head = screen.getByRole('columnheader', { name: /capacité \(mio\)/i })
    expect(head.textContent).toContain('Capacité (Mio)')
    expect(head.textContent).not.toContain('inventory.col.capacityMib')
    expect(head.textContent).not.toContain('col.capacityMib')

    await user.click(screen.getByRole('button', { name: /csv/i }))
    await waitFor(async () => {
      expect(capturedBlob).not.toBeNull()
    })
    const csv = await (capturedBlob as unknown as Blob).text()
    expect(csv.split('\r\n')[0]).toBe('Capacité (Mio),Cluster')

    await i18n.changeLanguage('en')
  })
})
