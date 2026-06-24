/** Encode a raw SVG string as a base64 `data:` URI for use as an `<img>`
 *  src. utf-8 safe. Same-origin (no egress); the only safe way to render a
 *  semi-trusted report-bundle SVG (an `<img>` cannot execute scripts). */
export function svgToDataUri(svg: string): string {
  const b64 = btoa(unescape(encodeURIComponent(svg)))
  return `data:image/svg+xml;base64,${b64}`
}
