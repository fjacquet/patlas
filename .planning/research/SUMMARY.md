# Project Research Summary

**Project:** vatlas
**Domain:** 100 % client-side VMware estate analytics web app (RVTools `.xlsx` only) — drop-file → interactive atlas → self-contained HTML report + PPTX deck. Broader sibling of `vsizer`.
**Researched:** 2026-05-15
**Confidence:** HIGH overall (every cross-cutting decision is either inherited from `vsizer`'s shipped baseline or verified against current upstream releases in 2026-05).

## Executive Summary

vatlas is an *analytics atlas* over RVTools workbooks: ingest one or many `.xlsx` exports in the browser, present a global dashboard + virtualised inventory tree + EOS forecast + DR what-if + in-session trends, then export the synthesis as one self-contained HTML report and one PPTX deck. Experts build this class of tool exactly the way `vsizer` already does — pure-function `engines/` over Zustand-held immutable snapshots, with `useMemo`-derived view-models feeding both UI and exports — and vatlas should adopt that pattern wholesale rather than reinvent it. The product invariants (100 % client-side, no telemetry, no cross-session persistence, RVTools-only, factual reports with **no editorial recommendations**) are inherited from `vsizer` and non-negotiable; they cascade into stack choices (no analytics SDK, no Sentry by default, runtime fetch-wrapper guard), data model (Snapshot is immutable, Estate is a Set of snapshot ids, aggregates are derived not stored), and export design (one-file HTML, factual PPTX in the Midnight Executive palette).

The recommended stack is **vsizer's stack at current 2026-05 versions** (React 19.2, Vite 8 + Rolldown, Tailwind v4.3, Zustand 5, Zod 4, SheetJS 0.20.3 via the official CDN tarball — **never** the CVE-affected npm `xlsx`, pptxgenjs 4, Vitest 4, Biome 2) plus two new pieces for vatlas: **Apache ECharts via `echarts-for-react` with tree-shaken imports + the SVG renderer** for charting, and **live-DOM serialization via `renderToStaticMarkup` + inlined CSS/fonts/SVG** for the HTML report export. The chart-library choice is the biggest new decision: vatlas needs treemap, sunburst, heatmap, calendar-heatmap, and gauge series, and ECharts ships all of them as first-class series with a documented `renderToSVGString()` path that makes the HTML-report export trivially compatible.

The dominant risks are not technical — they are *correctness* and *privacy* risks. Wrong numbers in an operator-facing capacity tool are worse than no numbers (one operator will base a budget on them), so the math pitfalls flagged in `PITFALLS.md` (RVTools "MB" is MiB; powered-off VMs distort consolidation ratios; multi-vCenter merges must key on `(VI SDK UUID, VM/cluster UUID)` not name; stretched-cluster 50 % is only correct for symmetric clusters; hyperthreads are not pCPU; DR sim must show its assumptions) all require dedicated engineering. The privacy invariant must be defended with a runtime `fetch`/`XHR`/`WS`/`sendBeacon` guard, a CSP `connect-src 'self'` meta tag, and a CI denylist of telemetry packages — landed in the very first phase, before any feature that might be tempted to add them.

## Key Findings

### Recommended Stack

vatlas adopts `vsizer`'s stack at 2026-05 versions and adds exactly two new dependencies (`echarts` + `echarts-for-react`) plus a hand-rolled HTML-report assembler. The full pinned list, rationale, and `npm install` commands are in `STACK.md`. Critical pins: **React 19.2.6**, **Vite 8.0.12** (Rolldown bundler, GA 2026-03-12), **Tailwind 4.3** with `@tailwindcss/vite`, **Zod 4.4.3** (v4 API only — `error` parameter, not v3's `message`/`required_error`), **Zustand 5.0.13** (named imports), **`xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`** (never the npm `xlsx@0.18.5`, which carries CVE-2024-22363 ReDoS + CVE-2023-30533 prototype pollution), **pptxgenjs 4.0.1**, **react-i18next 16 / i18next 26**.

**Core technologies:**

- **React 19.2 + TypeScript 5.9 (strict) + Vite 8 (Rolldown)** — UI runtime and build. Client-only, so the 2025-12/2026-01 RSC CVE chain does not apply. Match `vsizer` `tsconfig.app.json` verbatim (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `erasableSyntaxOnly`).
- **Apache ECharts 5.6 via `echarts-for-react` 3, SVG renderer, tree-shaken** — charting engine. Single decisive reason: vatlas needs treemap, sunburst, heatmap, calendar-heatmap, and gauge; ECharts ships all five natively where Recharts ships none of them, Nivo ships them with weaker SVG-export ergonomics, and visx ships them only as *primitives to build from*. SVG renderer (not Canvas) is the keystone that makes the HTML-report export embed crisp inline `<svg>` with one line of code. See "Tension reconciled" below.
- **SheetJS 0.20.3 via CDN tarball** — RVTools `.xlsx` parsing. The npm `xlsx` package is frozen at 0.18.5 and CVE-affected; SheetJS deliberately publishes only via `cdn.sheetjs.com`. Pin in `package.json` as the full tarball URL; revert any tool that rewrites it.
- **Zustand 5 + Zod 4** — memory-only state and parser-boundary validation. No `localStorage`/`IndexedDB`/`OPFS` of dataset rows, ever. UI-only prefs (theme, locale) may use `localStorage`.
- **pptxgenjs 4.0.1** — PPTX export. Inherit `vsizer/engines/export/pptx/` style tokens (Midnight Executive palette, factual-only copy).
- **react-i18next 16 + i18next 26 + i18next-browser-languagedetector 8** — FR + EN; new namespaces beyond `vsizer`: `inventory`, `eos`, `dr`, `trends`, `report`.
- **`renderToStaticMarkup` (`react-dom/server` in the browser) + hand-rolled inline CSS + ECharts `renderToSVGString()`** — HTML-report assembler. Zero new heavy deps. Output is a single `.html` Blob, viewable offline, with no JS execution required to view.
- **Vitest 4 + @testing-library/react 16 + jsdom 29** — tests. Switch to **Vitest 4 Browser Mode** for chart-render tests (jsdom does not produce real SVG geometry).
- **Biome 2** — lint + format. Copy `biome.json` from `vsizer`.

What NOT to use is just as important: **never** `npm install xlsx`; **never** `import * as echarts from 'echarts'` (use `echarts/core` + per-feature imports + `echarts.use([...])` to land ~150–300 KB gz); **never** Canvas renderer for charts that feed the HTML report; **no** Sentry/PostHog/Amplitude/Mixpanel/Datadog/LogRocket; **no** Tailwind output in the HTML report (a hand-written ~5 KB report stylesheet); **no** source-map upload step in CI; **no** service worker.

### Expected Features

The v1 feature set is fixed by `PROJECT.md` and elaborated in `FEATURES.md`. Every feature is filtered through the product invariants — several common "table stakes" of the capacity-tool space (real-time vCenter polling, saved scenarios, recommendation engine) become explicit anti-features for vatlas.

**Must have (table stakes, all P1):**

- Global vCenter dashboard, one column per cluster (mirrors RVTools Analyser's headline view) — drives `engines/aggregation/perCluster.ts` reused from `vsizer` plus a new OS classifier.
- Virtualised inventory tree (vCenter → Datacenter → Cluster → ESX → VM) — `@tanstack/react-virtual` + `@tanstack/react-table`, lazy children, mandatory at 10k+ VM scale.
- Sortable/filterable tables per object class (VM, ESX, Datastore) with CSV export of the current filter.
- Datastore view (capacity, free, %used, # VMs, provisioning ratio), keyed on NAA/UUID not name to avoid the same-LUN-counted-twice trap.
- **Multi-vCenter aggregation** — load N workbooks, treat as one logical estate. Disambiguate by `(VI SDK UUID, VM UUID)` (RVTools 3.9.2+ surfaces both). Cluster-name collisions across vCenters get a visual suffix; **never silent merge**.
- **OS End-of-Support forecast** at 3/6/9/12-month horizons — bundled `endoflife.date` snapshot (MIT-licensed) refreshed at CI build time via `scripts/sync-eos-catalogue.ts`. Must include an "overdue" bucket (RHEL 7 and Windows Server 2012 R2 are already past EOS).
- Allocation-ratio sliders — defaults **CPU 4:1, RAM 1:1**; sliders with named presets (1:1, 4:1, 8:1, VDI 10:1). Persist only in URL hash, not `localStorage`.
- **DR simulation** in three modes — host loss (N+1/N+2), cluster loss, vCenter loss — plus a stretched-cluster split-brain bonus mode. Output shows before/after numbers, evacuee totals, per-survivor verdict, and **an explicit assumptions panel** (this matters: the sim does not model HA admission control, anti-affinity, or HA restart priority by default).
- Stretched-cluster pill driving 50 % CPU + RAM reservation — port from `vsizer` (ADR-0007). Extend with a `confidence` field per cluster (`high` if site tag/fault-domain present, `medium` if assumed-symmetric, `low` if asymmetric without site data).
- **In-session trends** across multiple monthly RVTools snapshots — line charts of headline metrics, per-cluster sparklines on the dashboard, delta panel. **In-memory only**; refresh wipes everything. 2–12 snapshots is the sane range.
- **Visual-first UX** — charts as first-class throughout: stacked bar, donut (OS mix), treemap (datastore footprint), heatmap (cluster × time), calendar-heatmap (EOS), line (trends), gauge (allocation), sparkline (per-row trend direction).
- **HTML report export** — single self-contained `.html` file, fully offline, no JS required to view, < 5 MB typical / < 15 MB hard ceiling.
- **PPTX export** — reuse `vsizer/engines/export/pptx/` shape; add EOS / DR / Trends / Inventory slides; pre-format numbers locale-aware (U+202F → U+00A0 substitution for PPTX font safety).
- Drag-and-drop multi-file upload, **i18n FR + EN**, light/dark theme, GitHub Pages deploy to `fjacquet.github.io/vatlas/`.

**Should have (differentiators, mostly P1 with a few P2):**

- Browser-only / refresh-wipes narrative on the upload screen and README (the consultant story).
- CI-time EOS catalogue refresh (D2) — vatlas always ships current EOS dates.
- One-click drill from an EOS bucket to the affected VM list (D3).
- DR scenario presets ("lose largest cluster", "lose vCenter A", "lose left-side of stretched") (D4, P2).
- Per-cluster sparklines on the dashboard when multiple snapshots are loaded (D5, P2).
- Snapshot side-by-side diff view — "what changed between January and April" (D7, P2).
- Estate treemap and cluster × time heatmap as headline visuals (D8/D9, P2).
- Data-freshness display (workbook capture date prominent in header and on every export footer) (D10).
- Drop-zone validation that names the missing sheets/columns (D11).
- Cultural rule: **no editorial recommendations** ever (D12) — lint i18n strings for "recommend / should / poor / good".

**Defer (v2+):**

- DR scenario presets, snapshot side-by-side diff (P2 — quick add after v1 ships).
- Multi-file `.zip` bundle support, richer drill-down filters, more OS distros (only when a real user asks).
- URL-hash-encoded saved scenarios, industry-baseline comparison, plugin architecture (real-demand-only).

**Explicit anti-features (do not build):**

- Real-time vCenter API connection (breaks every invariant; RVTools already does this collection job).
- Persisted scenarios / saved dashboards / accounts (breaks privacy; requires a backend).
- Editorial recommendations ("you should consolidate cluster X") — the narrative is the presenter's value-add.
- Telemetry / "anonymous usage stats" — even anonymous breaks the privacy invariant if it touches parsed content.
- Live Optics ingestion (`vsizer` carries this; vatlas drops it for narrower parser surface).
- IndexedDB / OPFS for "convenience" — see Critical-2.
- In-browser editing of inventory rows (RVTools is source of truth).
- Right-sizing recommendation engine (RVTools snapshots lack peak-active data).
- Mobile / touch-first UX (10k+ row tables are not a mobile use case; desktop-first responsive only).

### Architecture Approach

vatlas is a pure-engines architecture: all non-trivial logic lives in `src/engines/` as plain pure functions (`(input data) -> derived data`), no React, no Zustand, no DOM, Vitest-gated at 75 % coverage (inherits `vsizer` ADR-0005). The Zustand store holds **inputs only** — a `Map<snapshotId, Snapshot>` of immutable parsed workbooks plus three small slices for active-estate selection, DR scenario, and stretched flags — and a single `useEstateView()` hook drives the entire aggregation pipeline through `useMemo`, returning the same `EstateView` shape that both the dashboard UI and the two export engines consume. This deliberate departure from `vsizer` (which caches `aggregates` on the store) is justified by vatlas's mutating DR sim and asOf-dependent EOS — caching in the store there is mistakes-waiting-to-happen.

Heavy work (SheetJS parse, PPTX build, HTML report serialization) runs in Web Workers from day one — retrofitting Worker boundaries later is painful, and a 30 MB workbook on the main thread freezes the UI for seconds. Big tables and the inventory tree are virtualised with `@tanstack/react-virtual` (the headless successor to `react-window`); trends are lazy-built only when the Trends tab is open; non-default snapshots are background-parsed so the dashboard becomes interactive while trends warm up.

**Major components (see `ARCHITECTURE.md` §3 for the full per-file catalogue):**

1. **`engines/parser/`** — RVTools workbook → canonical typed rows. SheetJS + column-alias resolver + Zod schemas. Ported from `vsizer` with the OS column added and the Live Optics adapter dropped.
2. **`engines/snapshotMerge/`** — N parsed snapshots → unified estate rows. Generalises `vsizer`'s `resolveClusterCollisions` to be keyed by `vCenterLabel` (resolved from `VI SDK UUID`).
3. **`engines/aggregation/`** — Estate rows → cluster aggregates + global summary, stretched-cluster-aware. Direct port of `vsizer` math + new `perDatastore.ts` (NAA-keyed) + new `perEsx.ts`.
4. **`engines/eos/`** — VM OS strings + ESX builds → at-risk count at +3/+6/+9/+12 months. Bundled catalogue (JSON) + OS-string normalizer (regex bank with "unknown OS" surfaced as a real bucket).
5. **`engines/drSim/`** — Estate + failed-component set + stretched flags → survivor capacity, evacuee totals, factual verdict with `confidence` + `caveats` arrays.
6. **`engines/trends/`** — Per-snapshot aggregates → `TimelinePoint[]` sorted by temporal `capturedAt` (not categorical), plus `deltaMetrics` and `seriesForChart`.
7. **`engines/export/html/`** — `EstateView` → single self-contained `.html` string via `renderToStaticMarkup` + hand-rolled ~5 KB stylesheet + inlined SVG charts from ECharts + base64-embedded subset fonts. Runs in a Worker for large estates.
8. **`engines/export/pptx/`** — `EstateView` → PPTX deck via pptxgenjs. Ports `vsizer` slides + adds EOS / DR / Trends / Inventory siblings.
9. **`engines/units/`** — Branded `GHz` / `MiB` / `GiB` TS types and conversion functions. Makes "MB is MiB" and "MHz vs GHz" bugs unrepresentable.
10. **`store/`** — Zustand slices: `snapshots` (immutable, append-only), `estate` (`Set<snapshotId>`), `scenario` (DR), `stretched`, `ui`. Memory-only; no persistence of dataset rows.
11. **`hooks/useEstateView`** — Single bridge from store to engines, `useMemo`-driven, one source of truth for the view-model that drives UI and exports.
12. **Privacy guard layer** — runtime wrapper in `src/main.tsx` that intercepts `fetch`/`XHR`/`sendBeacon`/`WebSocket` and throws on non-same-origin; CSP meta tag with `connect-src 'self'`; CI denylist on telemetry packages.

### Tension Reconciled: Charting Library — ECharts wins, visx is runner-up

`STACK.md` and `FEATURES.md` recommend **Apache ECharts** while `ARCHITECTURE.md` initially preferred **visx** because SVG strings are easy to extract for the HTML export. After weighing them: **ECharts is the right choice**, for two reasons that `ARCHITECTURE.md`'s visx preference did not fully account for.

First, **chart-type coverage**. Of vatlas's six chart families, ECharts ships five (treemap, sunburst, heatmap, calendar-heatmap, gauge) as first-class native series with rich label APIs, drill-down, emphasis modes, and well-tested rendering at the scales vatlas needs. With visx, four of those five would have to be hand-built from D3 primitives — that is multi-week work per chart family and changes vatlas's posture from "analytics product that uses charts" to "charting product that does analytics on the side". `FEATURES.md` lands at the same recommendation for the same reason.

Second, **the HTML-export concern dissolves**. The architectural worry behind visx was "we need static SVG strings for the report". ECharts addresses this natively in two ways: instantiated with `{ renderer: 'svg' }` (which we mandate project-wide), every live chart in the DOM is already an `<svg>` element that serializes verbatim; and ECharts ships `chart.renderToSVGString()` as an explicit SSR/export API, so the report builder can produce an SVG string from an ECharts option object without any live chart instance at all. Both paths are documented in the ECharts handbook and confirmed in 2026.

**visx remains the right call only if** the team later decides to build a bespoke design language for charts pixel-by-pixel, or if a hard contractual WCAG 2.1 AA requirement appears (in which case Nivo is the better runner-up than visx anyway). Neither applies to v1.

**Implementation rules** (binding for every chart in vatlas):
- Always tree-shake: `import * as echarts from 'echarts/core'` + per-feature imports + `echarts.use([...])`. Target landing zone is 150–300 KB gz. The full `import * as echarts from 'echarts'` is forbidden.
- Always `{ renderer: 'svg' }` for charts that go into the HTML report. Canvas is permitted **only** as a per-chart escape hatch for in-app dense overview charts (>10k points) that do not need to appear in the report.
- A thin `<Chart>` wrapper around `<ReactECharts>` injects the SVG renderer + project-wide Midnight Executive theme tokens; components never instantiate ECharts directly.
- Chart data is memoised at the selector hook; `<Chart>` is wrapped in `React.memo` with a custom comparator (deep on data, shallow on the rest) — this is the documented mitigation for the chart re-render storm pitfall (`Moderate-9`).

### Critical Pitfalls

The top risks from `PITFALLS.md`, in priority order:

1. **"MB" in RVTools is MiB (no conversion).** Naive `* 1.048576` inflates every storage and memory total by 4.9 %. Inherit `store-predict` ADR-017 verbatim as `docs/adr/0010-rvtools-mb-as-mib.md` on day one. Name every storage/memory field `*_mib` / `*_gib` and use branded TS types so unconverted values cannot be rendered. Add a `fixtures/rvtools-mib-canary.xlsx` test that fails immediately if a contributor reintroduces the factor. Owner: Parser.
2. **Privacy invariant leak via dependency telemetry.** A single Sentry / PostHog / Datadog / LogRocket SDK silently exfiltrates parsed VM names, IPs, hostnames, error payloads. Reputation-killer. Install a runtime `fetch` / `XHR` / `WebSocket` / `sendBeacon` wrapper in `src/main.tsx` that **throws** on non-same-origin (silent block is hard to detect); add CSP meta `connect-src 'self'`; CI denylist (`@sentry/*`, `posthog-*`, `@amplitude/*`, `mixpanel*`, `@datadog/*`, `logrocket*`); Biome `noConsole` as error in non-test files; no source-map upload step; no service worker. Owner: cross-cutting, must land in Phase 1.
3. **Stretched-cluster 50 % reservation is conditional, not universal.** Correct for symmetric (4+4, 8+8) clusters; wrong for asymmetric (6+4) and single-site-failover. Compute reservation per-site (`max(siteA, siteB) / total`), surface a `confidence` field per cluster (`high` / `medium` / `low`), display a warning chip in the UI for `low`. Test matrix: 4+4, 6+4, 8+0, 2+2. Owner: Aggregation (math) + DR-sim (UI surfacing).
4. **Multi-vCenter aggregation merges identities incorrectly.** Cluster names are not globally unique; VM `Object ID` is per-vCenter. Always key clusters on `(vcenter_uuid, cluster_moref)` and VMs on `vm_bios_uuid` (BIOS UUID dedupes vMotion across vCenters); secondary key `vm_instance_uuid` for cloning. Datastores on `(vcenter_uuid, datastore_naa)`. Test fixtures: two workbooks with colliding cluster names + one vMotion'd VM. Owner: Aggregation (dedicated `multiWorkbook.ts` with its own ADR).
5. **SheetJS parses on the main thread on 10k+ VM workbooks.** A 30–80 MB workbook blocks the tab for 10–30 seconds; the heap balloons to 600 MB; Chromebooks OOM. Parse in a Web Worker from day one; `XLSX.read(buf, { dense: true })`; drop raw cells eagerly (post canonical rows back, never the `WorkBook` object); release older raw rows when N > 4 snapshots are loaded for trends. Owner: Performance (Phase 1, alongside parser).
6. **Powered-off VMs in capacity math.** Naive total inflates consolidation ratio; excluding them under-counts storage. Surface **three accounting modes** in the engine output (`Configured` / `Active` / `Storage-realistic`); UI defaults to Active for CPU/RAM dashboards and Configured for storage with a visible toggle. Add a "stale VMs" widget (powered off > 180 days). Owner: Aggregation, surfaced in Inventory + Allocation UI.

The PPTX `autoFit`/`shrinkText` quirks, the U+202F French-locale separator, the RVTools column drift across versions, the OS-naming-variant trap, the HTML-export font/CSP issues, the chart re-render storms, the DR-sim trust caveats, and the datastore double-count are all `Moderate` and have concrete preventions documented in `PITFALLS.md`.

## Implications for Roadmap

The research surfaces a clear dependency graph but **two competing groupings**: `ARCHITECTURE.md` lays out 10 fine-grained phases by engine module, while `FEATURES.md` clusters delivery into 3–4 outcome-oriented phases. We surface the natural feature clusters and dependency constraints here and let the roadmapper decide the final phase count given the configured granularity (target: 5–8 phases × 3–5 plans each).

### Natural feature clusters (the roadmapper decides how to group)

**Cluster A — Foundation & invariants (must come first).**
- Bootstrap (Vite 8 + React 19 + TS strict + Tailwind v4 + Biome + Vitest + i18next scaffold).
- Privacy guard layer: runtime `fetch`/`XHR`/`WS`/`Beacon` wrapper, CSP meta tag, CI denylist, no service worker.
- Branded units module (`GHz`, `MiB`, `GiB`) + `BYTES_PER_MIB` constant.
- ADR-0010 (MB-is-MiB) inherited; ADR for multi-vCenter keys (`vcenter_uuid`, `vm_bios_uuid`).
- Parser in Web Worker on day one: `parseXlsx` + RVTools adapter + Zod schemas (ported from `vsizer`, extended for OS column / vDatastore / vPartition), `dense: true`, drop raw cells eagerly. Header-based alias dictionary for column drift across RVTools 3.10/3.11/4.0/4.4. Trim + null-preprocess on every Zod schema. RVTools-MiB canary fixture.
- Snapshot ingestion store (Zustand, immutable, append-only).
- *Pitfalls addressed:* Critical-1, Critical-2, Critical-5, Moderate-1, Minor-1/3/5.

**Cluster B — Single-snapshot aggregation + dashboard.**
- `engines/aggregation/` ported from `vsizer` (perCluster, vinfoMerge, aggregateClusters, globals, contention) + new `perDatastore` (NAA-keyed) + new `perEsx`.
- Three accounting modes (Configured / Active / Storage-realistic).
- Physical-core-basis consolidation ratio (not threads).
- Global dashboard UI, one column per cluster, OS family breakdown.
- `useEstateView` hook (single bridge from store to engines).
- ECharts integration with tree-shaking, SVG renderer, `<Chart>` wrapper, theme tokens.
- *Pitfalls addressed:* Critical-6, Moderate-4, Moderate-5, Moderate-11, Moderate-9.

**Cluster C — Inventory navigation.**
- `@tanstack/react-table` + `@tanstack/react-virtual` for the cluster → ESX → VM tree.
- Sortable / filterable tables per object class (VM, ESX, Datastore).
- Datastore view with thin-provisioning flags.
- CSV export of the current filter (ported from `vsizer`).
- Column show/hide menu, sticky header + first column, filter chips.
- *Pitfalls addressed:* part of Critical-5 (memory budget on large estates), Minor-2 (multi-line cells).

**Cluster D — Multi-vCenter + scenarios (the analytics core).**
- `engines/snapshotMerge/` with `(vcenter_uuid, cluster_moref)` and `vm_bios_uuid` keys. Detect colliding cluster names; never silent merge.
- Stretched-cluster pill (port `vsizer` ADR-0007) with per-site reservation math and the `confidence` field.
- Allocation-ratio sliders (CPU 4:1 / RAM 1:1 defaults, URL-hash-encoded only).
- DR sim in three modes (host loss, cluster loss, vCenter loss) with assumptions panel + `caveats` array. Stretched-cluster split-brain bonus mode.
- *Pitfalls addressed:* Critical-3, Critical-4, Moderate-10.

**Cluster E — EOS forecasting.**
- `scripts/sync-eos-catalogue.ts` (build-time fetch from `endoflife.date`, Zod-validated, bundled JSON with `lastVerified`).
- OS-string normalizer (regex bank, family/major/minor) with "unknown OS" as a real bucket.
- Lifecycle phase bucketing including the **"overdue"** bucket (RHEL 7, Win 2012 R2 are past EOS).
- EOS forecast UI at 3/6/9/12-month horizons + one-click drill from a bucket to the affected VM list.
- ESX build → support state classifier.
- *Pitfalls addressed:* Moderate-6, Minor-4.

**Cluster F — Multi-snapshot trends.**
- `engines/trends/` (`buildTimeline`, `deltaMetrics`, `seriesForChart`).
- Background-parse non-default snapshots; lazy-aggregate trends.
- Temporal (not categorical) X-axis; show actual capture dates on hover; show RVTools version per snapshot.
- Line charts of headline metrics; per-cluster sparklines on the dashboard; (P2) cluster × time heatmap; (P2) side-by-side snapshot diff.
- Snapshot retention policy: when N > 4 snapshots are loaded, release older raw rows; keep only aggregated time-series.
- *Pitfalls addressed:* Minor-6, part of Critical-5 (memory budget).

**Cluster G — Export pipeline (HTML + PPTX).**
- `engines/export/html/` — `renderToStaticMarkup` of a hookless React report tree + hand-rolled ~5 KB stylesheet + inlined SVG via `chart.renderToSVGString()` + base64-subset fonts (Inter Latin Extended A). CSP meta in the exported HTML. Anchor-id namespacing per snapshot. Runs in a Worker.
- `engines/export/pptx/` — ported from `vsizer`, extended with EOS / DR / Trends / Inventory slides. `pptxText` wrapper for text-overflow + control-char stripping. `pptxSafeFormat` for U+202F → U+00A0. Golden-PPTX snapshot test.
- Both run in `engines/export/index.worker.ts`.
- Data-freshness display in header + every export footer; methodology footer with the locked-in CPU/RAM ratios and stretched reservation.
- *Pitfalls addressed:* Moderate-2, Moderate-7, Moderate-8.

**Cluster H — Polish & deploy.**
- i18n FR + EN with the new namespaces (`inventory`, `eos`, `dr`, `trends`, `report`). CI key-diff gate (FR↔EN must match). All numbers via locale-aware formatter; no pre-formatted numbers in translation strings.
- Light/dark theme, drag-and-drop multi-file UX, drop-zone validation (D11), explicit data-freshness display (D10).
- `vatlas-lang` allowed in `localStorage` (locale code only; not dataset content).
- GitHub Pages CI (typecheck → lint → test → build → deploy), `base: '/vatlas/'`.
- *Pitfalls addressed:* Moderate-2, Minor-7.

### Phase ordering rationale (the hard constraints)

These dependency edges are non-negotiable; the roadmapper must respect them when collapsing clusters into phases:

- **Foundation (A) must come first** because every other cluster depends on the parser + units module + privacy guard, and retrofitting the Web Worker boundary or the runtime `fetch` guard later is painful.
- **Aggregation (B) must precede Inventory (C), Scenarios (D), EOS (E), and Trends (F)** — they all consume aggregation outputs.
- **Stretched pill must land before DR sim** (DR sim subtracts the stretched reservation before computing survivor capacity).
- **Multi-vCenter merge must land before trends** — without stable `(vcenter_uuid, vm_bios_uuid)` keys, "is this the same VM across two snapshots?" is unanswerable.
- **EOS (E) is independent of Multi-vCenter/DR** — pure VM-row classification. Can land in parallel with cluster D or in any order.
- **HTML and PPTX exports (G) must come last** because both consume every view-model from clusters B/D/E/F. PPTX is structurally simpler (vsizer engine exists); HTML is the synthesis surface.
- **Polish (H) is mostly woven throughout** (i18n keys added as each UI string is written, not retrofitted), but the deploy + final i18n audit lands at the end.

### Research flags (which phases will need `/gsd-research-phase` during planning)

**Likely needs deeper research:**

- **Multi-vCenter + DR sim (Cluster D).** RVTools schema edge cases (asymmetric stretched clusters with missing site/fault-domain metadata, HA admission control config exposure in `vCluster`, anti-affinity rule exposure in `vRP`/`dvSwitch`) need fixture-driven validation; the DR-sim assumption set is the single biggest correctness risk in v1.
- **EOS catalogue + OS normalizer (Cluster E).** The OS-naming-variant matrix is wide (RHEL 8 shows up as four different strings; Oracle Linux as three); we need to harvest 50+ real OS strings from existing exports and prove the normalizer covers them. The catalogue source (`endoflife.date` v1 API) is in Beta — we mitigate by bundling at build time, but the schema validation needs careful Zod.
- **HTML report export (Cluster G).** Live-DOM serialization with embedded subset fonts + inline SVG + CSP in the exported file has edge cases (corporate-VPN CSP proxies blocking `data:` URIs, font fallback in `file://` contexts, 5–15 MB size budgets at large estates). Plan to prototype with real fixtures before committing the final shape.

**Standard patterns, can skip dedicated research (proceed with `STACK.md` + `ARCHITECTURE.md` recipes):**

- **Foundation (A).** Direct port of `vsizer` setup with version bumps and two new deps. Every choice is documented.
- **Aggregation (B).** Direct port of `vsizer` math; new `perDatastore`/`perEsx` are mechanical extensions.
- **Inventory navigation (C).** `@tanstack/react-virtual` + `@tanstack/react-table` are well-documented, vsizer ergonomics carry over.
- **Trends (F).** Pure functions over an already-validated aggregation pipeline; the design is documented in `ARCHITECTURE.md` §3.
- **PPTX export half of (G).** Direct port of `vsizer` with new slide siblings appended.
- **Polish & deploy (H).** Direct port of `vsizer` CI + i18n scaffolding.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every dependency verified against current upstream releases as of 2026-05-15. The two new choices (ECharts + live-DOM HTML export) are documented with explicit alternatives-considered tables and have working precedents (ECharts is a top-3 charting library; `renderToStaticMarkup` is React's documented API). Charting bundle size landing zone is MEDIUM until first build. |
| Features | MEDIUM-HIGH | RVTools schema, EOS catalogue source/format, multi-vCenter merge keys, DR methodology, and viz patterns are all backed by HIGH-confidence public sources (Broadcom techdocs, RVTools release notes, endoflife.date repo, vCAT, multiple community blogs). The precise paid feature matrix of the closed-source reference tool (RVTools Analyser) is partially LOW confidence — vendor docs are behind login/paywall — but vatlas doesn't need to clone it 1:1 so this is not blocking. |
| Architecture | HIGH | Direct extrapolation from `vsizer`'s shipped, tested architecture + explicit vatlas scope deltas in `PROJECT.md`. Performance numbers (parse time, estate-size envelope) are order-of-magnitude estimates from typical RVTools exports + `vsizer` benchmark data — MEDIUM confidence, will verify with real fixtures in the parser phase. |
| Pitfalls | HIGH | Drawn from `vsizer`'s shipped lessons + `store-predict` ADR-017 (inheritable) + explicit RVTools / VMware / pptxgenjs / Intl.NumberFormat public sources. Every Critical pitfall has a concrete prevention artifact (schema rule, test fixture, CI gate, ADR). |

**Overall confidence:** HIGH for the stack and architecture (sibling-derived), MEDIUM-HIGH for the feature surface (some reference-tool-feature inference), HIGH for the pitfall inventory.

### Gaps to Address

- **Real-fixture validation of the parser + units math.** The MB-is-MiB ADR, the canary fixture, and the column-alias dictionary all need real RVTools exports from disk (`~/Downloads/`, `~/Library/CloudStorage/OneDrive-Home/`, `vsizer/public/samples/rvtools-sample.xlsx`) to lock in. **Resolve:** First parser plan must include "harvest 4+ real workbooks (one per RVTools generation), build fixtures, verify totals against RVTools UI hand-spots".
- **Asymmetric stretched-cluster site detection.** Whether RVTools `vCluster` exposes host fault-domain or site tag in current versions is unverified. **Resolve:** Aggregation/DR-sim plan must include a fixture-driven check; if not exposed, the engine surfaces `confidence: 'medium'` per cluster with an "assumed symmetric" warning chip in the UI.
- **ECharts bundle-size landing zone.** Documented range is 150–300 KB gz with tree-shaking + SVG renderer; we will know the exact figure only after the first build. **Resolve:** First chart-integration plan must include a bundle-size CI gate (`vite build` size budget check); fall back to Canvas per-chart for any in-app overview that doesn't need to be in the HTML report if budgets are tight.
- **HTML-report font-embedding mechanism.** Exact `getReportFonts(): Promise<Record<family, base64>>` shape is undecided; subset selection (Latin Extended A is probably enough for FR+EN) needs validation. **Resolve:** First HTML-export plan must prototype with a real fixture and measure across `file://`, `python3 -m http.server`, and a corporate-CSP-proxy simulation.
- **DR sim assumptions disclosure.** The exact wording and UI surface of the "what the sim modeled and didn't" panel is a UX decision; must be locked in before the DR slide ships in PPTX. **Resolve:** DR-sim plan must include an ADR specifying the assumptions copy and the `caveats` field schema.
- **OS-naming-variant matrix coverage.** A 50-string fixture is the right validation surface for the OS normalizer. **Resolve:** EOS plan must include "harvest real OS strings from existing workbooks; assert <5% unknown-OS rate on a real estate".
- **EOS catalogue v1 API stability.** `endoflife.date` v1 is in Beta; breaking changes possible. **Resolve:** `scripts/sync-eos-catalogue.ts` must Zod-validate the fetched shape and fail the build on a schema mismatch (signals a needed update to the normalizer).

---
*Research completed: 2026-05-15*
*Ready for roadmap: yes*
