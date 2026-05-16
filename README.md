# vatlas

[![Deploy to GitHub Pages](https://github.com/fjacquet/rvtui/actions/workflows/static.yml/badge.svg?branch=main)](https://github.com/fjacquet/rvtui/actions/workflows/static.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 8](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Apache ECharts 6](https://img.shields.io/badge/ECharts-6%20(SVG)-aa344d?logo=apacheecharts&logoColor=white)](https://echarts.apache.org/)
[![Tested with Vitest](https://img.shields.io/badge/tested%20with-vitest-6e9f18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Code style: Biome](https://img.shields.io/badge/code%20style-biome-60a5fa?logo=biome&logoColor=white)](https://biomejs.dev/)
[![Client-side only](https://img.shields.io/badge/processing-100%25%20client--side-22c55e)](#privacy-guarantee)
[![RVTools only](https://img.shields.io/badge/input-RVTools%20.xlsx-0ea5e9)](#what-it-does)

> Drop one or more RVTools `.xlsx` exports, get a navigable, visual **atlas of your VMware estate** — and a shareable HTML report + PPTX deck. **100 % client-side: your workbook never leaves the browser.**

vatlas is the broader sibling of [vsizer](https://github.com/fjacquet/vsizer): same architectural mold (drop file → see numbers → export → leave), much larger feature surface. Where vsizer produces a single cluster-utilization deck, vatlas is an analytics atlas — global dashboard, inventory tree, allocation/DR analysis, OS End-of-Support forecasting, and in-session trends. **The report is the product.**

## What it does

- **Drag & drop** one or more RVTools `vInfo`/`vHost`/`vCluster`/`vDatastore` workbooks. RVTools-only by design (no Live Optics, no `.zip` bundles).
- **Parses in a Web Worker** with SheetJS — nothing is uploaded, nothing is written to `localStorage`/`IndexedDB`/`OPFS`. Refresh the page and the data is gone.
- **Global dashboard** — one column per cluster: ESX/VM-by-OS/datastore counts, physical & consumed GHz, mean CPU %/RAM %, vCPU allocation, CPU Ready %, with three accounting modes (Configured / Active / Storage-realistic).
- **Inventory navigation** — virtualised vCenter → Cluster → ESX → VM tree plus sortable/filterable VM, ESX and datastore tables (NAA-keyed, no shared-LUN double-count), column show/hide, and CSV export of the current filter.
- **Multi-vCenter aggregation, stretched-cluster & DR simulation, OS End-of-Support forecasting, and in-session trends** — planned (see [Status](#status)).
- **Exports** — a single self-contained HTML report and a factual PPTX deck (planned, Phase 7). No editorial recommendations: vatlas carries the numbers, the narrative stays with the presenter.
- **i18n FR + EN**, light/dark theme, deploys as a static site to GitHub Pages.

## Privacy guarantee

The defining product invariant — enforced in code, not just promised:

- A runtime guard wraps `fetch`/`XHR`/`WebSocket`/`sendBeacon` and **throws synchronously** on any non-same-origin request (a silent block would be undetectable).
- A `<meta http-equiv="Content-Security-Policy" content="connect-src 'self'">` tag blocks third-party connections at the browser.
- A CI gate denylists telemetry packages (`@sentry/*`, `posthog-*`, `@amplitude/*`, …) and pins SheetJS to the official CDN tarball.
- No dataset rows ever touch persistent storage. Only the locale code (`vatlas-lang`) and theme (`vatlas-theme`) use `localStorage`.

## Stack

React 19 · TypeScript (strict) · Vite 8 (Rolldown) · Tailwind v4 · Zustand 5 · Zod 4 · react-i18next (FR + EN) · SheetJS (`xlsx@0.20.3` from the official CDN tarball, **not** the CVE-affected npm package) · Apache ECharts 6 via `echarts-for-react` (SVG renderer everywhere, tree-shaken) · `@tanstack/react-table` + `@tanstack/react-virtual` · pptxgenjs 4 · Biome · Vitest + @testing-library/react.

Pure-function `engines/` (Vitest-gated ≥75 %), an inputs-only Zustand store, and a single `useEstateView` hook bridging store → UI/exports. Engineering principles are binding: **KISS, DRY, functional programming** — no premature abstractions, no domain classes, no copy-paste between phases.

## Getting started

```bash
npm install            # pins the SheetJS tarball from package.json — do NOT `npm install xlsx`
npm run dev            # Vite dev server → http://localhost:5173/vatlas/
```

Useful scripts:

```bash
npm run build               # tsc -b && vite build (prebuild runs the supply-chain gate)
npm run typecheck           # tsc --noEmit (app + test project)
npx @biomejs/biome check .  # lint (run Biome directly)
npm run test:run            # vitest run
npm run test:coverage       # coverage; engines/ gated ≥75 %
npm run check:supply-chain  # fails on telemetry packages or SheetJS pin drift
npm run check:bundle-size   # fails if the ECharts chunk exceeds 300 KB gzipped
```

## Status

Built bottom-up under horizontal layers; each phase ships an observable capability.

| Phase | Scope | State |
|-------|-------|-------|
| 1 | Foundation & Invariants — parser-in-Worker, privacy guard, branded units, snapshot store | ✅ shipped |
| 2 | Aggregation & Global Dashboard — cluster aggregates, ECharts SVG infra, 3 accounting modes | ✅ shipped |
| 3 | Inventory Navigation — virtualised tree, VM/ESX/Datastore tables, CSV export | ◆ in progress |
| 4 | Multi-vCenter, Stretched-cluster, Allocation & DR Simulation | ○ planned |
| 5 | OS End-of-Support Forecast (3/6/9/12-month at-risk) | ○ planned |
| 6 | In-Session Trends (multi-snapshot timelines) | ○ planned |
| 7 | HTML + PPTX Exports & GitHub Pages deploy | ○ planned |

## License

MIT.
