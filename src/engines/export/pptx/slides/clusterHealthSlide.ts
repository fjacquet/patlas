/**
 * Plan A — Cluster Health: Proxmox HA service status (quorum/fencing),
 * HA-managed resource count, and scheduled backup job count. KPI band +
 * two NATIVE pptxgenjs tables (HA services, backup jobs). Native tables
 * render text fine — the resvg trap only affects rasterized chart images.
 * Brand-free, factual, neutral measurement. No editorial verbs, no numbers
 * embedded in i18n strings.
 */
import type PptxGenJS from 'pptxgenjs'
import type { ClusterHealth } from '@/engines/aggregation/clusterHealth'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

const TOP_N = 12

export function addClusterHealthSlide(
  pptx: PptxGenJS,
  health: ClusterHealth,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(
    s,
    strings['clusterHealth.title'] ?? 'Cluster health — HA status & backup jobs',
  )

  // KPI band: quorum and fencing are text values (string | null); render them
  // as addText lines above the tables. Numeric KPI tiles: HA resources + backup jobs.
  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['clusterHealth.kpi.haResources'] ?? 'HA resources',
        value: pptxNumber(health.ha.managedCount, locale),
      },
      {
        label: strings['clusterHealth.kpi.backupJobs'] ?? 'Backup jobs',
        value: pptxNumber(health.backups.jobCount, locale),
      },
    ],
    y,
  )

  // Quorum and fencing text status lines (addText — string values, not numeric KPI)
  const quorumLabel = strings['clusterHealth.kpi.quorum'] ?? 'Quorum'
  const fencingLabel = strings['clusterHealth.kpi.fencing'] ?? 'Fencing'
  const quorumVal = health.ha.quorumStatus ?? '—'
  const fencingVal = health.ha.fencingStatus ?? '—'

  s.addText(pptxSafeFormat(`${quorumLabel}: ${quorumVal}  ·  ${fencingLabel}: ${fencingVal}`), {
    x: M,
    y: y2,
    w: CONTENT_W,
    h: 0.3,
    fontFace: 'Arial',
    fontSize: 11,
    color: PPTX_COLORS.inkMuted,
    margin: 0,
  })

  const tableStartY = y2 + 0.38
  const halfW = (CONTENT_W - 0.2) / 2

  const cell = (text: string, opts: Record<string, unknown> = {}) => ({
    text: pptxSafeFormat(text),
    options: { fontFace: 'Arial', fontSize: 11, color: PPTX_COLORS.ink, ...opts },
  })

  // HA services table: Service (id) | Status
  const servicesHeading = strings['clusterHealth.services.heading'] ?? 'HA services'
  s.addText(pptxSafeFormat(servicesHeading), {
    x: M,
    y: tableStartY,
    w: halfW,
    h: 0.28,
    fontFace: 'Arial',
    fontSize: 11,
    bold: true,
    color: PPTX_COLORS.ink,
    margin: 0,
  })

  const servicesHeader = [
    cell(strings['clusterHealth.col.service'] ?? 'Service', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
    cell(strings['clusterHealth.col.status'] ?? 'Status', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
  ]

  const servicesDataRows = health.ha.services
    .slice(0, TOP_N)
    .map((r) => [cell(r.id), cell(r.status)])

  s.addTable([servicesHeader, ...servicesDataRows], {
    x: M,
    y: tableStartY + 0.3,
    w: halfW,
    colW: [halfW * 0.55, halfW * 0.45],
    rowH: 0.28,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
    autoPage: false,
  })

  // Backup jobs table: Job (id) | Schedule | Enabled
  const jobsHeading = strings['clusterHealth.jobs.heading'] ?? 'Backup jobs'
  s.addText(pptxSafeFormat(jobsHeading), {
    x: M + halfW + 0.2,
    y: tableStartY,
    w: halfW,
    h: 0.28,
    fontFace: 'Arial',
    fontSize: 11,
    bold: true,
    color: PPTX_COLORS.ink,
    margin: 0,
  })

  const jobsHeader = [
    cell(strings['clusterHealth.col.job'] ?? 'Job', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
    cell(strings['clusterHealth.col.schedule'] ?? 'Schedule', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
    cell(strings['clusterHealth.col.enabled'] ?? 'Enabled', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
  ]

  const jobsDataRows = health.backups.jobs
    .slice(0, TOP_N)
    .map((r) => [cell(r.id), cell(r.schedule), cell(r.enabled ? '✓' : '—')])

  s.addTable([jobsHeader, ...jobsDataRows], {
    x: M + halfW + 0.2,
    y: tableStartY + 0.3,
    w: halfW,
    colW: [halfW * 0.45, halfW * 0.35, halfW * 0.2],
    rowH: 0.28,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
    autoPage: false,
  })
}
