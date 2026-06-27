/** Phase 11 (F-2) — Network slide.
 *  Shows four Proxmox-native KPI cards (physical NICs / bonds / bridges /
 *  VLANs) from the NodeInterfaceRow aggregation, then embeds the topology
 *  diagram when present.  When the active snapshot carries a network diagram,
 *  the worker rasterizes the SVG to a PNG (via the Wave-0-locked resvg path,
 *  with a bundled font so text labels render) and passes the bytes here.
 *  PowerPoint does NOT render embedded SVG (Pitfall 1 — an SVG-mime image
 *  renders blank and the browser export worker throws), so the diagram MUST
 *  be a PNG like every other chart.
 *  When absent a Proxmox-correct factual note is shown instead. */
import type PptxGenJS from 'pptxgenjs'
import type { NetworkRollup } from '@/engines/aggregation/network'
import type { ExportStrings } from '../../types'
import type { ExportLocale } from '../format'
import { pptxNumber } from '../format'
import { addChartImage } from '../primitives/chartSvg'
import { drawKpiCard } from '../primitives/draw'
import { SLIDE } from '../theme'
import { addHeader, addNote, CONTENT_W, M } from './_layout'

export function addNetworkSlide(
  pptx: PptxGenJS,
  networkPng: Uint8Array | null,
  strings: ExportStrings,
  locale: ExportLocale,
  oversized = false,
  network?: NetworkRollup,
): void {
  const s = pptx.addSlide()
  let y = addHeader(s, strings['network.title'] ?? 'Network')

  // KPI cards — only when aggregation data is present
  if (
    network &&
    (network.totalNics > 0 ||
      network.totalBonds > 0 ||
      network.totalBridges > 0 ||
      network.totalVlans > 0)
  ) {
    const gap = 0.15
    const cw = (CONTENT_W - gap * 3) / 4
    const cards = [
      {
        big: pptxNumber(network.totalNics, locale),
        small: strings['network.nics'] ?? 'Physical NICs',
      },
      { big: pptxNumber(network.totalBonds, locale), small: strings['network.bonds'] ?? 'Bonds' },
      {
        big: pptxNumber(network.totalBridges, locale),
        small: strings['network.bridges'] ?? 'Bridges',
      },
      { big: pptxNumber(network.totalVlans, locale), small: strings['network.vlans'] ?? 'VLANs' },
    ]
    cards.forEach((c, i) => {
      drawKpiCard(s, { x: M + i * (cw + gap), y, w: cw, h: 1.05, big: c.big, small: c.small })
    })
    y += 1.2
  }

  if (networkPng && networkPng.length > 0) {
    if (oversized) {
      // INTERIM (superseded by Spec 2's topology tree): the upstream SVG is
      // extreme-portrait (e.g. 1762×14092). Rasterized into a wide-short slide
      // box it is an unreadable blur, so DO NOT embed it. The KPI cards above
      // carry the facts; point to the HTML report, which inlines the full SVG.
      addNote(
        s,
        strings['network.oversizedNote'] ?? 'Full network diagram available in the HTML report.',
        y,
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
