<!-- generated-by: gsd-doc-writer -->
# pAtlas

[![Deploy to GitHub Pages](https://github.com/fjacquet/patlas/actions/workflows/static.yml/badge.svg?branch=main)](https://github.com/fjacquet/patlas/actions/workflows/static.yml)
[![Live app](https://img.shields.io/badge/live-fjacquet.github.io%2Fpatlas-2563eb)](https://fjacquet.github.io/patlas/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 8](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Apache ECharts 6](https://img.shields.io/badge/ECharts-6%20(SVG)-aa344d?logo=apacheecharts&logoColor=white)](https://echarts.apache.org/)
[![Tested with Vitest](https://img.shields.io/badge/tested%20with-vitest-6e9f18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Code style: Biome](https://img.shields.io/badge/code%20style-biome-60a5fa?logo=biome&logoColor=white)](https://biomejs.dev/)
[![Client-side only](https://img.shields.io/badge/processing-100%25%20client--side-22c55e)](#privacy-guarantee)
[![RVTools only](https://img.shields.io/badge/input-RVTools%20.xlsx-0ea5e9)](#patlas)
[![CI](https://github.com/fjacquet/patlas/actions/workflows/ci.yml/badge.svg)](https://github.com/fjacquet/patlas/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/fjacquet/patlas?sort=semver)](https://github.com/fjacquet/patlas/releases/latest)

> Drop one or more RVTools `.xlsx` exports, get a navigable, visual **atlas of your VMware estate** — and a shareable HTML report + PPTX deck. **100 % client-side: your workbook never leaves the browser.**

patlas is the broader sibling of [vsizer](https://github.com/fjacquet/vsizer): same architectural mold (drop file → see numbers → export → leave), much larger feature surface — global dashboard, inventory tree, allocation/DR analysis, OS End-of-Support forecasting, and in-session trends. **The report is the product.**

## Stack

React 19 · TypeScript (strict) · Vite 8 · Tailwind v4 · Zustand 5 · Zod 4 · react-i18next (FR · EN · DE · IT) · SheetJS (`xlsx@0.20.3` from the official CDN tarball, **not** the CVE-affected npm package) · Apache ECharts 6 (SVG renderer, tree-shaken) · pptxgenjs 4 · Biome · Vitest. Pure-function `engines/`, an inputs-only Zustand store, and a single `useEstateView` hook bridging store → UI/exports. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full picture.

## Quick start

```bash
npm install            # pins the SheetJS tarball — do NOT `npm install xlsx`
npm run dev            # Vite dev server → http://localhost:5173/patlas/
```

Drop a RVTools workbook into the running app to see the dashboard. Full prerequisites and first-run troubleshooting are in [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

## Privacy guarantee

The defining product invariant — enforced in code, not just promised: a runtime guard throws synchronously on any non-same-origin request, a CSP meta tag blocks third-party connections, a CI gate denylists telemetry packages, and no dataset rows ever touch persistent storage (refresh = data gone). See [docs/adr/0001-privacy-invariant.md](docs/adr/0001-privacy-invariant.md).

## Documentation

| Doc | What it covers |
|-----|----------------|
| [docs/PRD.md](docs/PRD.md) | Product requirements and scope |
| [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | How to use patlas as an end user |
| [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) | Prerequisites, install, first run |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Engine spine, store, hook, module map |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Build scripts, code style, conventions |
| [docs/TESTING.md](docs/TESTING.md) | Test framework, running tests, coverage |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Configuration and supply-chain gates |
| [docs/adr/](docs/adr/) | Architecture decision records |

## Status

patlas is built bottom-up across a 10-phase roadmap; Phases 1–6 have shipped (foundation, global dashboard, inventory navigation, multi-vCenter merge, rich cluster/host intelligence, allocation & DR). OS End-of-Support forecasting, in-session trends, detailed storage/network views, and the HTML/PPTX exports are still ahead. `.planning/ROADMAP.md` is the source of truth for current phase status.

## License

MIT. <!-- VERIFY: LICENSE file is referenced by the badge but not present in the repository root -->
