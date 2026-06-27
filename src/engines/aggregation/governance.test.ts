import { describe, expect, it } from 'vitest'
import type {
  ProxmoxAccessAclRow,
  ProxmoxAccessRoleRow,
  ProxmoxAccessTokenRow,
  ProxmoxAccessUserRow,
  ProxmoxIssueRow,
  ProxmoxPoolMemberRow,
} from '@/types/snapshot'
import {
  computeAccessPosture,
  computeGovernance,
  computeIssuesPosture,
  computePoolsPosture,
} from './governance'

const makeIssue = (overrides: Partial<ProxmoxIssueRow> = {}): ProxmoxIssueRow => ({
  severity: 'Warning',
  section: 'Backup',
  message: 'No backup job configured',
  timestampSerial: null,
  linkKey: '',
  ...overrides,
})

const makeUser = (overrides: Partial<ProxmoxAccessUserRow> = {}): ProxmoxAccessUserRow => ({
  id: 'admin@pam',
  enabled: true,
  firstname: 'Admin',
  lastname: '',
  email: '',
  groups: '',
  keys: '',
  totpLocked: false,
  expire: '',
  comment: '',
  ...overrides,
})

const makeToken = (overrides: Partial<ProxmoxAccessTokenRow> = {}): ProxmoxAccessTokenRow => ({
  user: 'admin@pam',
  tokenId: 'ci-token',
  expire: '',
  privSeparated: true,
  comment: '',
  ...overrides,
})

const makeRole = (overrides: Partial<ProxmoxAccessRoleRow> = {}): ProxmoxAccessRoleRow => ({
  id: 'Administrator',
  privileges: 'Sys.PowerMgmt',
  special: true,
  ...overrides,
})

const makeAcl = (overrides: Partial<ProxmoxAccessAclRow> = {}): ProxmoxAccessAclRow => ({
  path: '/',
  usersOrGroup: 'admin@pam',
  type: 'user',
  roleId: 'Administrator',
  propagate: true,
  ...overrides,
})

const makeMember = (overrides: Partial<ProxmoxPoolMemberRow> = {}): ProxmoxPoolMemberRow => ({
  pool: 'dev',
  type: 'qemu',
  node: 'node1',
  vmId: '100',
  storage: '',
  status: 'running',
  description: '',
  comment: '',
  ...overrides,
})

describe('computeIssuesPosture', () => {
  it('returns zero counts for empty input', () => {
    const result = computeIssuesPosture([])
    expect(result.totalCount).toBe(0)
    expect(result.errorCount).toBe(0)
    expect(result.warningCount).toBe(0)
    expect(result.bySection).toEqual([])
  })

  it('counts errors and warnings correctly', () => {
    const issues = [
      makeIssue({ severity: 'Error', section: 'HA' }),
      makeIssue({ severity: 'Warning', section: 'Backup' }),
      makeIssue({ severity: 'Warning', section: 'Backup' }),
    ]
    const result = computeIssuesPosture(issues)
    expect(result.totalCount).toBe(3)
    expect(result.errorCount).toBe(1)
    expect(result.warningCount).toBe(2)
  })

  it('groups by section and sorts by count descending', () => {
    const issues = [
      makeIssue({ section: 'Backup' }),
      makeIssue({ section: 'Backup' }),
      makeIssue({ section: 'HA' }),
    ]
    const result = computeIssuesPosture(issues)
    expect(result.bySection[0]).toEqual({ section: 'Backup', count: 2 })
    expect(result.bySection[1]).toEqual({ section: 'HA', count: 1 })
  })
})

describe('computeAccessPosture', () => {
  it('returns zero counts for empty input', () => {
    const result = computeAccessPosture([], [], [], [])
    expect(result.userCount).toBe(0)
    expect(result.tokenCount).toBe(0)
    expect(result.rootCount).toBe(0)
  })

  it('counts enabled users and root accounts', () => {
    const users = [
      makeUser({ id: 'root@pam', enabled: true }),
      makeUser({ id: 'admin@pam', enabled: true }),
      makeUser({ id: 'viewer@pam', enabled: false }),
    ]
    const result = computeAccessPosture(users, [], [], [])
    expect(result.userCount).toBe(3)
    expect(result.enabledUserCount).toBe(2)
    expect(result.rootCount).toBe(1)
  })

  it('counts tokens, roles, and ACLs', () => {
    const result = computeAccessPosture(
      [makeUser()],
      [makeToken(), makeToken()],
      [makeRole()],
      [makeAcl(), makeAcl(), makeAcl()],
    )
    expect(result.tokenCount).toBe(2)
    expect(result.roleCount).toBe(1)
    expect(result.aclCount).toBe(3)
  })
})

describe('computePoolsPosture', () => {
  it('returns empty for no members', () => {
    const result = computePoolsPosture([])
    expect(result.poolCount).toBe(0)
    expect(result.totalMembers).toBe(0)
    expect(result.pools).toEqual([])
  })

  it('groups members by pool', () => {
    const members = [
      makeMember({ pool: 'dev', type: 'qemu' }),
      makeMember({ pool: 'dev', type: 'lxc' }),
      makeMember({ pool: 'prod', type: 'qemu' }),
    ]
    const result = computePoolsPosture(members)
    expect(result.poolCount).toBe(2)
    expect(result.totalMembers).toBe(3)
    const dev = result.pools.find((p) => p.pool === 'dev')
    expect(dev?.memberCount).toBe(2)
    expect(dev?.vmCount).toBe(2)
    expect(dev?.storageCount).toBe(0)
  })

  it('sorts pools by member count descending', () => {
    const members = [
      makeMember({ pool: 'small' }),
      makeMember({ pool: 'big' }),
      makeMember({ pool: 'big' }),
      makeMember({ pool: 'big' }),
    ]
    const result = computePoolsPosture(members)
    expect(result.pools[0]?.pool).toBe('big')
    expect(result.pools[1]?.pool).toBe('small')
  })
})

describe('computeGovernance', () => {
  it('assembles all three postures', () => {
    const result = computeGovernance(
      [makeIssue()],
      [makeUser()],
      [makeToken()],
      [makeRole()],
      [makeAcl()],
      [makeMember()],
    )
    expect(result.issues.totalCount).toBe(1)
    expect(result.access.userCount).toBe(1)
    expect(result.pools.poolCount).toBe(1)
  })
})
