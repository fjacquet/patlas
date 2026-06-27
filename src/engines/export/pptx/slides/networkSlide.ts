/** Phase 11 (F-2) — Network slide.
 *  Shows four Proxmox-native KPI cards (physical NICs / bonds / bridges /
 *  VLANs) from the NodeInterfaceRow aggregation, then embeds the topology
 *  tree PNG produced by the worker (Spec 2: topology replaces the interim
 *  upstream-SVG rasterization path).
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
  topologyPng: Uint8Array | null,
  strings: ExportStrings,
  locale: ExportLocale,
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

  if (topologyPng && topologyPng.length > 0) {
    // Locked-safe PNG embed (Pitfall 1) — addChartImage always emits an
    // image/png data URI; PowerPoint renders it natively.
    addChartImage(s, topologyPng, { x: M, y, w: CONTENT_W, h: SLIDE.h - y - M })
  } else {
    addNote(s, strings['network.absent'] ?? 'No network diagram is included in this report.', y)
  }
}
