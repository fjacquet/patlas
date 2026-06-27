/**
 * Pure utilities for detecting oversized network diagrams before rasterization.
 *
 * A cv4pve-report network SVG for a large estate can be 1762×14092 px —
 * 14 000 px tall. Fitting that to CHART_W=1600 produces a 1600×12844 PNG
 * (170 MB uncompressed canvas; 12× the slide height) that PowerPoint then
 * letterboxes into a 0.7"-wide sliver on a 12.333"×5.65" content area. Both
 * the wasted memory and the unreadable sliver need guarding.
 */

export interface SvgDimensions {
  w: number
  h: number
}

/**
 * Extract intrinsic pixel dimensions from an SVG string.  Tries
 * `width`/`height` attributes first; falls back to `viewBox`.
 * Returns null when no reliable dimensions can be found.
 */
export function parseSvgDimensions(svg: string): SvgDimensions | null {
  const wm = svg.match(/\bwidth="(\d+(?:\.\d+)?)(?:px)?"/i)
  const hm = svg.match(/\bheight="(\d+(?:\.\d+)?)(?:px)?"/i)
  if (wm && hm) {
    const w = parseFloat(wm[1] ?? '')
    const h = parseFloat(hm[1] ?? '')
    if (w > 0 && h > 0) return { w, h }
  }
  const vb = svg.match(/\bviewBox="[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)"/i)
  if (vb) {
    const w = parseFloat(vb[1] ?? '')
    const h = parseFloat(vb[2] ?? '')
    if (w > 0 && h > 0) return { w, h }
  }
  return null
}

/**
 * Slide content-area geometry (inches, derived from SLIDE theme + addHeader).
 * Kept here so isSvgOversized stays self-contained without importing from
 * the slide layer.
 *   content width  = 13.333 − 0.5×2   = 12.333"
 *   content height = 7.5 − 1.35 − 0.5 = 5.65"
 *   content AR     = 12.333 / 5.65    ≈ 2.183 (landscape)
 */
const CONTENT_AR = 12.333 / 5.65 // ≈ 2.183

/**
 * When PowerPoint uses `contain` sizing, a portrait SVG fills only
 * (svgAR / contentAR) × 100% of the content width.  When that fraction
 * falls below READABLE_FRACTION the diagram becomes an unreadable sliver.
 * 15% is the empirically verified cutoff for a 13.333"×5.65" box.
 */
const READABLE_FRACTION = 0.15

/**
 * Returns true when the SVG's aspect ratio is so portrait-extreme that a
 * PowerPoint `contain`-sized image would occupy < 15% of the content width
 * (a sliver unreadable at presentation scale).
 */
export function isSvgOversized(dims: SvgDimensions): boolean {
  const svgAR = dims.w / dims.h
  if (svgAR >= CONTENT_AR) return false // landscape SVGs always fit fine
  return svgAR / CONTENT_AR < READABLE_FRACTION
}

/**
 * Compute the raster pixel width to use when calling `chartSvgToPng`
 * with `fitTo: { mode: 'width' }` so the resulting PNG height is capped
 * at `maxH` pixels (avoids a 12 000-px-tall PNG for extreme diagrams).
 *
 * The caller still passes `fitTo: { mode: 'width', value: renderW }`;
 * resvg scales proportionally so the output height ≈ maxH.
 */
export function cappedRenderWidth(dims: SvgDimensions, maxH: number): number {
  return Math.max(1, Math.round((dims.w / dims.h) * maxH))
}
