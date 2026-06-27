/**
 * Pack C — Governance & Ops posture. Pure: no React/DOM/Zustand/Zod.
 * Sourced from three sheets: Issues, Cluster Access, Cluster Pools.
 */
import type {
  ProxmoxAccessAclRow,
  ProxmoxAccessRoleRow,
  ProxmoxAccessTokenRow,
  ProxmoxAccessUserRow,
  ProxmoxIssueRow,
  ProxmoxPoolMemberRow,
} from '@/types/snapshot'

export interface IssuesPosture {
  rows: ProxmoxIssueRow[]
  totalCount: number
  errorCount: number
  warningCount: number
  bySection: { section: string; count: number }[]
}

export interface AccessPosture {
  users: ProxmoxAccessUserRow[]
  tokens: ProxmoxAccessTokenRow[]
  roles: ProxmoxAccessRoleRow[]
  acls: ProxmoxAccessAclRow[]
  userCount: number
  enabledUserCount: number
  tokenCount: number
  roleCount: number
  aclCount: number
  /** Count of users whose id starts with 'root'. */
  rootCount: number
}

export interface PoolGroup {
  pool: string
  memberCount: number
  vmCount: number
  storageCount: number
}

export interface PoolsPosture {
  members: ProxmoxPoolMemberRow[]
  poolCount: number
  totalMembers: number
  pools: PoolGroup[]
}

export interface GovernancePosture {
  issues: IssuesPosture
  access: AccessPosture
  pools: PoolsPosture
}

export const computeIssuesPosture = (rows: ProxmoxIssueRow[]): IssuesPosture => {
  const sectionCounts = new Map<string, number>()
  let errorCount = 0
  let warningCount = 0
  for (const r of rows) {
    if (r.severity.toLowerCase() === 'error') errorCount += 1
    else warningCount += 1
    sectionCounts.set(r.section, (sectionCounts.get(r.section) ?? 0) + 1)
  }
  const bySection = [...sectionCounts.entries()]
    .map(([section, count]) => ({ section, count }))
    .sort((a, b) => b.count - a.count)
  return { rows, totalCount: rows.length, errorCount, warningCount, bySection }
}

export const computeAccessPosture = (
  users: ProxmoxAccessUserRow[],
  tokens: ProxmoxAccessTokenRow[],
  roles: ProxmoxAccessRoleRow[],
  acls: ProxmoxAccessAclRow[],
): AccessPosture => ({
  users,
  tokens,
  roles,
  acls,
  userCount: users.length,
  enabledUserCount: users.filter((u) => u.enabled).length,
  tokenCount: tokens.length,
  roleCount: roles.length,
  aclCount: acls.length,
  rootCount: users.filter((u) => u.id.toLowerCase().startsWith('root')).length,
})

export const computePoolsPosture = (members: ProxmoxPoolMemberRow[]): PoolsPosture => {
  const byPool = new Map<string, { vmCount: number; storageCount: number; memberCount: number }>()
  for (const m of members) {
    const g = byPool.get(m.pool) ?? { vmCount: 0, storageCount: 0, memberCount: 0 }
    g.memberCount += 1
    if (m.type === 'storage') g.storageCount += 1
    else g.vmCount += 1
    byPool.set(m.pool, g)
  }
  const pools = [...byPool.entries()]
    .map(([pool, g]) => ({ pool, ...g }))
    .sort((a, b) => b.memberCount - a.memberCount)
  return { members, poolCount: byPool.size, totalMembers: members.length, pools }
}

export const computeGovernance = (
  issues: ProxmoxIssueRow[],
  accessUsers: ProxmoxAccessUserRow[],
  accessTokens: ProxmoxAccessTokenRow[],
  accessRoles: ProxmoxAccessRoleRow[],
  accessAcls: ProxmoxAccessAclRow[],
  poolMembers: ProxmoxPoolMemberRow[],
): GovernancePosture => ({
  issues: computeIssuesPosture(issues),
  access: computeAccessPosture(accessUsers, accessTokens, accessRoles, accessAcls),
  pools: computePoolsPosture(poolMembers),
})
