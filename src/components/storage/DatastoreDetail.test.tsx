import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mib } from '@/engines/units'
import i18n from '@/i18n'
import type { DatastoreDetailEntry } from '@/types/estate'
import { DatastoreDetail } from './DatastoreDetail'

const entry = (over: Partial<DatastoreDetailEntry> = {}): DatastoreDetailEntry => ({
  key: 'naa.1',
  name: 'DS_A',
  type: 'vSAN',
  capacityMib: mib(1000),
  freeMib: mib(100),
  usedMib: mib(900),
  provisionedMib: mib(800),
  usedRatio: 0.9,
  sharedDuplicateCount: 1,
  hostCount: 3,
  vms: ['vm-a', 'vm-b'],
  dsFlagged: true,
  luFlagged: false,
  ...over,
})

describe('DatastoreDetail (LC-4)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders the datastore title, factual rows, and the VM list', () => {
    render(<DatastoreDetail detail={entry()} onBack={() => {}} />)
    expect(screen.getByText(/DS_A/)).not.toBeNull()
    expect(screen.getByText(/vm-a, vm-b/)).not.toBeNull()
  })

  it('fires onBack from the back affordance', async () => {
    const onBack = vi.fn()
    render(<DatastoreDetail detail={entry()} onBack={onBack} />)
    await userEvent.click(screen.getByText(/Back/))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('renders the em-dash when hostCount is null and vms empty (not fabricated)', () => {
    render(<DatastoreDetail detail={entry({ hostCount: null, vms: [] })} onBack={() => {}} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('uses the factual gold marker (no status-colour class) when flagged', () => {
    const { container } = render(<DatastoreDetail detail={entry()} onBack={() => {}} />)
    expect(container.querySelector('.bg-accent-500\\/15')).not.toBeNull()
    // Negative assertion built at runtime so the source carries no literal
    // status-colour token (CLAUDE.md grep-gate gotcha).
    const banned = [`util-${'high'}`, `bg-${'red'}-500`, `${'amb'}er`]
    for (const cls of banned) {
      expect(container.querySelector(`[class*="${cls}"]`)).toBeNull()
    }
  })
})
