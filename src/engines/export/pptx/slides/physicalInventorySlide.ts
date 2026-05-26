/**
 * P-HWID — Physical inventory: a NATIVE pptxgenjs table of every host's
 * chassis identity (Serial / Service tag, Model, Vendor) for a move /
 * replacement prep. Auto-paginated so the COMPLETE host list spills across
 * as many slides as needed (a move needs every node, not a top-N). Native
 * table → text renders (the resvg trap only hits rasterized chart images).
 * Brand-free, factual; '' renders the em-dash sentinel, never a blank.
 */
import type PptxGenJS from 'pptxgenjs'
import type { EsxAggregate } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

export function addPhysicalInventorySlide(
  pptx: PptxGenJS,
  hosts: ReadonlyArray<EsxAggregate>,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['physical.title'] ?? 'Physical inventory — serial / service tag')
  const withSerial = hosts.filter((h) => h.serialNumber !== '').length
  const y2 = addKpiRow(
    s,
    [
      { label: strings['physical.hosts'] ?? 'Hosts', value: pptxNumber(hosts.length, locale) },
      {
        label: strings['physical.withSerial'] ?? 'Hosts with serial',
        value: pptxNumber(withSerial, locale),
      },
    ],
    y,
  )

  const cell = (text: string, opts: Record<string, unknown> = {}) => ({
    text: pptxSafeFormat(text),
    options: { fontFace: 'Arial', fontSize: 11, color: PPTX_COLORS.ink, ...opts },
  })
  const head = (text: string, opts: Record<string, unknown> = {}) =>
    cell(text, { bold: true, color: PPTX_COLORS.inkMuted, ...opts })

  const header = [
    head(strings['physical.colHost'] ?? 'Host'),
    head(strings['physical.colCluster'] ?? 'Cluster'),
    head(strings['physical.colSerial'] ?? 'Serial / Service tag'),
    head(strings['physical.colModel'] ?? 'Model'),
    head(strings['physical.colVendor'] ?? 'Vendor'),
  ]
  const dataRows = hosts.map((h) => [
    cell(h.hostName),
    cell(h.cluster),
    cell(h.serialNumber || '—'),
    cell(h.model || '—'),
    cell(h.vendor || '—'),
  ])

  s.addTable([header, ...dataRows], {
    x: M,
    y: y2 + 0.1,
    w: CONTENT_W,
    colW: [CONTENT_W * 0.26, CONTENT_W * 0.2, CONTENT_W * 0.24, CONTENT_W * 0.18, CONTENT_W * 0.12],
    rowH: 0.28,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
    autoPage: true,
    autoPageRepeatHeader: true,
    autoPageHeaderRows: 1,
    autoPageSlideStartY: 0.5,
  })

  s.addText(
    pptxSafeFormat(
      strings['physical.footer'] ??
        'Source: RVTools — vHost (Serial number / Service tag, Model, Vendor)',
    ),
    {
      x: M,
      y: 7.0,
      w: CONTENT_W,
      h: 0.3,
      fontFace: 'Arial',
      fontSize: 10,
      color: PPTX_COLORS.inkMuted,
      margin: 0,
    },
  )
}
