<!-- GSD:project-start source:PROJECT.md -->
## Project

**patlas**

vatlas is a 100 % client-side web app that turns one or more RVTools `.xlsx` exports into a navigable, visual atlas of a VMware estate — global dashboard, inventory tree views, allocation/DR analysis, OS End-of-Support forecasting, in-session trends across multiple snapshots — and exports the whole thing as a shareable HTML report and a PPTX deck. It is the broader sibling of vsizer: same architectural mold (drop file in browser → see numbers → export → leave), much larger feature surface.

**Core Value:** A user drops a RVTools workbook and walks away with a polished, shareable HTML report and PPTX deck describing their VMware estate — without uploading a single byte. **The report is the product.**

### Constraints

- **Tech stack:** React 19 · TypeScript (strict) · Vite 8 · Tailwind v4 · Zustand 5 · react-i18next · Zod · SheetJS (`xlsx@0.20.3` from official tarball, **not** the CVE-affected npm package) · pptxgenjs 4 · Biome · Vitest + @testing-library/react · Apache ECharts via `echarts-for-react` (SVG renderer everywhere, tree-shaken). Match vsizer.
- **Engineering principles (binding):** **KISS**, **DRY**, **functional programming**. No premature abstractions, no class hierarchies for domain logic, no copy-paste between phases. Engines are pure functions; the Zustand store holds inputs only; `useEstateView` is the one place `useMemo` lives. If two phases would compute the same thing, the second imports from the first.
- **Privacy invariant:** no fetch ships workbook bytes; no telemetry of parsed contents; no `localStorage` of dataset rows. Refresh = data gone.
- **Deploy target:** GitHub Pages static site at `fjacquet.github.io/patlas/` (same CI shape as vsizer: typecheck → lint → test → build → deploy).
- **Input format:** RVTools `.xlsx` only (no Live Optics, no `.zip` bundles in v1).
- **Charting:** Apache ECharts with `{ renderer: 'svg' }` mandated project-wide (locked in during research — SVG everywhere for crisp pictures and trivial HTML-report inlining). Canvas permitted only as a per-chart escape hatch for in-app >10k-point overviews that don't appear in the HTML report.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Executive summary (read this first)

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
| Apache ECharts | `^6.0.0` | Charting engine (treemap, sunburst, heatmap, calendar, gauge, bar, line, pie, area, radial) | Resolved during Phase-2 research to v6 (GA 2025-07-30; tree-shaking + `SVGRenderer` import paths unchanged from v5). Shipped in Phase 2. See "Charting decision" section below. Tree-shake via `echarts/core` + per-chart-type imports + `SVGRenderer`, ~150–300 KB gzipped. |
| `echarts-for-react` | `^3.0.6` | Thin React wrapper around ECharts | The de-facto React binding; declares `echarts ^6.0.0` in peerDependencies. Use the core entry (`echarts-for-react/lib/core`) with tree-shaken `echarts.use([...])`; supports `opts={{ renderer: 'svg' }}` which is the keystone of the HTML report export plan. |
| pptxgenjs | `^4.0.1` | PPTX export | Still the only credible browser-side PPTX generator in 2026. 4.0.1 was the only 4.x release and remains the current version; mature, no known CVEs. vsizer's PPTX engine in `engines/export/pptx/` is reusable. |
| react-i18next | `^16.6.6` | i18n (FR · EN · DE · IT) | vsizer's setup translates 1:1. DE/IT shipped 2026-05-25; technical terms pending native review. |
| i18next | `^26.1.0` | i18n core | Lockstep with react-i18next. |
| i18next-browser-languagedetector | `^8.2.1` | Locale detection | Same chain (`?lang=` → localStorage → navigator → `fr` fallback). Note: a `patlas-lang` localStorage key is allowed (it stores a locale code, not dataset rows — does not breach the privacy invariant). |

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

- Always use the tree-shaking import path (`echarts/core`), never `import * as echarts from 'echarts'`. Register only the charts and components you use.
- Pick the **SVG renderer**, not Canvas. Canvas is faster for >10k points; vatlas's per-cluster cardinality is in the hundreds-to-low-thousands, well within SVG's comfort zone. SVG is what makes the HTML report export trivial and what keeps charts crisp in the exported PPTX (pptxgenjs can embed SVG paths or rasterize cleanly).
- Wrap `<ReactECharts>` in a thin `<Chart>` component that injects the SVG renderer and a project-wide theme so every chart inherits the Midnight Executive palette tokens defined in CSS.

### HTML report export decision (the second key new choice)

| Approach | Verdict | Reason |
|---|---|---|
| **Live-DOM serialization (recommended)** | YES | Zero new runtime deps. Reuses the same ECharts SVG already rendered on screen. Resulting file is statically viewable in any browser — even Safari with JS disabled. Pure function in `engines/`, easy to coverage-gate. |
| `vite-plugin-singlefile` | NO — wrong problem | This bundles the **vatlas app itself** into a single HTML for distribution (think: download the app as one file). It does **not** help produce a per-snapshot report file from inside a running app. Don't conflate the two. |
| `@react-pdf/renderer` | NO | It produces PDF, not HTML. vatlas wants HTML (interactive-ish, copyable text, no font embedding hassles). PDF is a different deliverable and is not in scope. |
| Headless rendering via `puppeteer` / Playwright | NO | Requires a server / Node process; violates the 100 % client-side invariant. |
| `single-file` browser extension (gildas-lormeau/SingleFile) | NO | Asks the user to install a browser extension. Not acceptable for "drop file, get report" UX. Internally it does what we already plan — serialize the live DOM with inlined resources — but as an extension. We do this in-app instead. |
| Custom HTML string assembly (template literals) | NO — but partial yes | Hand-concatenating HTML strings for the report shell is fine for a one-off; for the volume of structure in vatlas (KPI tiles, tables, multiple chart sections per page, multiple pages) `renderToStaticMarkup` of a real React tree is dramatically less error-prone and gives us free typed components. |

## Installation

# 1) Core runtime deps

# 2) SheetJS — REQUIRED via the official tarball, NOT npm

# 3) Dev deps (build / lint / test)

# expected: <https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz>

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

## Stack Patterns by Variant

- Add `vite-plugin-singlefile` as a **separate optional build target** (e.g. `npm run build:portable`) to produce a single-file version of the vatlas app itself, alongside the normal GitHub Pages build. This is independent of the per-snapshot HTML report and useful only as an offline distribution form.
- Switch the offending chart instances from `renderer: 'svg'` to `renderer: 'canvas'` on a per-chart basis. Keep SVG for charts that go into the HTML report; use Canvas only for in-app overview charts that don't need SVG output. ECharts supports this per-instance.
- Add `@react-pdf/renderer` as a third export engine alongside HTML and PPTX. Reuse the same chart SVGs (the renderer can embed SVG into PDF).
- Re-evaluate Nivo vs ECharts for charts. ECharts has accessibility props (`aria` config on series) but Nivo's ARIA story is significantly more polished out of the box.

## Version Compatibility

| Package A | Compatible With | Notes |
|---|---|---|
| `react@^19.2.6` | `react-dom@^19.2.6` | Must be in lockstep. |
| `react@19` | `@types/react@^19.2.x` | The `@types/react@18.x` line is incompatible; do not mix. |
| `vite@^8` | `@vitejs/plugin-react@^6` | Plugin-react v5 does not work with Vite 8. |
| `vite@^8` | `vitest@^4.x` | Vitest 4 is the only line that targets Vite 8 cleanly. Vitest 3 will install but produces resolution warnings. |
| `tailwindcss@^4.3` | `@tailwindcss/vite@^4.3` | Must match major+minor. |
| `echarts-for-react@^3.0.6` | `echarts@^6.x` | echarts-for-react 3.0.6 declares `echarts ^6.0.0` in peerDependencies. v6 tree-shaking + `SVGRenderer` paths unchanged from v5. |
| `zod@^4` | TypeScript `>=5.5` | Older TS produces slow type-checks on v4 schemas. We are on 5.9. |
| `zustand@^5` | React `>=18` | React 19 fully supported since 5.0.x. |
| `xlsx@0.20.3` tarball | Anything | No peer deps. Just verify the resolution did not silently get rewritten by a tool. |

## Sources

- [LogRocket — Best React chart libraries 2025/2026](https://blog.logrocket.com/best-react-chart-libraries-2025/) — confirmation that Recharts lacks heatmap/sunburst/calendar and that ECharts/Plotly cover them. MEDIUM.
- [Querio — 8 Top React Chart Libraries 2026](https://querio.ai/articles/top-react-chart-libraries-data-visualization) — chart-type matrix. MEDIUM.
- [arcdev — 10 Best React Chart Libraries 2026](https://arcdev.in/10-best-react-chart-libraries-2026-fast-beautiful-powerful/) — corroborating coverage table. MEDIUM.
- [Apache ECharts Features](https://echarts.apache.org/en/feature.html) — official list of supported series including treemap, sunburst, heatmap, calendar, gauge. HIGH.
- [Apache ECharts Changelog](https://echarts.apache.org/en/changelog.html) — sunburst `emphasis: 'relative'`, treemap `cursor`, calendar `silent` 2026 features. HIGH.
- [echarts-for-react Tree-Shaking Docs](https://echartsforreact.com/docs/guides/tree-shaking/) — confirms ~150 KB / ~300 KB / ~1 MB bundle tiers. HIGH.
- [ECharts Canvas vs SVG handbook](https://apache.github.io/echarts-handbook/en/best-practices/canvas-vs-svg/) — SVG renderer characteristics. HIGH.
- [GitHub issue: echarts-for-react SSR with renderToStaticMarkup](https://github.com/hustcc/echarts-for-react/issues/202) — confirms SSR/SVG-string path used by the HTML-report design. MEDIUM.
- [Recharts issue #237 — heatmap support request](https://github.com/recharts/recharts/issues/237) — confirms Recharts has no built-in heatmap. HIGH.
- [vite-plugin-singlefile npm](https://www.npmjs.com/package/vite-plugin-singlefile) — purpose & limitations (build-time, not runtime). HIGH.
- [React `renderToStaticMarkup` reference](https://react.dev/reference/react-dom/server/renderToStaticMarkup) — official API. HIGH.
- [ECharts SSR / `renderToSVGString` handbook](https://apache.github.io/echarts-handbook/en/how-to/cross-platform/server/) — SVG-string export from ECharts. HIGH.
- [Apache ECharts `getDataURL`](https://echarts.apache.org/en/api.html) — `getDataURL({type:'svg'})` fallback. HIGH.
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
- [SheetJS CDN root](https://cdn.sheetjs.com/) — authoritative distribution channel. HIGH.
- [SheetJS issue #2667 — why npm distribution stopped](https://github.com/SheetJS/sheetjs/issues/2667) — explains the npm-vs-tarball split. HIGH.
- [SheetJS issue #3098 — npm xlsx@0.18.5 high-severity vulnerability](https://git.sheetjs.com/sheetjs/sheetjs/issues/3098) — the exact failure mode we are avoiding. HIGH.
- [CVE-2024-22363 — ReDoS in xlsx, fixed 0.20.2](https://security.snyk.io/vuln/SNYK-JS-XLSX-6252523) — the CVE that makes 0.20.3 (or 0.20.2+) mandatory. HIGH.
- [GitHub Advisory GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) — same CVE, public advisory. HIGH.
- [pptxgenjs project home](https://gitbrent.github.io/PptxGenJS/) and [GitHub](https://github.com/gitbrent/PptxGenJS) — confirms project is alive, 4.0.1 current. HIGH.
- [Snyk pptxgenjs](https://security.snyk.io/package/npm/pptxgenjs) — no current advisories at recommendation time. HIGH.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- project-notes: hand-maintained, NOT a GSD-managed fence -->
## Commands

```bash
npm run dev                       # Vite dev server → http://localhost:5173/patlas/
npm run build                     # tsc -b && vite build (prebuild runs supply-chain gate)
npm run typecheck                 # tsc --noEmit (app + tsconfig.test.json)
npx @biomejs/biome check .        # Lint — use THIS, not `npm run lint` (see Gotchas)
npm run test:run                  # vitest run (CI mode)
npm run test:coverage             # coverage; engines/ gated ≥75%
npm run check:supply-chain        # fails on telemetry pkgs or xlsx pin drift
npm run check:bundle-size         # fails if echarts chunk > 300 KB gz
```

## Architecture (shipped P1–P7)

- `src/engines/**` — pure functions only (no React/DOM/Zustand/Zod; Zod lives only at the parser boundary). Vitest-gated ≥75%.
- `src/store/datasetStore.ts` — Zustand, **inputs only** (`Map<id,Snapshot>` immutable). No cached aggregates (deliberate vsizer deviation).
- `src/hooks/useEstateView.ts` — the **single** `useMemo` in non-test `src/`; the only bridge store→UI/exports. Components consume this hook, never engines.
- Parser runs in a Web Worker; `xlsx` import is confined to `parser.worker.ts`.
- `src/components/Chart.tsx` — the only ECharts import site; single `option` prop; SVG renderer mandated.
- **Right-sizing + Monster VMs** (branch `feat/vm-rightsizing-stress`, post-v2.0, via the superpowers spec/plan flow — see `docs/superpowers/`): RVTools `vMemory`+`vCPU` parsed into a parallel `VmUsageRow[]` on `Snapshot` (config stays on `VInfoRow`; `null`=not-derivable, never 0). Pure `engines/aggregation/sizing.ts` (oversized/undersized/stressed — CPU/mem utilization vs allocation, **max across loaded snapshots, powered-on only**) + `monsterVm.ts` (largest by configured vCPU/vRAM) → `EstateView.sizing` / `.monsters`. In-memory `sizingThresholds` / `monsterThresholds` store slices, threaded through the single `useEstateView` memo. `components/rightsizing/RightSizingView` + `components/monstervm/MonsterVmView` (nav ids `rightsizing`/`monstervm`); native PPTX `slides/rightSizingSlide` (KPI+bar, emits when `sizing.hasUsageData`) + `slides/monsterSlide` (KPI+native table, emits when `monsters.count>0`). The HTML report deliberately **excludes** both (web + PPTX only). CPU-util denominator = `vcpu × host per-core MHz` (approximation). RVTools is point-in-time; "max" = max across the snapshots in scope.

## Conventions

- Commit prefix `<type>(NN-NN): …` (phase-plan id), e.g. `feat(03-02): …`.
- Branded units (`MiB`/`GiB`/`MHz`/`GHz`/…) — never a raw `* 1.048576` (RVTools "MB" is MiB; ADR-0010).
- Toggles/tabs reuse the `ThemeToggle` `<fieldset role="group">` + `aria-pressed` idiom — don't reinvent.
- i18n keys land in ALL FOUR locales (`en`/`fr`/`de`/`it`); the `src/i18n/keyParity.test.ts` gate enforces identical key paths (namespaces auto-derived from `locales/en/`). No pre-formatted numbers in strings; no editorial verbs ("recommend/should/poor/good"). DE/IT technical terminology is pending native review (tracked in the de-it-i18n spec risk).
- No `localStorage` of dataset rows — only `patlas-theme` + `patlas-lang` keys are allowed.

## Gotchas

- **`npm run lint` is intercepted by RTK** and prints a bogus `ESLint output (JSON parse failed)` — the linter is Biome. Run `npx @biomejs/biome check .` directly.
- **Privacy guard throws, it does not silently block.** Any non-same-origin `fetch`/`XHR`/`WS`/`sendBeacon` throws synchronously (intentional — silent block is undetectable). Adding any network call breaks the app by design.
- **Reusing `components/inventory/DataTable.tsx`:** it resolves visible column headers via `useTranslation('inventory')` → `t('col.<id>')` — the `headerFor` prop is **CSV-only**. A new column `id` needs an `inventory:col.<id>` key in `i18n/locales/{en,fr}/inventory.json` or the header renders the raw key. The virtualized `<tbody>` rows are `flex w-full` + per-cell `flex-1`; the `<thead>` must use the **same** flex layout (not default table-cell sizing) or header/body columns desync (latent bug fixed in P7 — affected all consumers).
- **`rtk tsc` only typechecks the app project** (`tsconfig.app`). Test-file type errors — e.g. a `Snapshot`/`EstateView` literal missing a newly-required field — surface ONLY under the full `npm run typecheck` (app + `tsconfig.test.json`). After adding a required field to a shared type, run `npm run typecheck`, not just `rtk tsc`.
- **`vsanRelink.realfile.test.ts` can time out (5 s) under `--coverage`** when the real workbook is present (instrumentation slows the 3-vCenter parse) — not a regression. Use `npm run test:coverage -- --testTimeout=60000` for a clean coverage gate.
- **`grep -c "<token>" == 0` plan gates (and the security hook) match doc-comments too.** A comment documenting a token's *deliberate absence* (e.g. naming `new Date(` or the React raw-HTML prop to say "never used") fails the gate / blocks the write. Phrase absence comments without the literal token.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->