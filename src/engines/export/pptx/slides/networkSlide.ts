/** Phase 11 (F-2) — Network slide.
 *  When the active snapshot carries a `networkSvg` (from the `.zip` bundle),
 *  the SVG is embedded as a full-width vector image (PowerPoint renders it
 *  natively as crisp vectors — no rasterisation needed).
 *  When absent a Proxmox-correct factual note is shown instead. */
import type PptxGenJS from 'pptxgenjs'
import { svgToDataUri } from '@/engines/export/svgDataUri'
import type { ExportStrings } from '../../types'
import type { ExportLocale } from '../format'
import { SLIDE } from '../theme'
import { addHeader, addNote, CONTENT_W, M } from './_layout'

export function addNetworkSlide(
  pptx: PptxGenJS,
  networkSvg: string | null,
  strings: ExportStrings,
  // _locale is retained for slide-builder API consistency; no locale-specific
  // number formatting is needed here — the slide embeds an image or a static note.
  _locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['network.title'] ?? 'Network')

  if (networkSvg && networkSvg.trim().length > 0) {
    // Embed the SVG diagram — pptxgenjs addImage accepts SVG data URIs and
    // PowerPoint 2016+ renders them as crisp vectors (no font bundling needed).
    const contentH = SLIDE.h - y - M
    s.addImage({
      data: svgToDataUri(networkSvg),
      x: M,
      y,
      w: CONTENT_W,
      h: contentH,
      sizing: { type: 'contain', w: CONTENT_W, h: contentH },
      altText: strings['network.diagramAlt'] ?? 'Network topology diagram',
    })
  } else {
    addNote(s, strings['network.absent'] ?? 'No network diagram is included in this report.', y)
  }
}
