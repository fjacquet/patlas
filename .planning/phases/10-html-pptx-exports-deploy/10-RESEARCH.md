# Phase 10: HTML + PPTX Exports & Deploy - Research

**Researched:** 2026-05-18
**Domain:** Client-side document synthesis (self-contained HTML via React SSR + inline SVG; PPTX via pptxgenjs), Web-Worker offload, GitHub Pages CI
**Confidence:** HIGH (architecture locked in CLAUDE.md; codebase integration points read directly; library APIs verified against current docs)

## Summary

Phase 10 ships two synthesis surfaces on top of an architecture that is already fully locked (CLAUDE.md "HTML report export decision" + "Charting decision"; ROADMAP "Pitfalls owned"). There is no architecture to re-decide. The genuine planning risks are integration-level, and research resolved all six flagged unknowns:

1. **EstateView outside React is trivial and already supported.** `useEstateView` is a 3-line orchestrator: it reads inputs off the inputs-only store and calls the pure `buildEstateView(mergeSnapshotsToEstate(selected), selected, mode, today, opts)` exported from `@/engines/aggregation`. The export worker calls that exact pure function directly with the *active snapshot only* (`[activeSnapshot]`) per D-08, and again with *all loaded snapshots* for the trends section. No hook, no DOM, no `useMemo` needed in the worker. This was the "single most important technical risk" and it is LOW risk.

2. **The decisive PPTX finding: PowerPoint does not render SVG.** pptxgenjs 4.0.1 *encodes* SVG but desktop PowerPoint / PowerPoint Online do not display SVG images even when correctly embedded (verified against current pptxgenjs docs and issues #401/#528/#611). The HTML report inlines ECharts SVG directly (correct, the locked plan); the **PPTX deck must rasterize each chart to PNG**. ECharts SSR mode produces an SVG *string* with no canvas — so the worker needs an SVG→PNG raster step that does not use the DOM/Canvas (resvg-wasm-class library, or accept charts-as-PNG via a main-thread `getDataURL`). This is the single largest net-new design decision and is called out in detail below (Pitfall 1, Open Question 1).

3. **ECharts SSR is DOM-free and worker-safe.** `echarts.init(null, null, { renderer: 'svg', ssr: true, width, height })` + `setOption(opt)` + `chart.renderToSVGString()` + `chart.dispose()` requires no `document`, works in a worker, and reuses the project's existing tree-shaken `echarts/core` registry. This is the chart→SVG-string path for HTML inlining.

4. **DEP-01/DEP-02 are VERIFICATION ONLY — zero net-new CI work.** The existing `.github/workflows/static.yml` already runs supply-chain → npm audit → OSV → typecheck → lint → test → build → bundle-size → SBOM → Pages deploy on push to `main` (and PR/tags/dispatch), and `vite.config.ts` already sets `base:'/vatlas/'`. It ran on PR #2. DEP requirements are satisfied by inspection.

5. **PPTX reuse is substantial but not turnkey.** vsizer's `builder.ts`, `slides/{titleSlide,overviewSlide,clusterSlide,contentionAnnex}.ts`, `primitives/{kpiCard,progressBar,colors}.ts`, `theme.ts`, `format.ts`, and `i18n/locales/{en,fr}/pptx.json` port with mechanical type-rename edits (vsizer `ClusterAggregate`/`GlobalSummary` → vatlas `ClusterAggregate`/`GlobalSummary`, branded units). New slide modules needed: `eosSlide`, `drSimSlide`, `trendsSlide`, `inventorySlide`, plus `primitives/chartSvg.ts`. Critically: **vsizer's `buildPptx` runs on the main thread; vatlas requires the whole synthesis in a Web Worker** (5–30 MB, UI stays interactive) — the worker wrapper is net-new.

6. **i18n `report`/`pptx` namespaces + FR↔EN key-diff CI gate are net-new (Minor-7).** There is currently NO i18n key-parity test or CI gate in the repo. The `report` (HTML) and `pptx` namespaces must be added to `src/i18n/index.ts` (`NAMESPACES`, `resources`) and `locales/{en,fr}/`, and a key-diff test/script added and wired into the existing `npm run test:run` step (no workflow edit needed — it's already a CI step).

**Primary recommendation:** Plan two pure engines under `src/engines/export/{html,pptx}/` consuming `buildEstateView` output, driven by ONE export Web Worker (clone the `parseInWorker.ts` singleton/postMessage pattern, fetchGuard as first import). HTML report = `renderToStaticMarkup` of a typed React tree + inline ECharts SSR SVG strings + base64 self-hosted font + CSP meta. PPTX = ported vsizer engine + 4 new slide modules, with **charts rasterized to PNG** (resolve the SVG→PNG-without-DOM mechanism in Wave 0). DEP = verify only.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Compute active-snapshot EstateView for export | Pure engine (`buildEstateView`) | — | `useEstateView` is only an orchestrator; the engine is pure and callable anywhere incl. worker |
| Compute cross-snapshot trends for export | Pure engine (`buildEstateView` over all snapshots) | — | `TrendSeries` is produced inside the same `buildEstateView` pass; ≥2 snapshots only (D-09) |
| Chart → SVG string | Pure engine (ECharts SSR) | Web Worker (runs there) | `echarts.init(null,…,{ssr:true})` is DOM-free; reuses Chart.tsx's tree-shaken registry |
| Chart → PNG (PPTX only) | Web Worker (raster lib) OR main thread (`getDataURL`) | — | PowerPoint cannot render SVG; rasterization required — see Open Question 1 |
| HTML report assembly (`renderToStaticMarkup`) | Pure engine (React SSR boundary) | Web Worker | `react-dom/server` `renderToStaticMarkup` is synchronous & DOM-free; runs in worker |
| PPTX deck assembly | Pure engine (pptxgenjs) | Web Worker | pptxgenjs runs in workers; `pptx.write({outputType:'arraybuffer'})` returns transferable |
| Worker orchestration / progress | Main thread (hook) → Worker | sonner toast | Clone `parseInWorker.ts`; D-06 = sonner toast + disabled button, no modal |
| Download trigger (Blob + `<a>`) | Main thread (hook) | — | `URL.createObjectURL` + anchor click; identical to vsizer `useExport.ts` |
| Filename derivation (D-05) | Main thread (hook) | — | `vatlas_{vCenter}_{captureDate}.{ext}`, sanitized, from active snapshot metadata |
| i18n string resolution for exports | Main thread (resolve before postMessage) | — | Engines are pure (no i18next import); pass resolved strings object into the worker like vsizer's `PptxStrings` |
| Deploy to GitHub Pages | CI (`static.yml`) | — | Already shipped; verification only |

## Standard Stack

### Core (all already in package.json — verified against npm registry 2026-05-18)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pptxgenjs | `^4.0.1` | PPTX synthesis | `npm view pptxgenjs version` → **4.0.1** (matches CLAUDE.md). Only credible browser-side PPTX generator; vsizer engine reuses it. `[VERIFIED: npm registry]` |
| echarts | `^6.0.0` | Chart → SVG string (SSR) | `npm view echarts version` → **6.0.0** (matches CLAUDE.md). SSR `renderToSVGString` is DOM-free. `[VERIFIED: npm registry]` |
| echarts-for-react | `^3.0.6` | React ECharts wrapper (UI only) | `npm view echarts-for-react version` → **3.0.6**. NOT used in the export path — export uses `echarts/core` directly. `[VERIFIED: npm registry]` |
| react-dom/server | (React `^19.2.6`) | `renderToStaticMarkup` for HTML report | Official React SSR API; synchronous, DOM-free, worker-safe. `[CITED: react.dev/reference/react-dom/server/renderToStaticMarkup]` |
| react-i18next / i18next | `^16.6.6` / `^26.1.0` | i18n; resolve strings on main thread before postMessage | Engines stay pure (no i18next import in `engines/`). `[ASSUMED]` — versions per CLAUDE.md, not re-verified this session |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | `^2.0.7` | Progress/result toast (D-06) | Already mounted `<Toaster/>` in `App.tsx`; reuse — no new dep. `[VERIFIED: codebase grep]` |
| **SVG→PNG rasterizer (UNRESOLVED)** | TBD | Rasterize ECharts SVG → PNG for PPTX (PowerPoint cannot render SVG) | See Open Question 1 / Don't-Hand-Roll. Candidates: `@resvg/resvg-wasm` (WASM, no DOM, worker-safe) OR main-thread `OffscreenCanvas`/`Image`+canvas before postMessage. Must respect privacy guard (no network) and bundle-size gate. `[ASSUMED — needs Wave-0 spike]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ECharts SSR `renderToSVGString` | `getDataURL({type:'svg'})` on a live `Chart.tsx` instance | Requires a mounted DOM chart (main-thread only); SSR is cleaner & worker-native. Use SSR. |
| `@resvg/resvg-wasm` for PNG | Main-thread `Image`+`<canvas>` rasterize before postMessage | Canvas approach keeps zero new deps & no WASM in bundle-size budget, BUT moves chart raster onto main thread (defeats part of the worker-offload goal for the chart-heavy path). resvg-wasm keeps it in the worker but adds a WASM blob (privacy + bundle-size review needed). **Decide in Wave 0.** |
| `renderToStaticMarkup` | `renderToString` | `renderToStaticMarkup` omits React hydration attributes (`data-reactroot` etc.) → smaller, no-JS file (HTM-02). Use `renderToStaticMarkup`. `[CITED: react.dev]` |

**Installation:** No new runtime deps required for HTML or DEP. The only *potential* new dep is the PPTX chart rasterizer (Open Question 1) — `@resvg/resvg-wasm` if chosen. **Plan must NOT add the dep until the Wave-0 spike picks the mechanism**, and any new dep must clear `scripts/check-supply-chain.mjs` (telemetry denylist), `npm audit --audit-level=low`, OSV, and `scripts/check-bundle-size.mjs`.

**Version verification:** `pptxgenjs@4.0.1`, `echarts@6.0.0`, `echarts-for-react@3.0.6` — all confirmed current via `npm view <pkg> version` on 2026-05-18; all match the CLAUDE.md Recommended Stack table exactly.

## Architecture Patterns

### System Architecture Diagram

```
[App.tsx header]  "Export HTML" / "Export PPTX" buttons (D-04, beside Lang/Theme)
        │  click → useExport hook
        ▼
[useExport hook (main thread)]
   • read active snapshot + all snapshots off snapshotStore (selectActiveSnapshot, selectSnapshots)
   • resolve i18n strings for active locale (D-07) → ReportStrings / PptxStrings object
   • derive filename: vatlas_{sanitizedVCenter}_{ISOcaptureDate}.{ext} (D-05)
   • toast "Generating…" ; disable triggering button + spinner (D-06)
        │  postMessage({kind, activeSnapshot, allSnapshots, mode, opts, strings, locale})
        ▼
[export.worker.ts]  ── FIRST LINE: import './privacy/fetchGuard'
        │
        ├─ buildEstateView(mergeSnapshotsToEstate([active]), [active], mode, today, opts)   ← D-08 active-only
        ├─ buildEstateView(merge(allSnapshots), allSnapshots, mode, today, opts).trends      ← D-08 trends (≥2 → D-09)
        │
        ├── HTML path ────────────────────────────────────────────────
        │     renderCharts.ts:  for each chart option →
        │        echarts.init(null,null,{renderer:'svg',ssr:true,w,h})
        │        .setOption(opt).renderToSVGString().dispose()        → SVG string
        │     renderReport.tsx: renderToStaticMarkup(<Report view svgs strings/>)
        │     inlineAssets.ts:  base64 @font-face + CSP <meta> + per-snapshot anchor-id namespacing
        │     assembleHtml.ts:  <!doctype>… single self-contained string  → Blob(text/html)
        │
        └── PPTX path ────────────────────────────────────────────────
              renderCharts → SVG string → **rasterize to PNG** (Open Q1)  → base64 data URI
              builder.ts (ported) + slides/{title,overview,cluster,contentionAnnex,
                 eos,drSim,trends,inventory}.ts  → pptx.write({outputType:'arraybuffer'})
        │  postMessage({kind:'ok', bytes}, [transferable])  OR {kind:'err', error}
        ▼
[useExport hook]  Blob → URL.createObjectURL → <a download> click → revoke
   toast success "Report ready" / error toast ; re-enable button
```

File-to-implementation mapping is in the project structure below; the diagram shows data flow only.

### Recommended Project Structure (matches ROADMAP vsizer-reuse list)

```
src/engines/export/
├── pptx/
│   ├── builder.ts            # PORT from vsizer + add new slide dispatch
│   ├── theme.ts              # PORT verbatim (Midnight Executive hex, no '#')
│   ├── format.ts             # PORT — but make locale a param (D-07 EN+FR); see Pitfall 4
│   ├── primitives/
│   │   ├── colors.ts         # PORT verbatim
│   │   ├── kpiCard.ts        # PORT verbatim
│   │   ├── progressBar.ts    # PORT verbatim
│   │   └── chartSvg.ts       # NEW — SVG→PNG raster + addImage helper (PPT chart embed)
│   └── slides/
│       ├── titleSlide.ts     # PORT + D-03 estate identity/freshness
│       ├── overviewSlide.ts  # PORT
│       ├── clusterSlide.ts   # PORT (D-01 one-per-cluster always)
│       ├── contentionAnnex.ts# PORT (conditional CPU-Ready annex)
│       ├── eosSlide.ts       # NEW (P7 EosProjection)
│       ├── drSimSlide.ts     # NEW (P6 DR scenario)
│       ├── trendsSlide.ts    # NEW (P8 TrendSeries; omit if <2 snapshots — D-09)
│       └── inventorySlide.ts # NEW (inventory summary)
└── html/
    ├── renderReport.tsx      # NEW — typed React report tree (cover/headlines/per-cluster/EOS/DR/trends/annex/footer)
    ├── renderCharts.ts       # NEW — ECharts SSR → SVG string (shared with PPTX path before raster)
    ├── inlineAssets.ts       # NEW — base64 @font-face, CSP meta, anchor-id namespacing, size accounting
    └── assembleHtml.ts       # NEW — final <!doctype> single-file string
src/engines/export/export.worker.ts   # NEW — worker entry; fetchGuard FIRST import
src/hooks/useExport.ts                 # NEW — clone vsizer shape, but postMessage to worker
```

### Pattern 1: Pure-engine entrypoint, no React in worker

**What:** The worker calls the same pure function `useEstateView` wraps.
**When to use:** Always — this is the EstateView-outside-React answer.
**Example:**
```typescript
// Source: src/hooks/useEstateView.ts (lines 50-62) — the exact call to clone in the worker
import { buildEstateView } from '@/engines/aggregation'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'

// D-08: active snapshot ONLY for the report body
const active = /* selectActiveSnapshot resolved on main thread, posted in */
const today = new Date()
const view = buildEstateView(
  mergeSnapshotsToEstate([active]), [active], mode, today,
  { stretchedClusters, scenario, plannedRatios: { cpuRatio, ramRatio }, thresholds },
)
// D-08 trends: ALL loaded snapshots; D-09: view2.trends is null when <2 → omit section
const all = /* all snapshots posted in */
const view2 = buildEstateView(mergeSnapshotsToEstate(all), all, mode, today, opts)
const trends = view2.trends // TrendSeries | null
```

### Pattern 2: ECharts SSR → SVG string (DOM-free, worker-safe)

**What:** Render any existing chart `option` to an SVG string without a browser.
**When to use:** Every chart in the HTML report; same call feeds the PPTX raster step.
**Example:**
```typescript
// Source: https://apache.github.io/echarts-handbook/en/how-to/cross-platform/server/  [CITED]
import * as echarts from 'echarts/core'
// reuse the SAME tree-shaken registry as src/components/Chart.tsx
// (echarts.use([... SVGRenderer ...]) — registered once at module scope)
function chartToSvg(option: EChartsOption, width: number, height: number): string {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height })
  chart.setOption(option)
  const svg = chart.renderToSVGString()
  chart.dispose() // release memory — mandatory in a loop over many clusters
  return svg
}
```
Note: `width`/`height` MUST be explicit in SSR mode (no responsive container). Plan fixed export dimensions per chart.

### Pattern 3: Self-contained HTML assembly

**What:** `renderToStaticMarkup` a typed React tree, inline everything.
**Example:**
```typescript
// Source: https://react.dev/reference/react-dom/server/renderToStaticMarkup  [CITED]
import { renderToStaticMarkup } from 'react-dom/server'
const body = renderToStaticMarkup(<Report view={view} trends={trends} svgs={svgMap} strings={strings} />)
// assembleHtml.ts:
const html =
  `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">` +
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline' data:; font-src data:">` +
  `<style>@font-face{font-family:'X';src:url(data:font/woff2;base64,${b64})format('woff2')} ${css}</style>` +
  `</head><body>${body}</body></html>`
```
SVG charts are embedded as raw inline `<svg>…</svg>` in the React tree (NOT `<img>`), so HTM-02 (no JS, offline) holds. The SVG strings come ONLY from ECharts SSR (a trusted generator), never from user data — so React's default text escaping is the right and sufficient control for all user-derived strings; do not use any raw-HTML-injection React prop for data.

### Pattern 4: Worker singleton + transferable (clone parser pattern)

**What:** One module-scope worker, postMessage in, transferable ArrayBuffer out.
**Example:** Clone `src/engines/parser/parseInWorker.ts` verbatim in shape — `new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' })`, `postMessage(msg)` (snapshots are structured-cloneable; the returned PPTX/HTML bytes are the transferable on the way back).

### Anti-Patterns to Avoid

- **Importing `useEstateView` (or any hook) into the worker:** hooks need React render context. Call `buildEstateView` directly.
- **Embedding chart SVG into PPTX and hoping PowerPoint renders it:** it will not (verified). Rasterize to PNG.
- **`import * as echarts from 'echarts'` in the export path:** blows the ≤300 KB bundle-size gate. Reuse the existing `echarts/core` + `echarts.use([...])` registry.
- **Any `fetch`/CDN font in the report:** privacy guard throws synchronously; fonts MUST be base64-inlined or system-font-only.
- **Pre-formatted numbers inside i18n strings / editorial verbs:** the factual-only string lint (HTM-05, criterion 4) and Moderate-2 forbid it. Numbers are formatted by `@/utils/format` with the active locale and interpolated; strings carry no "recommend/should/poor/good".
- **A second `useMemo` on the main thread for export data:** grep-gated single-memo invariant. Resolve store inputs in the hook and post them; do the heavy compute in the worker.
- **Comments containing the literal forbidden tokens** (e.g. spelling out the raw MiB constant, a banned editorial verb, or the React raw-HTML-injection prop name to say "never used"): the grep gates and security hook match doc-comments too (CLAUDE.md Gotchas). Phrase absence comments without the literal token.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| EstateView for export | A re-implementation of aggregation in the worker | `buildEstateView` from `@/engines/aggregation` | DRY (CLAUDE.md binding); it's already pure and is the single source of truth |
| Chart → SVG | Hand-walk ECharts internals / custom serializer | `echarts.init(null,…,{ssr:true}).renderToSVGString()` | Official ECharts SSR API; DOM-free |
| HTML structure | Template-literal string concatenation for the whole report | `renderToStaticMarkup(<TypedReact/>)` | CLAUDE.md "HTML report export decision" explicitly chose this; typed components, far fewer escaping bugs |
| PPTX file format | OOXML XML by hand | pptxgenjs 4.0.1 (+ ported vsizer engine) | Mature, vsizer engine is proven |
| Locale number formatting | New formatter | `@/utils/format.ts` (already locale-param) + vsizer pptx `format.ts` pattern | Moderate-2; em-dash sentinel & branded units already correct |
| Worker plumbing | New worker harness | Clone `parseInWorker.ts` singleton/postMessage/transferable shape | Established pattern, fetchGuard discipline already encoded |
| Download trigger | New blob/anchor code | Clone vsizer `useExport.ts` `triggerDownload` | Identical requirement |
| SVG→PNG (PPTX) | Custom SVG path rasterizer | A vetted lib (`@resvg/resvg-wasm`) OR `OffscreenCanvas`+`Image` (Wave-0 decision) | SVG rasterization edge cases (fonts, transforms, gradients) are deep; do not hand-roll |
| CI/deploy | Any new workflow | Existing `.github/workflows/static.yml` | Already satisfies DEP-01/02 |

**Key insight:** This phase is almost entirely *assembly of already-shipped pure outputs*. The only place a custom solution is even tempting — SVG→PNG for PPTX — is the one place the ecosystem's edge cases (font metrics, gradients, clip paths) make hand-rolling a trap.

## Common Pitfalls

### Pitfall 1: PowerPoint silently shows blank where SVG charts should be
**What goes wrong:** Charts embedded as SVG data URIs render fine in the HTML report but appear blank/broken in the delivered `.pptx` on most clients.
**Why it happens:** pptxgenjs *encodes* SVG but desktop PowerPoint & PowerPoint Online do not render SVG images even when correctly embedded (verified: pptxgenjs docs + issues #401/#528/#611). vsizer never hit this because its slides use native pptxgenjs shapes/tables, not chart images.
**How to avoid:** Rasterize every chart to PNG for the PPTX path (`primitives/chartSvg.ts`). Resolve the no-DOM rasterization mechanism in Wave 0 (Open Question 1). The HTML path keeps raw inline SVG (correct).
**Warning signs:** A reviewer opening the deck in Office 365 sees empty chart frames; the golden-PPTX test passes structurally but no one opened the file in PowerPoint.

### Pitfall 2: Worker uses `useEstateView` / store hooks → crash
**What goes wrong:** Importing the hook (or `useSnapshotStore`) into the worker throws (no React render tree / Zustand subscription context).
**Why it happens:** `useEstateView` is a hook; the worker has no React.
**How to avoid:** Resolve store inputs on the main thread (`selectActiveSnapshot`, `selectSnapshots`), postMessage them, call `buildEstateView` directly in the worker.
**Warning signs:** "Invalid hook call" / `undefined is not a function` at worker start.

### Pitfall 3: Privacy guard throws inside the worker on a font/asset fetch
**What goes wrong:** Any attempt to `fetch()` a font or asset (even same-origin-looking CDN) in the worker throws `PrivacyViolation`, white-screening the export.
**Why it happens:** `fetchGuard` is (and must be) the first import in every worker entry; it throws synchronously, by design (CLAUDE.md Gotchas — it does not silently block).
**How to avoid:** All fonts/CSS for the report are base64-inlined at build time (import the woff2 as a base64 string via Vite asset handling, or vendor a base64 constant) — no runtime fetch. If a self-hosted font is too heavy for the budget (Pitfall 5), fall back to a CSS system-font stack and inline zero font bytes.
**Warning signs:** `PrivacyViolation: fetch attempted to reach non-same-origin URL` in the export path.

### Pitfall 4: vsizer pptx `format.ts` is fr-FR-hardcoded; D-07 needs EN too
**What goes wrong:** Ported `format.ts` always emits French thin-space grouping; the EN export shows `12 345` instead of `12,345` — PPT-04 fails for EN.
**Why it happens:** vsizer's deck was FR-only; its `groupThousands` hard-codes NBSP.
**How to avoid:** Port but parameterize by locale (mirror vatlas `src/utils/format.ts`, which already takes a `locale` arg). FR: U+202F→U+00A0 substitution (Moderate-8) and `,` decimal; EN: `,` thousands + `.` decimal. The active locale is posted into the worker (D-07).
**Warning signs:** Golden-PPTX EN snapshot shows U+00A0/U+202F separators or `.`-grouped integers.

### Pitfall 5: HTML report blows the <5 MB / <15 MB budget
**What goes wrong:** Per-cluster inline SVG × N clusters + base64 font pushes a large estate past the 15 MB hard ceiling (Moderate-7 / HTM-03).
**Why it happens:** ECharts SVG strings are verbose; a 50+-cluster estate with a chart per cluster plus a base64 woff2 (~30–100 KB) adds up.
**How to avoid (size math, realistic large estate):** Budget per chart-SVG ≈ 20–80 KB (treemap/heatmap are the heavy ones; bar/line/gauge ≈ 10–30 KB). 60 clusters × ~3 charts × ~40 KB ≈ 7 MB of SVG → within 15 MB but over the 5 MB "typical" target → use the CONTEXT "Claude's discretion within HTM-04" lever: **top-N clusters inline, remainder summarized in the annex (table, no per-cluster charts)**; fold P9 Storage/Network into the annex rather than dedicated per-item chart sections. One base64 font max (~30–60 KB woff2) or system-font stack (0 bytes). Add a size-accounting assertion in `inlineAssets.ts` and a test fixture against the 10k-inventory generator (`scripts/generate-inventory-10k.mjs`) to prove the ceiling.
**Warning signs:** Exported file > 15 MB on the large fixture; the report test has no size assertion.

### Pitfall 6: Per-snapshot anchor-id collisions in the single-file report
**What goes wrong:** Two clusters named the same across sections produce duplicate `id=` anchors; in-report links jump to the wrong place.
**Why it happens:** Naive `id={clusterName}` from real-world data with repeated names.
**How to avoid:** Namespace anchor ids deterministically (e.g. `c-${index}-${slug(name)}`); the report is one snapshot (D-08) so a snapshot prefix isn't needed, but section+index prefixing is.
**Warning signs:** HTML validator duplicate-id warnings; broken in-report navigation.

### Pitfall 7: i18n key drift between EN and FR ships untranslated UI in the export
**What goes wrong:** A `report`/`pptx` key added to `en` but not `fr` (or vice-versa) → raw key text in one locale's export.
**Why it happens:** No key-parity gate exists today (verified — no such test/script in repo).
**How to avoid:** Add a key-diff test (Minor-7) that fails when `Object.keys` of any namespace differ between `en` and `fr` (deep, recursive). It runs inside the existing `npm run test:run` CI step — no workflow change.
**Warning signs:** Export shows `report.cover.title` literally.

## Runtime State Inventory

Not a rename/refactor/migration phase — section omitted.

## Code Examples

### Filename derivation (D-05) — clone vsizer sanitize, add vCenter+date
```typescript
// Source: adapted from vsizer src/hooks/useExport.ts (sanitizeBaseName)  [CITED]
const sanitize = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'estate'
const vc = snapshots.size > 1 ? 'multi' : sanitize(active.vCenterLabel) // D-05 multi-vCenter rule
const iso = active.capturedAt.toISOString().slice(0, 10)               // ISO capture date
const filename = `vatlas_${vc}_${iso}.${ext}`                          // vatlas_spvspherevc11_2026-05-18.html
```

### i18n key-parity gate (Minor-7) — new test, runs in existing CI test step
```typescript
// src/i18n/keyParity.test.ts  (NEW)
import { describe, expect, it } from 'vitest'
import { resources } from './index'
const keys = (o: object, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`])
describe('i18n EN↔FR key parity', () => {
  for (const ns of Object.keys(resources.en) as (keyof typeof resources.en)[]) {
    it(`namespace "${ns}" has identical keys in en and fr`, () => {
      expect(keys(resources.en[ns]).sort()).toEqual(keys(resources.fr[ns]).sort())
    })
  }
})
```

### PPTX chart embed after raster (the PowerPoint-safe path)
```typescript
// Source: https://gitbrent.github.io/PptxGenJS/docs/api-images/  [CITED]
// svgString → PNG base64 via the Wave-0-chosen rasterizer (NOT shown: that decision)
slide.addImage({ data: `image/png;base64,${pngB64}`, x: 0.5, y: 1.2, w: 6.0, h: 3.4 })
// NEVER: slide.addImage({ data: `image/svg+xml;base64,${svgB64}` })  // PowerPoint renders blank
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ECharts requires a DOM container | `echarts.init(null,…,{ssr:true})` + `renderToSVGString()` | ECharts 5.3+ (SSR PR #15880); unchanged in v6 | DOM-free chart→SVG in a worker — the keystone of the HTML report `[CITED: echarts-handbook]` |
| vsizer pptx on main thread | vatlas runs whole synthesis in a Web Worker | This phase | UI stays interactive during 5–30 MB synthesis (criterion) |
| FR-only deck (vsizer) | EN+FR, active-locale single artifact (D-07) | This phase | `format.ts` must be locale-parameterized |

**Deprecated/outdated:** Embedding SVG into PPTX expecting it to render — never worked in PowerPoint clients and still doesn't (2026); rasterize.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@resvg/resvg-wasm` (or `OffscreenCanvas`) is a viable no-DOM SVG→PNG path that clears the privacy guard + bundle-size + supply-chain gates | Standard Stack / Open Q1 | HIGH — PPTX charts unrenderable or a CI gate blocks; this is the one true unknown, Wave-0 spike mandatory |
| A2 | `buildEstateView` over `[activeSnapshot]` produces a single-vCenter view identical to what the dashboard would show for that snapshot alone (D-08 intent) | Pattern 1 | MEDIUM — if `mergeSnapshotsToEstate([one])` isn't a clean identity, export numbers diverge from a single-snapshot dashboard; verify with a unit test |
| A3 | A self-hosted woff2 fits the 5 MB typical budget alongside per-cluster SVG, OR a system-font stack is acceptable for the report's visual bar | Pitfall 5 | LOW — fallback (system fonts, 0 bytes) is always available; affects polish only |
| A4 | pptxgenjs 4.0.1 runs inside a Web Worker (no `window`/DOM dependency in its write path) | Architecture | MEDIUM — if it touches DOM, PPTX assembly must move to main thread (HTML still worker); vsizer ran it main-thread so worker-safety is unproven here. Verify in Wave 0. |
| A5 | i18next/react-i18next versions (16.6.6/26.1.0) per CLAUDE.md are current | Standard Stack | LOW — not on the export critical path; UI already uses them |

## Open Questions

1. **SVG→PNG without a DOM, for the PPTX charts (the critical unknown).**
   - What we know: PowerPoint cannot render embedded SVG (verified); HTML path is fine with raw SVG; ECharts SSR gives an SVG *string* only (no canvas).
   - What's unclear: the best no-DOM rasterizer. `@resvg/resvg-wasm` (worker-safe, no DOM, but +WASM bytes & a new supply-chain entry) vs main-thread `OffscreenCanvas`/`Image`+`<canvas>` (zero new deps, but chart raster leaves the worker). Both must pass `check-supply-chain.mjs`, `npm audit --audit-level=low`, OSV, and `check-bundle-size.mjs`.
   - Recommendation: **Wave-0 spike** — prototype both against one treemap + one heatmap (the visually hardest), confirm PowerPoint renders the PNG, measure bundle/CI impact, then lock the choice as the first plan task. Do not let later tasks assume a mechanism.

2. **Does pptxgenjs 4.0.1 run cleanly in a Web Worker?** (Assumption A4)
   - What we know: it's pure JS file synthesis; vsizer ran it on the main thread.
   - What's unclear: whether its write path touches `window`/`document`.
   - Recommendation: smoke-test in the Wave-0 worker spike alongside Q1. If it needs DOM, keep PPTX assembly on the main thread (HTML stays in the worker) — acceptable degradation, still off the critical path for the heavy HTML synthesis.

3. **Per-cluster inline depth vs 5 MB typical budget** (Pitfall 5 / CONTEXT "Claude's discretion within HTM-04").
   - What we know: 15 MB hard ceiling is reachable; 5 MB typical needs the top-N-inline + annex-table lever.
   - Recommendation: planner chooses a top-N threshold (research suggests ~12–20 clusters inline with charts, remainder as an annex table; P9 Storage/Network folded into the annex). Add a size-assertion test on the 10k fixture.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pptxgenjs | PPT-01..04 | ✓ (package.json) | ^4.0.1 | — |
| echarts (core, SVG, SSR) | HTM-02 chart inlining | ✓ (package.json) | ^6.0.0 | — |
| react-dom/server | HTM-01/04 | ✓ (React 19.2.6) | — | — |
| GitHub Pages CI | DEP-01/02 | ✓ (`static.yml`, ran on PR #2) | — | — |
| `base:'/vatlas/'` | DEP-01 | ✓ (`vite.config.ts`) | — | — |
| SVG→PNG rasterizer | PPT chart images | ✗ (undecided) | — | Main-thread `OffscreenCanvas`/`Image`+canvas (zero new deps) |
| Self-hosted woff2 font | report polish | ✗ (none vendored) | — | System-font CSS stack (0 bytes) — fully acceptable |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** SVG→PNG rasterizer (fallback: main-thread canvas raster); report font (fallback: system-font stack).

## Validation Architecture

`workflow.nyquist_validation` not disabled — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.2` + @testing-library/react `^16.3.2` (jsdom default; Browser Mode available for render tests) |
| Config file | `vitest` config in repo (per CLAUDE.md commands); test tsconfig `tsconfig.test.json` |
| Quick run command | `npm run test:run -- src/engines/export` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HTM-01 | One click → single `.html` Blob produced | unit | `npm run test:run -- src/engines/export/html` | ❌ Wave 0 |
| HTM-02 | Output has inline `<svg>`, no `<script>`, valid offline | unit (assert no `<script`, has `<svg`) | same | ❌ Wave 0 |
| HTM-03 | Size < 5 MB typical / < 15 MB on 10k fixture | unit (byte-length assertion on `generate-inventory-10k` fixture) | same | ❌ Wave 0 |
| HTM-04 | Contains all 8 sections (cover…footer) | unit (markup contains section markers) | same | ❌ Wave 0 |
| HTM-05 | No editorial verbs in any report string | reuse existing factual-string lint over `report` ns | existing i18n lint | ❌ extend |
| PPT-01 | One click → `.pptx` ArrayBuffer produced | unit | `npm run test:run -- src/engines/export/pptx` | ❌ Wave 0 |
| PPT-02 | Midnight Executive theme hex present | unit (theme constant assertion) | same | ❌ Wave 0 |
| PPT-03 | Slide list present incl. conditional CPU-Ready annex | golden-PPTX structural snapshot | same | ❌ Wave 0 |
| PPT-04 | EN `,`/`.` and FR U+00A0/`,` number formatting | unit (format.ts locale param, both locales) | same | ❌ Wave 0 |
| DEP-01 | Public URL reachable | manual (post-deploy) | — | ✅ pipeline shipped |
| DEP-02 | CI runs typecheck→lint→test→build→deploy on `main` | inspection of `static.yml` | — | ✅ verified |
| Minor-7 | EN↔FR key parity for all namespaces incl. `report`/`pptx` | unit (recursive key-diff) | `npm run test:run -- src/i18n` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run -- src/engines/export` (+ `src/i18n` when touching locales)
- **Per wave merge:** `npm run test:run`
- **Phase gate:** full suite green + `npm run build` + `npm run check:bundle-size` + `node scripts/check-supply-chain.mjs` before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] **SVG→PNG-without-DOM spike** — resolves Open Question 1 + Assumption A1/A4 (highest risk; do first)
- [ ] `src/engines/export/html/*.test.ts` — covers HTM-01..04 (incl. 10k-fixture size assertion for HTM-03)
- [ ] `src/engines/export/pptx/*.test.ts` — covers PPT-01..04 (golden-PPTX structural snapshot)
- [ ] `src/i18n/keyParity.test.ts` — covers Minor-7 (recursive EN↔FR diff, all namespaces)
- [ ] Extend the existing factual-string lint to the new `report`/`pptx` namespaces (HTM-05 / criterion 4)
- [ ] Unit test asserting `buildEstateView([activeSnapshot])` ≡ single-snapshot dashboard view (Assumption A2)

## Security Domain

`security_enforcement` not disabled — section included. This is a client-only static app; the privacy invariant is the dominant control.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface (static site) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No server / no protected resources |
| V5 Input Validation | yes (indirect) | RVTools input already Zod-validated at the P-shipped parser boundary; export only consumes already-validated `EstateView` — no new untrusted input |
| V6 Cryptography | no | No crypto in scope |
| V12 Files & Resources | yes | Export produces a local Blob download; no upload, no path handling beyond a sanitized filename (D-05 regex) |
| V14 Configuration | yes | CSP `<meta>` in the exported HTML (`default-src 'none'`; only `data:` for img/font/style) — no script execution in the artifact (HTM-02) |

### Known Threat Patterns for client-only React export

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Workbook bytes exfiltrated via a font/asset/CDN fetch in the export path | Information disclosure | `fetchGuard` first import in the worker; all assets base64-inlined, zero runtime fetch (privacy invariant) |
| Stored XSS in the exported HTML via a malicious VM/cluster name | Tampering | `renderToStaticMarkup` escapes interpolated text by default (React); user-derived strings go only through normal JSX text nodes; never the raw-HTML-injection React prop for data; chart SVG comes only from ECharts SSR (trusted generator), not user strings |
| Telemetry/analytics SDK sneaks in via a new export dep | Information disclosure | `scripts/check-supply-chain.mjs` denylist + OSV + `npm audit --audit-level=low` already gate every dep; any rasterizer dep must clear them |
| Anchor-id / DOM-clobbering in the single-file report | Tampering | Deterministic namespaced ids (`c-${i}-${slug}`), not raw user names (Pitfall 6) |
| Supply-chain swap of the `xlsx` tarball pin while adding deps | Tampering | Existing pin gate in `check-supply-chain.mjs`; never `npm audit fix --force` (CLAUDE.md) |

## Sources

### Primary (HIGH confidence)
- Codebase (read directly): `src/hooks/useEstateView.ts`, `src/components/Chart.tsx`, `src/store/snapshotStore.ts`, `src/engines/parser/parser.worker.ts`, `src/engines/parser/parseInWorker.ts`, `src/engines/aggregation/index.ts`, `src/types/estate.ts`, `src/i18n/index.ts`, `src/utils/format.ts`, `src/privacy/fetchGuard.ts`, `.github/workflows/static.yml`, `scripts/check-bundle-size.mjs` — integration ground truth
- vsizer reuse source (read directly): `src/engines/export/pptx/{builder.ts,theme.ts,format.ts}`, `src/hooks/useExport.ts`, `src/i18n/locales/en/pptx.json`
- `npm view {pptxgenjs,echarts,echarts-for-react} version` — 4.0.1 / 6.0.0 / 3.0.6 verified 2026-05-18
- [ECharts SSR handbook](https://apache.github.io/echarts-handbook/en/how-to/cross-platform/server/) — `init(null,…,{ssr:true})` + `renderToSVGString()`, DOM-free
- [React renderToStaticMarkup](https://react.dev/reference/react-dom/server/renderToStaticMarkup) — no-hydration markup
- [pptxgenjs Images API](https://gitbrent.github.io/PptxGenJS/docs/api-images/) — `addImage` data/path, SVG limitation
- CLAUDE.md (binding decision record) + `.planning/phases/10-html-pptx-exports-deploy/10-CONTEXT.md` (D-01..D-09)

### Secondary (MEDIUM confidence)
- pptxgenjs GitHub issues #401 / #528 / #611 — SVG-in-PowerPoint historical/ongoing limitation (cross-confirms the rasterize requirement)
- WebSearch corroboration of ECharts 5.3+ SSR PR #15880 carrying into v6

### Tertiary (LOW confidence — flagged for Wave-0 validation)
- `@resvg/resvg-wasm` / `OffscreenCanvas` as the no-DOM rasterizer — NOT yet validated against this repo's privacy/bundle/supply-chain gates (Open Question 1, Assumption A1)
- pptxgenjs Web-Worker safety — inferred, not proven here (Assumption A4)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions registry-verified; all already in package.json; APIs cited from official docs
- Architecture: HIGH — locked in CLAUDE.md; every integration point read directly from source
- EstateView-outside-React: HIGH — exact pure entrypoint traced (`buildEstateView` from `@/engines/aggregation`)
- DEP gap analysis: HIGH — `static.yml` read in full; DEP-01/02 are verification only
- PPTX chart embedding: HIGH — PowerPoint-SVG limitation verified across docs + multiple issues
- SVG→PNG-without-DOM mechanism: LOW — the one genuine unknown; mandatory Wave-0 spike
- Pitfalls: HIGH (1–7 all grounded in verified facts or read code)

**Research date:** 2026-05-18
**Valid until:** 2026-06-17 (30 days — stable stack; re-verify pptxgenjs/echarts only if a new major ships)
