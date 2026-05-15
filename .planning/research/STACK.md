# Stack Research

**Domain:** 100 % client-side analytics web app (VMware estate atlas) — RVTools `.xlsx` ingestion → interactive visual UI → self-contained HTML report + PPTX deck.
**Researched:** 2026-05-15
**Confidence:** HIGH overall. Two new decisions for vatlas (charting library + HTML export approach) are MEDIUM-to-HIGH and explained below. Every other choice is inherited from the sibling project `vsizer`, verified against current upstream releases, and confirmed safe to copy.

---

## Executive summary (read this first)

vatlas should adopt **vsizer's exact stack at current versions**, plus two additions that vsizer does not need:

1. **Charting library = Apache ECharts via `echarts-for-react`**, used with tree-shaken imports and the **SVG renderer**. Single decisive reason: vatlas needs treemap, sunburst, heatmap, calendar-heatmap, and gauge — ECharts ships all five natively, Recharts ships none of them well. The SVG renderer choice (vs Canvas) is what makes the HTML report export trivial.
2. **HTML report export = live-DOM serialization to a single `Blob`**, inlining CSS as `<style>`, fonts as base64 `@font-face`, and charts as already-rendered inline `<svg>`. No new heavy dependency. The downstream output is a single `.html` file that opens in any browser, offline, with zero JS execution required to view it. This is **not** `vite-plugin-singlefile` (that plugin is for shipping the *app* as one HTML file, a different problem) — see "What NOT to Use" below.

Everything else is "match vsizer", with versions pinned to current upstream as of 2026-05-15.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | `^19.2.6` | UI runtime | vsizer is on 19.2.6; current stable line; vatlas is client-only with **no React Server Components**, so the 2025-12/2026-01 RSC CVE chain (CVE-2025-55182, CVE-2026-23870, etc.) does **not** apply. Still pin `>=19.2.4` for hygiene. |
| react-dom | `^19.2.6` | DOM bindings | Lockstep with React. |
| TypeScript | `~5.9.3` | Strict typing | vsizer's `tsconfig.app.json` enables `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `erasableSyntaxOnly`. Copy verbatim; do not regress to looser settings. |
| Vite | `^8.0.12` | Dev server + production bundler | Vite 8 went GA 2026-03-12 with **Rolldown** as the unified Rust-based bundler (10–30× faster builds, full Rollup plugin API compatibility). vsizer is already on 8.0.12. |
| `@vitejs/plugin-react` | `^6.0.1` | React JSX/Fast Refresh | Required peer for Vite 8 + React 19. |
| Tailwind CSS | `^4.3.0` | Styling | v4 is stable since 2025-01; latest minor is 4.3.0 (npm, last week of April 2026). CSS-first config, 5× full-build / 100× incremental speedup. |
| `@tailwindcss/vite` | `^4.3.0` | Tailwind Vite integration | First-party plugin; use this instead of PostCSS. Drops the `tailwind.config.js` dependency entirely (v4 uses `@theme` blocks in CSS). |
| Zustand | `^5.0.13` | Client state | v5 is stable; v5.0.13 published ~9 days ago. **Use named imports** (`import { create } from 'zustand'`), not the deprecated default export. Memory-only — never persist `vinfo`/`vhost` rows (privacy invariant from vsizer ADR-0001/0004). |
| Zod | `^4.4.3` | Runtime schema validation at the parser boundary | v4 is stable (GA Aug 2025), with 14× faster string parsing, 7× faster array parsing, 2.3× smaller core bundle, ~10× faster TS compilation than v3. vsizer is already on `^4.4.3`. **Do not** mix v3 patterns — the error customization API changed (`message` → `error`, `.default()` semantics changed). |
| SheetJS (xlsx) | `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` | RVTools `.xlsx` parsing | The **only** correct install channel. See "What NOT to Use" — the npm `xlsx` package is stuck at 0.18.5 and carries CVE-2024-22363 (ReDoS). 0.20.3 is the current CDN release; no 0.20.4 has shipped as of 2026-05-15 and there are no open CVEs against 0.20.3. |
| Apache ECharts | `^5.6.0` | Charting engine (treemap, sunburst, heatmap, calendar, gauge, bar, line, pie, area, radial) | See "Charting decision" section below. Tree-shake via `echarts/core` + per-chart-type imports + `SVGRenderer` to land at ~150–300 KB gzipped. |
| `echarts-for-react` | `^3.0.2` | Thin React wrapper around ECharts | The de-facto React binding; supports `opts={{ renderer: 'svg' }}` for the SVG renderer which is the keystone of the HTML report export plan. |
| pptxgenjs | `^4.0.1` | PPTX export | Still the only credible browser-side PPTX generator in 2026. 4.0.1 was the only 4.x release and remains the current version; mature, no known CVEs. vsizer's PPTX engine in `engines/export/pptx/` is reusable. |
| react-i18next | `^16.6.6` | i18n (FR + EN) | vsizer's setup translates 1:1. |
| i18next | `^26.1.0` | i18n core | Lockstep with react-i18next. |
| i18next-browser-languagedetector | `^8.2.1` | Locale detection | Same chain (`?lang=` → localStorage → navigator → `fr` fallback). Note: a `vatlas-lang` localStorage key is allowed (it stores a locale code, not dataset rows — does not breach the privacy invariant). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-error-boundary | `^6.1.1` | Crash isolation | Wrap `<App />` so a bad workbook does not white-screen. Same pattern as vsizer's `App.tsx`. |
| sonner | `^2.0.7` | Toast notifications | "Workbook loaded", "Export ready", "Parse error". One `<Toaster />` mounted at the root. |
| fflate | `^0.8.2` | Optional: client-side zip handling | vsizer carries this for Live Optics `.zip` bundles. **vatlas does not need it in v1** (RVTools-only, no zip bundles). Add only if a future format pivot pulls it back. |
| ECharts add-ons (`@kurkle/color`, `geo` JSON) | not needed | — | The chart types vatlas needs (treemap, sunburst, heatmap, calendar, gauge, bar/line/pie/area, radial) are all in the core `echarts` package. No map/3D add-ons required. |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Biome | `^2.4.15` | Lint + format | Single quotes (JS), double quotes (CSS), no semicolons, 2-space, 100-char, auto-organize imports. Copy `biome.json` from vsizer. |
| Vitest | `^4.1.2` | Unit + integration tests | v4 graduated Browser Mode to stable (Oct 2025), added `toMatchScreenshot()`, Playwright Trace integration, schema-matching API. vsizer is on 4.1.2. For vatlas, plan to use **Browser Mode** for any ECharts test that needs real rendering (jsdom does not produce real SVG geometry). |
| `@vitest/coverage-v8` | `^4.1.2` | Coverage provider | Gate `engines/` + `utils/` at 75 % (vsizer ADR-0005). Add `engines/export/html/` to the gated paths once the report builder lands. |
| `@testing-library/react` | `^16.3.2` | Component tests | Standard. |
| `@testing-library/jest-dom` | `^6.9.1` | DOM matchers | Standard. |
| `@testing-library/user-event` | `^14.6.1` | Realistic user events | Standard. |
| jsdom | `^29.1.1` | Default test environment | Default for non-rendering tests; switch to Vitest Browser Mode for chart-render tests. |
| `@types/react` / `@types/react-dom` | `^19.2.14` / `^19.2.3` | Type defs | Lockstep with runtime. |
| `@types/node` | `^25.7.0` | Vite/Node types | For `vite.config.ts`. |

### Charting decision (the key new choice for vatlas)

vatlas's chart needs, from `PROJECT.md` + the milestone brief, are:

| Chart type | Used for | Recharts | Visx | Nivo | Plotly | **ECharts** |
|---|---|---|---|---|---|---|
| Bar / Line / Pie / Area | trends, breakdowns | yes | yes (low-level) | yes | yes | **yes** |
| Treemap (storage by cluster/datastore) | storage allocation | partial — basic Treemap, no drill-in, no rich labels | yes (build from primitives) | yes | yes | **yes — first-class, drill-down, rich label API** |
| Sunburst | nested cluster → host → VM breakdown | **no** | yes (build from primitives) | yes | yes | **yes — first-class, with `emphasis: 'ancestor'/'descendant'` (2026 feature)** |
| Heatmap | DR / contention matrices | **no** (only community workarounds) | yes (build from primitives) | yes | yes | **yes — `series: heatmap`** |
| Calendar heatmap | EOS forecasting timeline (3/6/9/12-month at-risk) | **no** | yes (build from primitives) | yes | yes | **yes — `calendar` coordinate system + heatmap, `dayLabel`/`monthLabel` config** |
| Gauge / radial | allocation ratios, vCPU:pCPU | community-only / hand-rolled | yes (build from primitives) | yes (radial bar) | yes | **yes — `series: gauge`, multiple styles** |
| Bundle size (typical project) | — | ~110 KB gz | grows with how many primitives you use | ~80 KB gz per chart family imported | ~3 MB (heavy) | ~150–300 KB gz with tree-shaking + SVG renderer |
| Server/static SVG output | needed for HTML report | not designed for it | possible | possible | only with Plotly's server bundle | **first-class — `renderer: 'svg'` + `renderToSVGString`** |

**Recommendation: Apache ECharts via `echarts-for-react`, with tree-shaking + SVG renderer.**

Why ECharts wins, in order:

1. **It covers every chart type vatlas needs natively.** Recharts is the obvious React-idiomatic choice — and it is what shadcn/ui charts wrap — but it fails on four of vatlas's six chart families. Hand-rolling sunburst, heatmap, calendar-heatmap, and gauge on top of Recharts is a multi-week project that ECharts solves in zero lines of code.
2. **Visx (Airbnb's `@visx/*` primitives) would also cover everything**, but it's a "build your own charts from D3 primitives" toolkit. That's the wrong cost curve for vatlas — vatlas is shipping a finished atlas, not a charting framework.
3. **Nivo is the credible runner-up** (Calendar, HeatMap, TreeMap, Sunburst, Radial all present, plus WCAG 2.1 AA out of the box). The reason to prefer ECharts anyway: ECharts has a cleaner story for the **HTML report export** — its `SVGRenderer` produces clean inline SVG in the DOM that serializes verbatim, and the `renderToSVGString()` API exists as an explicit escape hatch. Nivo also produces SVG, but ECharts' option-object API survives serialization (the chart spec can be embedded as JSON inside the report and re-instantiated later). Pick Nivo only if WCAG 2.1 AA on charts is a hard contractual requirement — vatlas's brief does not state it is.
4. **Plotly** is correct for science / 3D / map-heavy dashboards. It is too heavy (~3 MB) for a single-file shareable HTML report and overshoots vatlas's needs.

**Implementation notes for ECharts:**

- Always use the tree-shaking import path (`echarts/core`), never `import * as echarts from 'echarts'`. Register only the charts and components you use.
- Pick the **SVG renderer**, not Canvas. Canvas is faster for >10k points; vatlas's per-cluster cardinality is in the hundreds-to-low-thousands, well within SVG's comfort zone. SVG is what makes the HTML report export trivial and what keeps charts crisp in the exported PPTX (pptxgenjs can embed SVG paths or rasterize cleanly).
- Wrap `<ReactECharts>` in a thin `<Chart>` component that injects the SVG renderer and a project-wide theme so every chart inherits the Midnight Executive palette tokens defined in CSS.

Confidence: **HIGH** on "use ECharts". MEDIUM on the exact bundle-size landing zone (150–300 KB gz is the documented range; we will know more after the first build).

### HTML report export decision (the second key new choice)

The constraint: **the report is generated by the live browser app from in-memory data, not at build time, not on a server**. It must be a single `.html` file the user can email, drop on a USB stick, or open offline.

**Recommendation: Live-DOM serialization to a single `Blob`.**

Concretely, an `engines/export/html/` module that:

1. Builds a static report React tree (no event handlers, no Suspense, no client-only hooks) describing the estate snapshot.
2. Renders it server-style **inside the browser** with `renderToStaticMarkup` from `react-dom/server` — this is supported in the browser bundle and produces clean, attribute-only HTML with no React runtime.
3. For each chart, asks the ECharts instance (kept in a `Map<chartId, EChartsType>`) for its current SVG via `chart.renderToSVGString()` (works because the live charts use the SVG renderer) and inlines that SVG string at the matching slot. Falls back to `getDataURL({ type: 'svg' })` if the instance is not available.
4. Inlines **all CSS** by reading the project's compiled CSS bundle (imported as a string via Vite's `?inline` or `?raw` query suffix) into a single `<style>` block.
5. Inlines **fonts** as base64 `@font-face` rules — ship one variable font (e.g. Inter Variable) loaded via a Vite `?url` import, fetched once on demand from `same-origin` and converted to base64 inside the report builder. No external font request from the exported file.
6. Wraps everything in a minimal `<!doctype html>` + `<meta charset=utf-8>` + a short inline boot script (or **none at all** — fully static is the goal) and produces a `Blob({ type: 'text/html' })`, then `URL.createObjectURL` + anchor click + `revokeObjectURL`.

Why this approach and not the alternatives:

| Approach | Verdict | Reason |
|---|---|---|
| **Live-DOM serialization (recommended)** | YES | Zero new runtime deps. Reuses the same ECharts SVG already rendered on screen. Resulting file is statically viewable in any browser — even Safari with JS disabled. Pure function in `engines/`, easy to coverage-gate. |
| `vite-plugin-singlefile` | NO — wrong problem | This bundles the **vatlas app itself** into a single HTML for distribution (think: download the app as one file). It does **not** help produce a per-snapshot report file from inside a running app. Don't conflate the two. |
| `@react-pdf/renderer` | NO | It produces PDF, not HTML. vatlas wants HTML (interactive-ish, copyable text, no font embedding hassles). PDF is a different deliverable and is not in scope. |
| Headless rendering via `puppeteer` / Playwright | NO | Requires a server / Node process; violates the 100 % client-side invariant. |
| `single-file` browser extension (gildas-lormeau/SingleFile) | NO | Asks the user to install a browser extension. Not acceptable for "drop file, get report" UX. Internally it does what we already plan — serialize the live DOM with inlined resources — but as an extension. We do this in-app instead. |
| Custom HTML string assembly (template literals) | NO — but partial yes | Hand-concatenating HTML strings for the report shell is fine for a one-off; for the volume of structure in vatlas (KPI tiles, tables, multiple chart sections per page, multiple pages) `renderToStaticMarkup` of a real React tree is dramatically less error-prone and gives us free typed components. |

Confidence: **HIGH** on the overall approach. MEDIUM on the specific font-embedding mechanism (will likely need a `getReportFonts()` helper that resolves a `Promise<Record<family, base64>>` at export time; details to be refined in the first phase of execution).

---

## Installation

```bash
# 1) Core runtime deps
npm install \
  react@^19.2.6 \
  react-dom@^19.2.6 \
  zustand@^5.0.13 \
  zod@^4.4.3 \
  pptxgenjs@^4.0.1 \
  react-error-boundary@^6.1.1 \
  sonner@^2.0.7 \
  i18next@^26.1.0 \
  react-i18next@^16.6.6 \
  i18next-browser-languagedetector@^8.2.1 \
  echarts@^5.6.0 \
  echarts-for-react@^3.0.2

# 2) SheetJS — REQUIRED via the official tarball, NOT npm
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

# 3) Dev deps (build / lint / test)
npm install -D \
  vite@^8.0.12 \
  @vitejs/plugin-react@^6.0.1 \
  tailwindcss@^4.3.0 \
  @tailwindcss/vite@^4.3.0 \
  typescript@~5.9.3 \
  @types/react@^19.2.14 \
  @types/react-dom@^19.2.3 \
  @types/node@^25.7.0 \
  @biomejs/biome@^2.4.15 \
  vitest@^4.1.2 \
  @vitest/coverage-v8@^4.1.2 \
  @testing-library/react@^16.3.2 \
  @testing-library/jest-dom@^6.9.1 \
  @testing-library/user-event@^14.6.1 \
  jsdom@^29.1.1
```

After install, verify the SheetJS pinning landed:

```bash
node -e "console.log(require('./package.json').dependencies.xlsx)"
# expected: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

If a tool (Dependabot, Renovate, `npm audit fix --force`) ever rewrites that to `^0.x.y`, **revert immediately** — that path leads to the CVE-affected npm 0.18.5 build.

---

## Alternatives Considered

| Recommended | Alternative | When the alternative would be the right call |
|---|---|---|
| Apache ECharts | **Recharts** | If vatlas dropped treemap, sunburst, heatmap, calendar, and gauge from the brief and was limited to bar/line/pie/area. It is not. |
| Apache ECharts | **Nivo** | If hard-contractual WCAG 2.1 AA on chart elements is required (it is not in the brief). Nivo's ARIA labels and keyboard nav are best-in-class. |
| Apache ECharts | **Visx (`@visx/*`)** | If the team wanted to build a bespoke design language for charts pixel-by-pixel. vatlas is not a charting product, it is an analytics product that uses charts. |
| Apache ECharts | **Plotly** | If 3D, geo-maps, or scientific plots were required. vatlas needs neither. |
| Apache ECharts | **MUI X Charts** | If the rest of the UI was on MUI. It is not (Tailwind v4 + custom). MUI X Charts also has a partial Pro license tier that complicates the open-source story. |
| Live-DOM serialization | **`@react-pdf/renderer`** | If the user wanted PDF as the share format. They want HTML + PPTX. Re-evaluate if a PDF requirement appears. |
| Live-DOM serialization | **`vite-plugin-singlefile`** | If the deliverable were "ship the whole vatlas app as a single HTML you can run offline". Adjacent product, not the v1 report. Could be added later for the GitHub Pages bundle itself. |
| pptxgenjs | **officegen** | Lower maintenance, weaker API, no advantage. Skip. |
| pptxgenjs | **Aspose.Slides Cloud / SlideForge API** | If editorial AI-generated decks were the goal. They are not — vatlas's PPTX is factual, no narrative. |
| Vitest 4 | **Jest 30** | Migrating to Jest would cost weeks for no gain. Vitest is already wired in vsizer and is faster on Vite-native code. |
| Zustand 5 | **Redux Toolkit / Jotai / Valtio** | Only if vatlas grew to need time-travel debugging or graph-of-derived-state semantics. The dataset shape (vinfo, vhost, datastores, snapshots) is flat and Zustand handles it cleanly. |
| Zod 4 | **Valibot / ArkType** | Smaller bundles, but Zod 4 is now within ~10–30 % of Valibot on bundle size and is what the team already uses. Switching costs more than it saves. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| `npm install xlsx` from the npm registry | npm package is frozen at **0.18.5** and carries CVE-2023-30533 (prototype pollution) and CVE-2024-22363 (ReDoS). SheetJS deliberately stopped publishing to npm; the npm package is **not** the same code as the current CDN release. | The CDN tarball: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, pinned in `package.json`'s `dependencies` field exactly as shown. Same approach as vsizer ADR-0002. |
| `import * as echarts from 'echarts'` | Pulls the entire 1 MB ECharts bundle into vatlas. | `import * as echarts from 'echarts/core'` + per-feature imports + `echarts.use([...])`. Land at ~150–300 KB. |
| ECharts Canvas renderer for vatlas | Inline SVG in the HTML report becomes impossible from Canvas-rendered charts; you would have to rasterize to PNG and embed as data URIs, losing crispness and exploding file size. | `{ renderer: 'svg' }` on every ECharts instance. The chart counts in vatlas (low thousands of points max per chart) are well within SVG's comfort zone. |
| `vite-plugin-singlefile` for the **report** output | It builds the **app** into one HTML at build time. It is not a runtime export mechanism and cannot serialize per-snapshot in-memory state. | Live-DOM serialization at export time inside the app (see "HTML report export decision"). |
| `localStorage` / `sessionStorage` / IndexedDB / OPFS for parsed RVTools rows | Violates the privacy invariant inherited from vsizer (ADR-0001, ADR-0004). Refresh-equals-data-gone is a product promise. | Memory only — Zustand store, `ArrayBuffer` from `FileReader`, both garbage-collected on refresh. Persisting only **UI** preferences (locale, theme) is fine because they contain no dataset content. |
| Zustand `import create from 'zustand'` (default export) | Deprecated since v4; warns on console in v5. | `import { create } from 'zustand'`. For non-React stores: `import { createStore } from 'zustand/vanilla'`. |
| Zod v3 idioms in new code | v4 changed `.default()` semantics (defaults now applied when absent, not when invalid) and replaced `message`/`invalid_type_error`/`required_error` with a single `error` parameter. v3 patterns silently misbehave. | Use the v4 API directly. If migrating any vsizer schemas, run `npx @zod/codemod --transform v3-to-v4` once. |
| `localStorage` of workbook bytes for "trends" | Same privacy violation. Multi-snapshot trends ship in the active scope on purpose. | Make trends an in-session feature: user drags N monthly RVTools files in at once, vatlas holds them all in memory, trend charts render, refresh wipes everything. This matches `PROJECT.md`'s explicit Out of Scope. |
| Live Optics parsing code from vsizer | Out of scope for vatlas v1. | Cherry-pick only the RVTools side of `engines/parser/` (parseXlsx, RVTools normalizer, Zod schemas). Skip `detectSource` and the Live Optics adapter entirely. |
| PostCSS-based Tailwind config | Slower, more boilerplate, no benefit for a Vite project. | `@tailwindcss/vite` + `@theme` blocks in `src/index.css`. |
| `npm audit fix --force` | Will silently rewrite the xlsx tarball URL to the npm version and break the privacy/security model. | Investigate manually, never blindly. Keep the CI audit gate from vsizer (LOW+ severity gates from ADR-0016) but resolve issues by upgrading, not by forcing the resolver. |

---

## Stack Patterns by Variant

**If a "host the report on a static site" feature is added later:**

- Add `vite-plugin-singlefile` as a **separate optional build target** (e.g. `npm run build:portable`) to produce a single-file version of the vatlas app itself, alongside the normal GitHub Pages build. This is independent of the per-snapshot HTML report and useful only as an offline distribution form.

**If chart performance becomes a bottleneck at very large estates (>50 k VMs):**

- Switch the offending chart instances from `renderer: 'svg'` to `renderer: 'canvas'` on a per-chart basis. Keep SVG for charts that go into the HTML report; use Canvas only for in-app overview charts that don't need SVG output. ECharts supports this per-instance.

**If a PDF deliverable is added (not v1):**

- Add `@react-pdf/renderer` as a third export engine alongside HTML and PPTX. Reuse the same chart SVGs (the renderer can embed SVG into PDF).

**If accessibility certification becomes a hard requirement:**

- Re-evaluate Nivo vs ECharts for charts. ECharts has accessibility props (`aria` config on series) but Nivo's ARIA story is significantly more polished out of the box.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|---|---|---|
| `react@^19.2.6` | `react-dom@^19.2.6` | Must be in lockstep. |
| `react@19` | `@types/react@^19.2.x` | The `@types/react@18.x` line is incompatible; do not mix. |
| `vite@^8` | `@vitejs/plugin-react@^6` | Plugin-react v5 does not work with Vite 8. |
| `vite@^8` | `vitest@^4.x` | Vitest 4 is the only line that targets Vite 8 cleanly. Vitest 3 will install but produces resolution warnings. |
| `tailwindcss@^4.3` | `@tailwindcss/vite@^4.3` | Must match major+minor. |
| `echarts-for-react@^3` | `echarts@^5.x` | echarts-for-react 4 is not out; stick to 3. Peer-deps on `echarts >=5`. |
| `zod@^4` | TypeScript `>=5.5` | Older TS produces slow type-checks on v4 schemas. We are on 5.9. |
| `zustand@^5` | React `>=18` | React 19 fully supported since 5.0.x. |
| `xlsx@0.20.3` tarball | Anything | No peer deps. Just verify the resolution did not silently get rewritten by a tool. |

---

## Sources

Charting library:

- [LogRocket — Best React chart libraries 2025/2026](https://blog.logrocket.com/best-react-chart-libraries-2025/) — confirmation that Recharts lacks heatmap/sunburst/calendar and that ECharts/Plotly cover them. MEDIUM.
- [Querio — 8 Top React Chart Libraries 2026](https://querio.ai/articles/top-react-chart-libraries-data-visualization) — chart-type matrix. MEDIUM.
- [arcdev — 10 Best React Chart Libraries 2026](https://arcdev.in/10-best-react-chart-libraries-2026-fast-beautiful-powerful/) — corroborating coverage table. MEDIUM.
- [Apache ECharts Features](https://echarts.apache.org/en/feature.html) — official list of supported series including treemap, sunburst, heatmap, calendar, gauge. HIGH.
- [Apache ECharts Changelog](https://echarts.apache.org/en/changelog.html) — sunburst `emphasis: 'relative'`, treemap `cursor`, calendar `silent` 2026 features. HIGH.
- [echarts-for-react Tree-Shaking Docs](https://echartsforreact.com/docs/guides/tree-shaking/) — confirms ~150 KB / ~300 KB / ~1 MB bundle tiers. HIGH.
- [ECharts Canvas vs SVG handbook](https://apache.github.io/echarts-handbook/en/best-practices/canvas-vs-svg/) — SVG renderer characteristics. HIGH.
- [GitHub issue: echarts-for-react SSR with renderToStaticMarkup](https://github.com/hustcc/echarts-for-react/issues/202) — confirms SSR/SVG-string path used by the HTML-report design. MEDIUM.
- [Recharts issue #237 — heatmap support request](https://github.com/recharts/recharts/issues/237) — confirms Recharts has no built-in heatmap. HIGH.

HTML report export:

- [vite-plugin-singlefile npm](https://www.npmjs.com/package/vite-plugin-singlefile) — purpose & limitations (build-time, not runtime). HIGH.
- [React `renderToStaticMarkup` reference](https://react.dev/reference/react-dom/server/renderToStaticMarkup) — official API. HIGH.
- [ECharts SSR / `renderToSVGString` handbook](https://apache.github.io/echarts-handbook/en/how-to/cross-platform/server/) — SVG-string export from ECharts. HIGH.
- [Apache ECharts `getDataURL`](https://echarts.apache.org/en/api.html) — `getDataURL({type:'svg'})` fallback. HIGH.

Versions verified upstream as of 2026-05-15:

- [Vite 8 release post](https://vite.dev/blog/announcing-vite8) — Rolldown integration, GA 2026-03-12. HIGH.
- [Tailwind v4.0 announcement](https://tailwindcss.com/blog/tailwindcss-v4) and [Tailwind upgrade guide](https://tailwindcss.com/docs/upgrade-guide) — v4 architecture, Vite plugin. HIGH.
- [Tailwind v4 + Vite 8 status](https://benjamincrozat.com/tailwind-css-vite-8-support) — interop confirmed. MEDIUM.
- [Zod v4 migration guide](https://zod.dev/v4/changelog) — error API, default semantics. HIGH.
- [InfoQ — Zod v4 GA](https://www.infoq.com/news/2025/08/zod-v4-available/) — GA dating. HIGH.
- [Zustand v5 docs / discussions](https://github.com/pmndrs/zustand/discussions/1548) — default-export deprecation. HIGH.
- [Vitest 4 release notes](https://vitest.dev/blog/vitest-4-1.html) — Browser Mode stable, schema matchers. HIGH.
- [pptxgenjs npm](https://www.npmjs.com/package/pptxgenjs) — 4.0.1 current and unchanged. HIGH.
- [React 19.2 release coverage](https://dev.to/usman_awan/from-react-190-to-192-whats-new-what-improved-and-why-it-matters--1ip4) and [React Versions](https://react.dev/versions) — 19.2.6 current line. HIGH.
- [React Server Components DoS / source-code-exposure advisories Dec 2025–Jan 2026](https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components) — does not apply to client-only apps; reference for hygiene only. HIGH.

SheetJS / CVEs:

- [SheetJS CDN root](https://cdn.sheetjs.com/) — authoritative distribution channel. HIGH.
- [SheetJS issue #2667 — why npm distribution stopped](https://github.com/SheetJS/sheetjs/issues/2667) — explains the npm-vs-tarball split. HIGH.
- [SheetJS issue #3098 — npm xlsx@0.18.5 high-severity vulnerability](https://git.sheetjs.com/sheetjs/sheetjs/issues/3098) — the exact failure mode we are avoiding. HIGH.
- [CVE-2024-22363 — ReDoS in xlsx, fixed 0.20.2](https://security.snyk.io/vuln/SNYK-JS-XLSX-6252523) — the CVE that makes 0.20.3 (or 0.20.2+) mandatory. HIGH.
- [GitHub Advisory GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) — same CVE, public advisory. HIGH.

PPTX:

- [pptxgenjs project home](https://gitbrent.github.io/PptxGenJS/) and [GitHub](https://github.com/gitbrent/PptxGenJS) — confirms project is alive, 4.0.1 current. HIGH.
- [Snyk pptxgenjs](https://security.snyk.io/package/npm/pptxgenjs) — no current advisories at recommendation time. HIGH.

---

*Stack research for: vatlas (RVTools-only VMware estate atlas, 100 % client-side, HTML + PPTX export)*
*Researched: 2026-05-15*
