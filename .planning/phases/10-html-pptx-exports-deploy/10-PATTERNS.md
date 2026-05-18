# Phase 10: HTML + PPTX Exports & Deploy - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 22 new / 3 modified
**Analogs found:** 22 / 25 (3 = vsizer EXTERNAL ports, no in-repo path — closest in-repo analog cited per file)

> **Binding upstream constraint (carried into every assignment):** architecture is LOCKED in CLAUDE.md + 10-RESEARCH.md. This phase is *assembly of already-shipped pure outputs*, not new analytics. The single genuine unknown (SVG→PNG without DOM for PPTX charts) is a Wave-0 spike — no later file may assume the mechanism.
>
> **vsizer is EXTERNAL.** `src/engines/export/` does not exist in this repo (verified: `ls src/engines/` has no `export/`). Every "PORT from vsizer" file below is a **port target with NO in-repo analog** — the planner MUST create it fresh against the cited in-repo pattern, not copy from a vsizer path that does not exist here.

## File Classification

| New/Modified File | Role | Data Flow | Closest In-Repo Analog | Match Quality |
|-------------------|------|-----------|------------------------|---------------|
| `src/engines/export/export.worker.ts` | worker | event-driven / transform | `src/engines/parser/parser.worker.ts` | exact (role+flow) |
| `src/hooks/useExport.ts` | hook | request-response | `src/engines/parser/parseInWorker.ts` | exact (worker-driver shape) |
| `src/engines/export/html/renderCharts.ts` | engine (transform) | transform | `src/components/Chart.tsx` (ECharts registry) | role-match (SSR variant of same registry) |
| `src/engines/export/html/renderReport.tsx` | engine (React SSR boundary) | transform | `src/components/storage/DatastoreDetail.tsx` (screen-fit presenter) | role-match |
| `src/engines/export/html/inlineAssets.ts` | engine (utility) | transform | `scripts/check-bundle-size.mjs` (size accounting) | partial (size-budget logic) |
| `src/engines/export/html/assembleHtml.ts` | engine (utility) | transform | — (no in-repo analog; string assembly per RESEARCH Pattern 3) | research-only |
| `src/engines/export/pptx/builder.ts` | engine (assembler) | transform | `src/engines/aggregation/estateView.ts` (pure composition root) | role-match — **vsizer PORT, no in-repo path** |
| `src/engines/export/pptx/theme.ts` | config | — | `src/theme/echartsTheme.ts` | role-match — **vsizer PORT** |
| `src/engines/export/pptx/format.ts` | engine (utility) | transform | `src/utils/format.ts` (locale-param) | exact — **vsizer PORT, locale-parameterize** |
| `src/engines/export/pptx/primitives/{colors,kpiCard,progressBar}.ts` | engine (utility) | transform | `src/theme/echartsTheme.ts` (palette consts) | partial — **vsizer PORT verbatim** |
| `src/engines/export/pptx/primitives/chartSvg.ts` | engine (transform) | transform | `src/components/Chart.tsx` registry + Wave-0 raster | **NEW — no analog (Open Q1)** |
| `src/engines/export/pptx/slides/{title,overview,cluster,contentionAnnex}.ts` | engine (presenter) | transform | `src/components/storage/DatastoreDetail.tsx` | role-match — **vsizer PORT** |
| `src/engines/export/pptx/slides/{eos,drSim,trends,inventory}Slide.ts` | engine (presenter) | transform | `src/components/storage/DatastoreDetail.tsx` | role-match — **NEW** |
| `src/components/ExportButtons.tsx` (the two header buttons) | component | request-response | `src/components/ThemeToggle.tsx` / `LanguageToggle.tsx` | exact (header-control idiom) |
| `src/App.tsx` (modified) | component | request-response | self (header cluster lines 33-37) | exact (in-place) |
| `src/i18n/index.ts` (modified) | config | — | self (NAMESPACES/resources lines 46-97) | exact (in-place) |
| `src/i18n/locales/{en,fr}/report.json` + `…/pptx.json` | config | — | `src/i18n/locales/{en,fr}/storage.json` | exact (namespace JSON shape) |
| `src/i18n/keyParity.test.ts` | test | — | RESEARCH §Code Examples (recursive key-diff) | research-provided |
| `scripts/check-i18n-parity.mjs` (optional CLI mirror) | config (CI gate) | batch | `scripts/check-supply-chain.mjs` | role-match |

## Pattern Assignments

### `src/engines/export/export.worker.ts` (worker, event-driven) — NEW

**Analog:** `src/engines/parser/parser.worker.ts` (exact role+flow match — the established Web-Worker entry contract).

**Worker-entry preamble + fetchGuard FIRST import** (`parser.worker.ts:1-12`):
```typescript
/// <reference lib="webworker" />
import '../../privacy/fetchGuard' // Plan 02 contract — workers have their own global scope
import { /* … */ } from './…'

interface ParseRequest {
  kind: 'parse'
  buf: ArrayBuffer
  filename: string
  mtime: number
}
```
Copy verbatim in shape: `fetchGuard` MUST be the first import (RESEARCH Pitfall 3 — it throws synchronously on any fetch; a CDN font/asset crashes the export by design). The `<reference lib="webworker" />` triple-slash is required for `self`/`postMessage` typing.

**onmessage → try/postMessage(ok) / catch/postMessage(err) discriminated union** (`parser.worker.ts:14-70`):
```typescript
self.onmessage = (e: MessageEvent<ParseRequest>) => {
  if (e.data.kind !== 'parse') return
  try {
    /* heavy pure work — for export: buildEstateView(...) + renderCharts + assembleHtml/buildPptx */
    self.postMessage({ kind: 'ok', /* … */ })
  } catch (err) {
    const e2 = err as { name?: string; message?: string /* … */ }
    // Explicit field list — NO `cause`, NO parsed VM data (STRIDE T-04-04).
    self.postMessage({ kind: 'err', error: { name: e2.name ?? 'ExportError', message: e2.message ?? 'export failed' } })
  }
}
```
**Binding carry-overs from this analog:** (1) the error object is a hand-built explicit field list — never spread `err` or include `cause`/parsed rows (privacy: T-04-04). (2) The heavy SheetJS/echarts import is confined to the worker chunk — mirror `parser.worker.ts` keeping `import * as echarts from 'echarts/core'` (NOT the barrel) inside this file only.

**Pure entrypoint the worker calls (D-08 active-snapshot + trends):** see Shared Pattern "EstateView outside React" below. The worker does NOT import `useEstateView` (Pitfall 2 — hooks need React).

---

### `src/hooks/useExport.ts` (hook, request-response) — NEW

**Analog:** `src/engines/parser/parseInWorker.ts` (exact worker-driver shape: module-scope singleton + `new URL` + Promise-wrapped postMessage + transferable).

**Module-scope singleton worker + lazy getter** (`parseInWorker.ts:18-27`):
```typescript
let worker: Worker | null = null
const getWorker = (): Worker => {
  if (!worker) {
    worker = new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}
```
For the export hook the `new URL(...)` target is `'@/engines/export/export.worker.ts'` (Vite code-splits it into its own chunk — same mechanism that confines `xlsx` to the parser chunk). One synthesis at a time (UI-SPEC: the other button is also disabled while busy).

**Discriminated-union response + Promise resolve/reject + transferable** (`parseInWorker.ts:29-53`):
```typescript
return new Promise((resolve, reject) => {
  const onMessage = (e: MessageEvent<ParseResponse>) => {
    w.removeEventListener('message', onMessage)
    if (e.data.kind === 'ok') resolve(/* … */)
    else reject(Object.assign(new Error(e.data.error.message), e.data.error))
  }
  w.addEventListener('message', onMessage)
  w.postMessage(msg, [buf]) // Transferable: zero-copy; buf neutered on main thread
})
```
**On the way back, the PPTX/HTML bytes are the transferable** (`postMessage({kind:'ok', bytes}, [bytes])`) — inverse of the parser (which transfers the input `buf` in). Always `removeEventListener` on settle (the analog does this first line of `onMessage`).

**Net-new vs analog (not in `parseInWorker.ts` — pull from RESEARCH §Code Examples):**
- Filename derivation `vatlas_{sanitizedVCenter}_{ISOcaptureDate}.{ext}` (D-05) — RESEARCH L285-291.
- D-06 toast lifecycle: `sonner` `toast` "Generating report…" → success/error; disable triggering button + spinner. `<Toaster/>` is ALREADY mounted (`App.tsx:66`) — no new dep.
- Download trigger: `URL.createObjectURL(blob)` → `<a download>` click → revoke (RESEARCH "Don't Hand-Roll" — clone vsizer `useExport.ts` `triggerDownload`; vsizer is external so build fresh against this description).
- Resolve store inputs on the MAIN thread before postMessage (Pitfall 2): `useSnapshotStore(selectActiveSnapshot)` + `selectSnapshots` + the same `opts` slices `useEstateView` reads (stretched/scenario/planned/thresholds). Resolve i18n strings on main thread too (engines are pure — no i18next in `engines/`).

---

### `src/engines/export/html/renderCharts.ts` (engine transform) — NEW

**Analog:** `src/components/Chart.tsx` (the SINGLE in-repo ECharts site; the SSR path reuses its exact tree-shaken registry).

**The tree-shaken registry + theme registration to REPLICATE at module scope** (`Chart.tsx:1-55`):
```typescript
import { BarChart, GaugeChart, HeatmapChart, LineChart, PieChart, TreemapChart } from 'echarts/charts'
import { CalendarComponent, DatasetComponent, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { MIDNIGHT_EXECUTIVE_DARK, MIDNIGHT_EXECUTIVE_LIGHT } from '@/theme/echartsTheme'

echarts.use([ BarChart, PieChart, GaugeChart, HeatmapChart, LineChart, TreemapChart,
  GridComponent, TooltipComponent, LegendComponent, DatasetComponent,
  CalendarComponent, VisualMapComponent, SVGRenderer ]) // SVG ONLY — canvas intentionally excluded (VIZ-01)
echarts.registerTheme('midnight-executive', MIDNIGHT_EXECUTIVE_LIGHT)
echarts.registerTheme('midnight-executive-dark', MIDNIGHT_EXECUTIVE_DARK)
```
**Binding:** never `import * as echarts from 'echarts'` (barrel = ≥300 KB, fails `check-bundle-size.mjs`). Reuse this exact `echarts/core` + `echarts.use([...])` set. The exported report is **light-fixed** (UI-SPEC Color §) → use `'midnight-executive'` (light) only; do not branch on `prefers-color-scheme`. zrender cannot parse `oklch()` → only the sRGB-hex values resolved in `echartsTheme.ts` may reach a chart option (carried from P9, do not regress).

**SSR call (NOT in Chart.tsx — Chart.tsx uses `<ReactEChartsCore … opts={{renderer:'svg'}}/>` at line 101-112; the worker has no DOM):** use RESEARCH Pattern 2:
```typescript
const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height })
chart.setOption(option); const svg = chart.renderToSVGString(); chart.dispose() // dispose() mandatory in a per-cluster loop
```
`width`/`height` MUST be explicit in SSR (no responsive container). This same SVG string feeds the PPTX raster step before rasterization.

---

### `src/engines/export/html/renderReport.tsx` (engine, React SSR boundary) — NEW

**Analog:** `src/components/storage/DatastoreDetail.tsx` (the canonical "one screen-fit area = one section/slide" presenter; pure props off `EstateView`, factual-only, em-dash sentinel, gold threshold marker).

**Pure-presenter idiom to copy** (`DatastoreDetail.tsx:19-44`):
```typescript
export function DatastoreDetail({ detail: d, onBack }: DatastoreDetailProps) {
  const { t, i18n } = useTranslation('storage'); const loc = i18n.language; const na = '—'
  const flagged = d.dsFlagged || d.luFlagged
  const Row = ({ label, value, flag = false }) => (
    <div className={`flex items-baseline justify-between … ${flag ? 'border-l-2 border-l-accent-500 bg-accent-500/15 pl-2' : ''}`}>
      <span>{label}</span>
      <span className="font-mono … tabular-nums">{value}</span>
    </div>)
```
**Carry into the report tree:** (1) numbers via `@/utils/format` with the active locale — never pre-formatted in i18n strings (Moderate-2). (2) `na = '—'` em-dash sentinel for non-derivable values (never `0`/`N/A`). (3) The factual threshold marker is **exactly** `border-l-2 border-l-accent-500 bg-accent-500/15 pl-2` — no icon, no verdict text, no traffic-light (P9 contract carried into the report's storage/threshold rows). (4) `font-mono … tabular-nums` for cross-row comparable numerics.

**Divergence from analog:** the report uses the new `report` namespace (not `storage`), runs through `renderToStaticMarkup` (NOT React DOM — RESEARCH Pattern 3), and inlines `<svg>` strings from `renderCharts.ts` as raw inline SVG in the JSX (NOT `<img>`, NOT a raw-HTML-injection prop for data — XSS control is React's default text-node escaping for all user-derived strings; chart SVG comes only from the trusted ECharts SSR generator). No Tailwind runtime in the static file → styles are inlined plain CSS in `assembleHtml.ts`'s single `<style>` block. Light-theme fixed (no `dark:` twins survive without the runtime — UI-SPEC).

**Anchor-id rule (Pitfall 6):** deterministic `c-${index}-${slug(name)}` — never raw user cluster/datastore names (real data repeats names → duplicate-id link breakage).

---

### `src/engines/export/html/inlineAssets.ts` (engine utility) — NEW

**Analog:** `scripts/check-bundle-size.mjs` (closest in-repo precedent for an asserting size-accounting gate).

**Pattern to mirror:** a byte-length accounting + threshold assertion. Default font = system-font stack (0 embedded bytes — UI-SPEC, protects the 5 MB target). A base64 `@font-face` woff2 is permitted ONLY if it stays inside budget. CSP `<meta>` injected here: `default-src 'none'; img-src data:; style-src 'unsafe-inline' data:; font-src data:`. Add a size-accounting assertion exposed for the HTM-03 fixture test (`scripts/generate-inventory-10k.mjs`): **< 5 MB typical / < 15 MB hard ceiling** (Moderate-7). No runtime fetch of any kind (Pitfall 3 — fetchGuard throws).

---

### `src/engines/export/html/assembleHtml.ts` (engine utility) — NEW — no in-repo analog

Per RESEARCH Pattern 3 (CITED react.dev). Single `<!doctype html>` string: `<html lang="${locale}">` + charset + CSP meta + inlined `<style>` (system-font stack or base64 woff2) + `${renderToStaticMarkup(<Report/>)}` body. No `<link>`, no `<script>`. Output → `Blob([html], {type:'text/html'})`. This is the one file where string assembly is correct (the React tree is built in `renderReport.tsx`, not here).

---

### `src/engines/export/pptx/*` — vsizer PORT TARGETS (NO in-repo path; build fresh)

> **`src/engines/export/` does not exist in this repo.** Do NOT instruct the planner to copy from a vsizer path. Each file is created fresh; the in-repo analog below is what its *shape/conventions* must match.

| Port file | Action | Closest in-repo analog & what to match |
|-----------|--------|----------------------------------------|
| `builder.ts` | PORT + add new-slide dispatch | `src/engines/aggregation/estateView.ts:64-95` — a pure composition root: typed params, no React/Zustand/Zod, JSDoc explaining the single-pass contract. Builder consumes `buildEstateView` output the same way `estateView.ts` consumes `MergedEstate`. |
| `theme.ts` | PORT verbatim (Midnight Executive hex, NO `#` prefix) | `src/theme/echartsTheme.ts` — palette-constant module shape. Brand-free (PPT-02/D-03). |
| `format.ts` | PORT but **locale-parameterize** (Pitfall 4 — vsizer was FR-only) | `src/utils/format.ts:1-20` — every formatter already takes `locale = 'fr-FR'` as a param and uses `toLocaleString(locale, …)`. Mirror this exactly: FR `,` decimal + thousands sep, EN `.` decimal + `,` thousands; em-dash sentinel on non-finite (mandatory, never `0`/`N/A`). The Moderate-8 FR U+202F→U+00A0 substitution is NOT yet present in `src/utils/format.ts` (verified: no `202f`/`00a0`/`replace` match) — it is a **net-new transform** the ported pptx `format.ts` must add for PPT-04. |
| `primitives/{colors,kpiCard,progressBar}.ts` | PORT verbatim | `src/theme/echartsTheme.ts` — small pure const/helper modules; no React. |
| `primitives/chartSvg.ts` | **NEW — Open Q1, Wave-0 spike gates this** | `src/components/Chart.tsx` registry (the SVG source) + the Wave-0-chosen rasterizer. PowerPoint cannot render SVG (Pitfall 1, verified) → rasterize each chart to PNG; `slide.addImage({data:'image/png;base64,…'})`, **never** `image/svg+xml`. No in-repo analog — do NOT add the rasterizer dep until Wave-0 picks it; any dep must clear `check-supply-chain.mjs` + `npm audit --audit-level=low` + OSV + `check-bundle-size.mjs`. |
| `slides/{titleSlide,overviewSlide,clusterSlide,contentionAnnex}.ts` | PORT | `src/components/storage/DatastoreDetail.tsx` — screen-fit presenter contract = the slide contract (one screen-fit area = one slide). `titleSlide` adds D-03 estate identity/freshness; `clusterSlide` is one-per-cluster ALWAYS (D-01, no top-N cap). |
| `slides/{eosSlide,drSimSlide,trendsSlide,inventorySlide}.ts` | **NEW** | Same `DatastoreDetail.tsx` presenter idiom. `trendsSlide` OMITTED entirely when < 2 snapshots (D-09). Sources: P7 `EosProjection`, P6 DR scenario, P8 `TrendSeries`, inventory summary — all already on the `EstateView` the worker computes. |

---

### `src/components/ExportButtons.tsx` + `src/App.tsx` (component, request-response) — NEW + MODIFY

**Analog:** `src/components/ThemeToggle.tsx` / `LanguageToggle.tsx` (exact header-control idiom — UI-SPEC mandates pixel-identical).

**`<fieldset>` group container + inner buttons to copy EXACTLY** (`ThemeToggle.tsx:79-106`):
```typescript
<fieldset
  aria-label={t('…label')}
  className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-xs dark:border-surface-700 dark:bg-surface-900">
  <legend className="sr-only">{t('…label')}</legend>
  <button type="button" onClick={…}
    className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${active
      ? 'bg-primary-100 text-primary-900 dark:bg-primary-700 dark:text-slate-100'
      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
    aria-pressed={active} aria-label={t(`…`)} title={t(`…`)}>
    <Glyph … /><span>{t(`…`)}</span>
  </button>
```
**Inline 14×14 stroke-SVG glyph idiom to copy** (`ThemeToggle.tsx:6-67`): authored per-component, `role="img" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"` + `<title>`. Author a download/document glyph + a spinner glyph (CSS `animate-spin`) the same way — no icon library (project has none, UI-SPEC).

**Busy state (net-new vs analog — UI-SPEC Interaction Contract):** on click → triggering button `disabled` + `aria-busy="true"`, glyph→spinner, the OTHER export button also `disabled`. NO modal/overlay (D-06 hard constraint). These are real `<button type="button">` — keyboard-activable, keep the focus ring.

**`App.tsx` modification** (`App.tsx:33-37`): insert into the existing header cluster, order `ViewToggle · Export HTML · Export PPTX · Language · Theme`:
```typescript
<div className="flex items-center gap-2">
  <ViewToggle value={activeView} onChange={setActiveView} />
  <ExportButtons />               {/* NEW — between ViewToggle and LanguageToggle */}
  <LanguageToggle />
  <ThemeToggle />
</div>
```
Buttons render only when `hasSnapshots` — UI-SPEC says no dedicated empty state; gate behind the same `selectHasSnapshots` already imported in `App.tsx:20,24` (currently `hasSnapshots` only switches the body; the header controls are always shown — the export buttons must additionally check `hasSnapshots` internally or be gated in `App.tsx`).

---

### `src/i18n/index.ts` (config, MODIFY) + `report.json`/`pptx.json` (config, NEW)

**Analog:** self (`src/i18n/index.ts:46-97`) + `src/i18n/locales/{en,fr}/storage.json` (namespace JSON shape).

**Three-touch namespace registration to follow** (the file's own JSDoc at `index.ts:41-45` states the contract: list in `NAMESPACES` AND add JSON files AND add to `resources`):
1. Imports (`index.ts:5-32` pattern): `import enReport from './locales/en/report.json'` … `frReport` … `enPptx`/`frPptx`.
2. `NAMESPACES` array (`index.ts:46-61`): append `'report', 'pptx'`.
3. `resources.en` / `resources.fr` (`index.ts:64-97`): add `report: enReport, pptx: enPptx` / `report: frReport, pptx: frPptx`.

`report.json`/`pptx.json` mirror `storage.json` shape (nested object, dot-path keys resolved via `t('detail.x')`). **Factual-only (HTM-05):** no editorial verbs, no traffic-light, no pre-formatted numbers (all numbers interpolated via `@/utils/format` with active locale, D-07). EN+FR must have identical key trees (Minor-7). `interpolation.escapeValue:false` is already set (`index.ts:110`) — React escapes; do not double-escape.

**Doc-comment trap (CLAUDE.md Gotchas / RESEARCH anti-pattern):** any comment describing the absence of a forbidden token must NOT spell the literal token (the grep gate + security hook match comments).

---

### `src/i18n/keyParity.test.ts` (test, NEW) — Minor-7

**Analog:** RESEARCH §Code Examples provides the exact test (recursive `Object.keys` deep-diff over `resources.en[ns]` vs `resources.fr[ns]` for every namespace). It runs inside the **existing** `npm run test:run` CI step (`.github/workflows/static.yml:97-98`) — **NO workflow edit needed** (verified: `static.yml` Test step already runs the full suite). An optional `scripts/check-i18n-parity.mjs` CLI mirror would follow `scripts/check-supply-chain.mjs:1-19,43-75` (bare-Node, reads inputs, `console.error` + `process.exit(1)` on violation) — but the in-test gate is sufficient and is the RESEARCH-recommended path.

## Shared Patterns

### EstateView outside React (the keystone — D-08)
**Source:** `src/hooks/useEstateView.ts:43-73` + `src/engines/aggregation/estateView.ts:64-95` + `src/engines/snapshotMerge/index.ts:6`
**Apply to:** `export.worker.ts` (the worker computes the view; never imports the hook — Pitfall 2)
The hook is a thin orchestrator. The exact pure call to clone in the worker:
```typescript
import { buildEstateView } from '@/engines/aggregation'        // index.ts:8 barrel
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge' // index.ts:6 barrel
const today = new Date() // sampled in the worker at synthesis time (the hook's clock-injection equivalent)
// D-08 BODY = active snapshot ONLY (NOT the merged multi-vCenter dashboard view):
const view = buildEstateView(mergeSnapshotsToEstate([active]), [active], mode, today,
  { stretchedClusters, scenario, plannedRatios: { cpuRatio, ramRatio }, thresholds })
// D-08/D-09 TRENDS = ALL loaded snapshots; view2.trends is null when < 2 → omit section/slide:
const view2 = buildEstateView(mergeSnapshotsToEstate(all), all, mode, today, opts)
const trends = view2.trends
```
`buildEstateView` signature is fixed (`estateView.ts:64-95`): `(merged: MergedEstate, selected: Snapshot[], mode: AccountingMode, today: Date, opts?)`. Store inputs (`active`, `all`, `mode`, the opts slices) are resolved on the MAIN thread via `selectActiveSnapshot`/`selectSnapshots` (`snapshotStore.ts:216-242`) and posted in — never a second `useMemo` (grep-gated single-memo invariant; the worker is not a memo site).

### fetchGuard-first / privacy invariant
**Source:** `src/engines/parser/parser.worker.ts:2`
**Apply to:** `export.worker.ts` (line 2, before any other import)
`import '../../privacy/fetchGuard'` MUST be the first executable import. It throws synchronously on any non-same-origin fetch (CLAUDE.md Gotchas — does not silently block). All report fonts/assets are base64-inlined or system-font (Pitfall 3); zero runtime fetch.

### Locale-parameterized formatting
**Source:** `src/utils/format.ts:1-20` (every `fmt*` takes `locale = 'fr-FR'`, uses `toLocaleString(locale,…)`, em-dash on non-finite)
**Apply to:** report tree, pptx `format.ts` port, all exported numbers
Active locale resolved on main thread, posted into the worker (D-07 — one artifact = one language). Numbers never pre-formatted in i18n strings (Moderate-2). The FR U+202F→U+00A0 substitution (Moderate-8 / Pitfall 4) is **net-new** — not present in `src/utils/format.ts` today (verified); the pptx `format.ts` port adds it.

### Worker singleton + transferable
**Source:** `src/engines/parser/parseInWorker.ts:18-53`
**Apply to:** `useExport.ts`
Module-scope `let worker`, `new Worker(new URL('./export.worker.ts', import.meta.url), {type:'module'})`, Promise-wrapped postMessage, `removeEventListener` on settle. Output bytes are the transferable on the return leg (inverse of the parser's input-`buf` transfer).

### Factual screen-fit presenter
**Source:** `src/components/storage/DatastoreDetail.tsx:10-18,33-44`
**Apply to:** `renderReport.tsx`, every pptx slide module
One screen-fit area = one report section / one PPTX slide (the P9 components were built for exactly this — UI-SPEC, 09-CONTEXT canonical ref). Em-dash `'—'` sentinel; gold threshold marker `border-l-2 border-l-accent-500 bg-accent-500/15 pl-2` (no icon/verdict, P9 contract); `font-mono tabular-nums` for comparable numerics; factual-only strings.

### CI: no workflow change required
**Source:** `.github/workflows/static.yml` (verified) — steps: supply-chain → npm audit → OSV → typecheck → lint → `npm run test:run` (L97-98) → `npm run build` → `check:bundle-size`, on push `main`/PR/tags/dispatch; `base:'/vatlas/'` already in `vite.config.ts`.
**Apply to:** DEP-01/DEP-02 (verification only — RESEARCH §4), Minor-7 (key-parity test rides the existing Test step). The only net-new dep risk (Wave-0 rasterizer) is auto-gated by the existing supply-chain/audit/OSV/bundle-size steps.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/engines/export/html/assembleHtml.ts` | engine utility | transform | No in-repo HTML-document string assembler. Use RESEARCH Pattern 3 (CITED react.dev) — a `<!doctype>` template with inlined `<style>` + `renderToStaticMarkup` body. The only file where string concatenation is the chosen approach. |
| `src/engines/export/pptx/primitives/chartSvg.ts` | engine transform | transform | SVG→PNG-without-DOM is the single genuine unknown (Open Q1 / Assumption A1). No in-repo precedent and no decided mechanism — **Wave-0 spike resolves it before any dependent task**. SVG source = `Chart.tsx` registry; raster = TBD (`@resvg/resvg-wasm` vs main-thread `OffscreenCanvas`). |
| `src/engines/export/pptx/builder.ts` + slides + theme/format/primitives | engine | transform | **vsizer-EXTERNAL ports.** `src/engines/export/` does not exist here. Closest in-repo analogs cited per file above (`estateView.ts` for builder, `echartsTheme.ts` for theme/primitives, `utils/format.ts` for format, `DatastoreDetail.tsx` for slides). Create fresh against those — there is no vsizer path in this repo to copy from. |

## Metadata

**Analog search scope:** `src/engines/parser/`, `src/engines/aggregation/`, `src/engines/snapshotMerge/`, `src/components/`, `src/components/storage/`, `src/store/`, `src/hooks/`, `src/theme/`, `src/i18n/`, `src/utils/`, `scripts/`, `.github/workflows/`
**Files scanned:** 14 in-repo analog files read in full or targeted
**Key verification:** `src/engines/export/` confirmed ABSENT (vsizer external); `src/utils/format.ts` confirmed to have NO U+202F/U+00A0 substitution yet (Pitfall 4 transform is net-new); `static.yml` confirmed to already run the full test suite (Minor-7 needs no workflow edit)
**Pattern extraction date:** 2026-05-18
