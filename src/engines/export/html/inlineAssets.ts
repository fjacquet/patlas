/**
 * Phase 10 — self-containment assets for the exported HTML report.
 *
 * The report is a single static file opened OFFLINE on an untrusted machine
 * with no JS (HTM-02). Two guarantees live here:
 *  1. `inlineAssets()` — the inlined `<style>` (plain CSS, no Tailwind
 *     runtime; maps the placeholder class names emitted by `renderReport`,
 *     including the gold threshold marker) + the exact restrictive CSP
 *     `<meta>`. Light-theme-fixed (a shareable artifact has no live theme).
 *     Default font = the system stack ⇒ ZERO embedded font bytes (T-10-10:
 *     no external/leaking asset ref; the smallest possible file).
 *  2. `assertSizeBudget()` — the HTM-03 hard ceiling: < 5 MB typical,
 *     < 15 MB on the largest supported estate (T-10-12 DoS guard).
 *
 * No runtime fetch of any kind (the privacy fetch-guard throws — Pitfall 3).
 */

/** Exact CSP meta content (Pitfall: `default-src 'none'` + data: only —
 *  no script, no network; inline style is required for a single file). */
export const CSP_CONTENT =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline' data:; font-src data:"

export const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${CSP_CONTENT}">`

const SYSTEM_FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif'
const MONO_FONT = '"JetBrains Mono","Fira Code",ui-monospace,SFMono-Regular,Menlo,monospace'

/**
 * The inlined stylesheet. Plain CSS only (no Tailwind, no `dark:` — the
 * static file has no runtime). Document-scale typography + Midnight
 * Executive light surface; the `.flagged` rule is the factual gold
 * threshold marker (no icon, no verdict colour — UI-SPEC §Color).
 */
const STYLE = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#f8fafc;color:#0f172a;font-family:${SYSTEM_FONT};font-size:14px;line-height:1.5}
.report{max-width:1100px;margin:0 auto;padding:32px}
.report-section{margin:0 0 48px}
.section-title{font-size:20px;font-weight:600;margin:0 0 16px;color:#1e293b}
.cover-identity{font-size:14px;color:#475569;margin:0 0 16px}
.cluster{border:1px solid #e2e8f0;background:#fff;border-radius:6px;padding:16px;margin:0 0 16px}
.cluster-name{font-size:16px;font-weight:600;margin:0 0 8px}
.metric-row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #f1f5f9}
.metric-label{color:#475569}
.metric-value{font-family:${MONO_FONT};font-weight:600;font-variant-numeric:tabular-nums;color:#0f172a}
.metric-row.flagged{border-left:2px solid #f9b935;background:rgba(249,185,53,.15);padding-left:8px}
.chart-slot{margin:12px 0 0}
.chart-slot svg{max-width:100%;height:auto}
.annex-table{width:100%;border-collapse:collapse;font-size:13px}
.annex-table th,.annex-table td{text-align:left;padding:6px 8px;border-bottom:1px solid #e2e8f0}
.annex-table td.num{font-family:${MONO_FONT};font-variant-numeric:tabular-nums;text-align:right}
.factual-note{color:#475569;font-size:13px}
.methodology{margin-top:48px;padding-top:16px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px}
`.trim()

export interface InlinedAssets {
  /** The full `<style>…</style>` element string. */
  style: string
  /** The CSP `<meta>` element string. */
  cspMeta: string
}

export function inlineAssets(): InlinedAssets {
  return { style: `<style>${STYLE}</style>`, cspMeta: CSP_META }
}

export type SizeTier = 'typical' | 'ceiling'

const BUDGET: Record<SizeTier, number> = {
  typical: 5 * 1024 * 1024, // 5 MiB
  ceiling: 15 * 1024 * 1024, // 15 MiB hard ceiling
}

/**
 * HTM-03 hard size gate. Throws a factual Error when the encoded byte
 * length is at or past the tier ceiling (T-10-12). `typical` ≈ a ~5000-VM
 * estate; `ceiling` ≈ the largest supported (~36000-VM / 10k-fixture).
 */
export function assertSizeBudget(html: string, tier: SizeTier): void {
  const bytes = new TextEncoder().encode(html).length
  const max = BUDGET[tier]
  if (bytes >= max) {
    throw new Error(`HTML report ${bytes} bytes exceeds the ${tier} budget of ${max} bytes`)
  }
}
