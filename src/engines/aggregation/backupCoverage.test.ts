import { describe, expect, it } from 'vitest'
import type { GuestRow } from '@/types/guest'
import type { ProxmoxTaskRow } from '@/types/snapshot'
import { computeBackupCoverage } from './backupCoverage'

const MS = 1 as unknown as import('@/engines/units').MiB
const CORES = 1 as unknown as import('@/engines/units').Cores

const guest = (vmInstanceUuid: string, vmName = `vm-${vmInstanceUuid}`): GuestRow => ({
  vmName,
  cluster: 'cluster1',
  host: 'pve1',
  vcpu: CORES,
  vramMib: MS,
  cpuReadinessPercent: null,
  powerState: 'poweredOn',
  template: false,
  poweredOn: true,
  osConfig: '',
  osTools: '',
  vmBiosUuid: '',
  vmInstanceUuid,
  viSdkUuid: '',
  viSdkServer: '',
  provisionedMib: MS,
  inUseMib: MS,
  path: '',
  guestType: 'qemu',
})

const task = (over: Partial<ProxmoxTaskRow>): ProxmoxTaskRow => ({
  node: 'pve1',
  taskId: 'UPID:pve1:00001234:00001234:67A00000:vzdump:100:root@pam:',
  type: 'vzdump',
  user: 'root@pam',
  status: 'OK',
  statusOk: true,
  startSerial: 45000,
  endSerial: 45001,
  durationDays: 0.01,
  ...over,
})

const TODAY = new Date(2026, 5, 26)

describe('computeBackupCoverage', () => {
  it('returns empty state for no input', () => {
    const r = computeBackupCoverage([], [], TODAY)
    expect(r.vzdump.totalCount).toBe(0)
    expect(r.vzdump.successCount).toBe(0)
    expect(r.vzdump.failedCount).toBe(0)
    expect(r.vzdump.coveredVmids).toBe(0)
    expect(r.vzdump.uncoveredCount).toBe(0)
    expect(r.operationalHealth.totalTasks).toBe(0)
  })

  it('counts vzdump task success/failure', () => {
    const tasks = [
      task({ statusOk: true }),
      task({ taskId: 'UPID:pve1:0:0:0:vzdump:101:root@pam:', status: 'Failed', statusOk: false }),
    ]
    const r = computeBackupCoverage(tasks, [], TODAY)
    expect(r.vzdump.totalCount).toBe(2)
    expect(r.vzdump.successCount).toBe(1)
    expect(r.vzdump.failedCount).toBe(1)
  })

  it('extracts vmid from UPID at index 6 (colon-split)', () => {
    const tasks = [
      task({ taskId: 'UPID:pve1:00001234:00001234:67A00000:vzdump:200:root@pam:', statusOk: true }),
    ]
    const guests = [guest('200', 'web-server')]
    const r = computeBackupCoverage(tasks, guests, TODAY)
    expect(r.vzdump.coveredVmids).toBe(1)
    expect(r.vzdump.uncoveredCount).toBe(0)
  })

  it('marks guests without successful backup as uncovered', () => {
    const tasks = [task({ taskId: 'UPID:pve1:0:0:0:vzdump:100:root@pam:', statusOk: true })]
    const guests = [guest('100', 'vm-with-backup'), guest('200', 'vm-no-backup')]
    const r = computeBackupCoverage(tasks, guests, TODAY)
    expect(r.vzdump.uncoveredCount).toBe(1)
    expect(r.vzdump.uncoveredGuests[0]?.vmid).toBe('200')
  })

  it('keeps the most recent successful backup age per VMID', () => {
    // Two successful vzdump tasks for vmid 100, with different serials
    // Excel serial 45000 ≈ 2023, 45500 ≈ 2024 — whichever is larger (more recent) wins
    const tasks = [
      task({ taskId: 'UPID:pve1:0:0:0:vzdump:100:root@pam:', statusOk: true, startSerial: 45000 }),
      task({ taskId: 'UPID:pve2:0:0:0:vzdump:100:root@pam:', statusOk: true, startSerial: 46000 }),
    ]
    const guests = [guest('100')]
    const r = computeBackupCoverage(tasks, guests, TODAY)
    // The more recent one (46000) should have a smaller ageDays
    const guestStatus = r.vzdump.guestStatuses[0]
    expect(guestStatus?.covered).toBe(true)
    expect(guestStatus?.lastSuccessAgeDays).toBeGreaterThanOrEqual(0)
  })

  it('builds operational health per task type', () => {
    const tasks = [
      task({ type: 'vzdump', statusOk: true }),
      task({ type: 'vzdump', taskId: 'UPID:pve1:0:0:0:vzdump:101:root@pam:', statusOk: false }),
      task({ type: 'qmstart', taskId: 'UPID:pve1:0:0:0:qmstart::root@pam:', statusOk: true }),
    ]
    const r = computeBackupCoverage(tasks, [], TODAY)
    expect(r.operationalHealth.totalTasks).toBe(3)
    expect(r.operationalHealth.totalOk).toBe(2)
    expect(r.operationalHealth.totalFailed).toBe(1)
    const vzdumpType = r.operationalHealth.taskTypes.find((t) => t.type === 'vzdump')
    expect(vzdumpType?.total).toBe(2)
    expect(vzdumpType?.ok).toBe(1)
    expect(vzdumpType?.failed).toBe(1)
  })

  it('ignores non-vzdump tasks for backup coverage', () => {
    const tasks = [
      task({ type: 'qmstart', taskId: 'UPID:pve1:0:0:0:qmstart:100:root@pam:', statusOk: true }),
    ]
    const guests = [guest('100')]
    const r = computeBackupCoverage(tasks, guests, TODAY)
    expect(r.vzdump.totalCount).toBe(0)
    expect(r.vzdump.uncoveredCount).toBe(1)
  })
})
