/** Phase 11 (F-2) — Network slide.
 *  When the active snapshot carries a network diagram, the worker rasterizes
 *  the SVG to a PNG (via the Wave-0-locked resvg path, with a bundled font so
 *  text labels render) and passes the bytes here. PowerPoint does NOT render
 *  embedded SVG (Pitfall 1 — an SVG-mime image renders blank and the browser
 *  export worker throws), so the diagram MUST be a PNG like every other chart.
 *  When the diagram is extreme-portrait (e.g. 1762×14092 for a 179-VM estate)
 *  the PNG is rasterized at a capped height and `oversized` is true — the slide
 *  shrinks the image area and adds a factual note directing the reader to the
 *  HTML report where the full diagram is visible in a scrollable container.
 *  When absent a Proxmox-correct factual note is shown instead. */
import type PptxGenJS from 'pptxgenjs'
import type { ExportStrings } from '../../types'
import type { ExportLocale } from '../format'
import { addChartImage } from '../primitives/chartSvg'
import { SLIDE } from '../theme'
import { addHeader, addNote, CONTENT_W, M } from './_layout'

export function addNetworkSlide(
  pptx: PptxGenJS,
  networkPng: Uint8Array | null,
  strings: ExportStrings,
  // _locale is retained for slide-builder API consistency; no locale-specific
  // number formatting is needed here — the slide embeds an image or a static note.
  _locale: ExportLocale,
  oversized = false,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['network.title'] ?? 'Network')

  if (networkPng && networkPng.length > 0) {
    if (oversized) {
      // Reserve the bottom strip for the factual "see HTML report" note.
      const noteH = 0.6
      const gap = 0.12
      const imgH = SLIDE.h - y - M - noteH - gap
      addChartImage(s, networkPng, { x: M, y, w: CONTENT_W, h: imgH })
      addNote(
        s,
        strings['network.oversizedNote'] ?? 'Full network diagram available in the HTML report.',
        y + imgH + gap,
      )
    } else {
      // Locked-safe PNG embed (Pitfall 1) — addChartImage always emits an
      // image/png data URI; PowerPoint renders it natively.
      addChartImage(s, networkPng, { x: M, y, w: CONTENT_W, h: SLIDE.h - y - M })
    }
  } else {
    addNote(s, strings['network.absent'] ?? 'No network diagram is included in this report.', y)
  }
}
