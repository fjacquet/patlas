import { describe, expect, it } from 'vitest'
import type {
  ProxmoxBackupJobRow,
  ProxmoxHaResourceRow,
  ProxmoxHaStatusRow,
} from '@/types/snapshot'
import { computeClusterHealth } from './clusterHealth'

const status = (over: Partial<ProxmoxHaStatusRow>): ProxmoxHaStatusRow => ({
  id: '',
  type: '',
  status: '',
  node: '',
  sid: '',
  state: '',
  crmState: '',
  requestState: '',
  quorate: '',
  ...over,
})
const job = (over: Partial<ProxmoxBackupJobRow>): ProxmoxBackupJobRow => ({
  id: 'j',
  enabled: true,
  all: false,
  vmId: '',
  mode: '',
  storage: '',
  startTime: '',
  schedule: '',
  dayOfWeek: '',
  compress: '',
  type: '',
  node: '',
  ...over,
})

describe('computeClusterHealth', () => {
  it('is empty for no input', () => {
    const h = computeClusterHealth([], [], [])
    expect(h.ha.managedCount).toBe(0)
    expect(h.ha.quorumStatus).toBeNull()
    expect(h.ha.fencingStatus).toBeNull()
    expect(h.backups.jobCount).toBe(0)
    expect(h.backups.guestsCovered).toBe(0)
  })

  it('derives quorum/fencing status from the HA status rows', () => {
    const h = computeClusterHealth(
      [],
      [status({ type: 'quorum', status: 'OK' }), status({ type: 'fencing', status: 'standby' })],
      [],
    )
    expect(h.ha.quorumStatus).toBe('OK')
    expect(h.ha.fencingStatus).toBe('standby')
    expect(h.ha.services).toHaveLength(2)
  })

  it('counts HA resources', () => {
    const res: ProxmoxHaResourceRow[] = [
      {
        sid: 'vm:100',
        type: 'vm',
        state: 'started',
        group: '',
        failback: '',
        maxRestart: 1,
        maxRelocate: 1,
        comment: '',
      },
    ]
    expect(computeClusterHealth(res, [], []).ha.managedCount).toBe(1)
  })

  it('summarizes backup jobs: count, enabled, distinct guests covered', () => {
    const h = computeClusterHealth(
      [],
      [],
      [
        job({ id: 'a', enabled: true, vmId: '100,101' }),
        job({ id: 'b', enabled: false, vmId: '102' }),
      ],
    )
    expect(h.backups.jobCount).toBe(2)
    expect(h.backups.enabledCount).toBe(1)
    // distinct guests across ALL jobs: 100,101,102
    expect(h.backups.guestsCovered).toBe(3)
  })
})
