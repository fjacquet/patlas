#!/usr/bin/env node
// Generate the PWA install icons from the brand mark (public/favicon.svg).
//
// Same-origin, zero NEW dependency: reuses @resvg/resvg-wasm (already in deps
// for the PPTX export). Run manually when the brand mark changes:
//   node scripts/gen-pwa-icons.mjs
//
// Emits (committed, served same-origin under /patlas/):
//   public/pwa-192.png           192x192, transparent  (purpose: any)
//   public/pwa-512.png           512x512, transparent  (purpose: any)
//   public/pwa-maskable-512.png  512x512, solid bg     (purpose: maskable)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { initWasm, Resvg } from '@resvg/resvg-wasm'

const root = fileURLToPath(new URL('..', import.meta.url))
const WASM = `${root}node_modules/@resvg/resvg-wasm/index_bg.wasm`
const FAVICON = `${root}public/favicon.svg`
const BG = '#11161f' // Midnight Executive surface-900 (manifest background_color)

await initWasm(readFileSync(WASM))

const favicon = readFileSync(FAVICON, 'utf-8')

// The favicon stacks `color(display-p3 …)` fills + blur/mask filters that
// resvg cannot rasterize faithfully (renders near-black). For crisp install
// icons, take ONLY the brand bolt path and fill it with a plain sRGB color.
const BRAND = '#863bff'
const boltPath = favicon.match(/<path[^>]*\sd="([^"]+)"/)?.[1]
if (!boltPath) throw new Error('gen-pwa-icons: could not extract the bolt path from favicon.svg')
const GLYPH = `<path d="${boltPath}" fill="${BRAND}"/>`

// favicon viewBox is `0 0 48 46` (not square). Wrap it on a square 512 canvas,
// centered, scaled to fill `1 - 2·padFrac` of the canvas, optional solid bg.
const FAVICON_W = 48
const FAVICON_H = 46

function squareSvg({ padFrac, bg }) {
  const inset = 512 * padFrac
  const avail = 512 - 2 * inset
  const scale = Math.min(avail / FAVICON_W, avail / FAVICON_H)
  const tx = (512 - FAVICON_W * scale) / 2
  const ty = (512 - FAVICON_H * scale) / 2
  const rect = bg ? `<rect width="512" height="512" fill="${bg}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${rect}<g transform="translate(${tx} ${ty}) scale(${scale})">${GLYPH}</g></svg>`
}

function pngFromSvg(svg, width) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width } })
  const img = r.render()
  const png = img.asPng()
  img.free()
  r.free()
  return png
}

// purpose: any — mark on transparency, small breathing room, square.
const anySvg = squareSvg({ padFrac: 0.06, bg: null })
writeFileSync(`${root}public/pwa-192.png`, pngFromSvg(anySvg, 192))
writeFileSync(`${root}public/pwa-512.png`, pngFromSvg(anySvg, 512))

// purpose: maskable — inside the ~80% safe zone on a solid background.
const maskable = squareSvg({ padFrac: 0.18, bg: BG })
writeFileSync(`${root}public/pwa-maskable-512.png`, pngFromSvg(maskable, 512))

console.log('gen-pwa-icons: wrote pwa-192.png, pwa-512.png, pwa-maskable-512.png')
