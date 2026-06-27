/**
 * Pack C — Access posture slide: KPI band (users / enabled / tokens / roles /
 * ACL entries / root accounts) + two native tables (users, tokens). Factual,
 * no editorial verbs.
 */
import type PptxGenJS from 'pptxgenjs'
import type { AccessPosture } from '@/engines/aggregation/governance'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

const TOP_N = 10

export function addAccessPostureSlide(
  pptx: PptxGenJS,
  access: AccessPosture,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['governance.access.title'] ?? 'Access posture')

  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['governance.access.kpi.users'] ?? 'Users',
        value: pptxNumber(access.userCount, locale),
      },
      {
        label: strings['governance.access.kpi.enabled'] ?? 'Enabled',
        value: pptxNumber(access.enabledUserCount, locale),
      },
      {
        label: strings['governance.access.kpi.tokens'] ?? 'API tokens',
        value: pptxNumber(access.tokenCount, locale),
      },
      {
        label: strings['governance.access.kpi.roles'] ?? 'Roles',
        value: pptxNumber(access.roleCount, locale),
      },
      {
        label: strings['governance.access.kpi.acls'] ?? 'ACL entries',
        value: pptxNumber(access.aclCount, locale),
      },
      {
        label: strings['governance.access.kpi.rootAccounts'] ?? 'Root accounts',
        value: pptxNumber(access.rootCount, locale),
      },
    ],
    y,
  )

  const tableY = y2 + 0.1
  const halfW = (CONTENT_W - 0.2) / 2

  const cell = (text: string, opts: Record<string, unknown> = {}) => ({
    text: pptxSafeFormat(text),
    options: { fontFace: 'Arial', fontSize: 10, color: PPTX_COLORS.ink, ...opts },
  })

  // Users table (left column)
  const usersHeading = strings['governance.access.users.heading'] ?? 'Users'
  s.addText(pptxSafeFormat(usersHeading), {
    x: M,
    y: tableY,
    w: halfW,
    h: 0.28,
    fontFace: 'Arial',
    fontSize: 11,
    bold: true,
    color: PPTX_COLORS.ink,
    margin: 0,
  })

  if (access.users.length > 0) {
    const usersHeader = [
      cell(strings['governance.access.users.col.id'] ?? 'ID', {
        bold: true,
        color: PPTX_COLORS.inkMuted,
      }),
      cell(strings['governance.access.users.col.enabled'] ?? 'Enabled', {
        bold: true,
        color: PPTX_COLORS.inkMuted,
      }),
      cell(strings['governance.access.users.col.email'] ?? 'Email', {
        bold: true,
        color: PPTX_COLORS.inkMuted,
      }),
    ]
    const usersDataRows = access.users
      .slice(0, TOP_N)
      .map((u) => [cell(u.id), cell(u.enabled ? '✓' : '—'), cell(u.email)])

    s.addTable([usersHeader, ...usersDataRows], {
      x: M,
      y: tableY + 0.3,
      w: halfW,
      colW: [halfW * 0.38, halfW * 0.15, halfW * 0.47],
      rowH: 0.26,
      valign: 'middle',
      border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
      autoPage: false,
    })
  }

  // API tokens table (right column)
  const tokensHeading = strings['governance.access.tokens.heading'] ?? 'API tokens'
  s.addText(pptxSafeFormat(tokensHeading), {
    x: M + halfW + 0.2,
    y: tableY,
    w: halfW,
    h: 0.28,
    fontFace: 'Arial',
    fontSize: 11,
    bold: true,
    color: PPTX_COLORS.ink,
    margin: 0,
  })

  if (access.tokens.length > 0) {
    const tokensHeader = [
      cell(strings['governance.access.tokens.col.user'] ?? 'User', {
        bold: true,
        color: PPTX_COLORS.inkMuted,
      }),
      cell(strings['governance.access.tokens.col.tokenId'] ?? 'Token ID', {
        bold: true,
        color: PPTX_COLORS.inkMuted,
      }),
      cell(strings['governance.access.tokens.col.privSeparated'] ?? 'Priv. sep.', {
        bold: true,
        color: PPTX_COLORS.inkMuted,
      }),
    ]
    const tokensDataRows = access.tokens
      .slice(0, TOP_N)
      .map((t) => [cell(t.user), cell(t.tokenId), cell(t.privSeparated ? '✓' : '—')])

    s.addTable([tokensHeader, ...tokensDataRows], {
      x: M + halfW + 0.2,
      y: tableY + 0.3,
      w: halfW,
      colW: [halfW * 0.38, halfW * 0.47, halfW * 0.15],
      rowH: 0.26,
      valign: 'middle',
      border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
      autoPage: false,
    })
  }
}
