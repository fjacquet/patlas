# vatlas

## What This Is

vatlas is a 100 % client-side web app that turns one or more RVTools `.xlsx` exports into a navigable, visual atlas of a VMware estate — global dashboard, inventory tree views, allocation/DR analysis, OS End-of-Support forecasting, in-session trends across multiple snapshots — and exports the whole thing as a shareable HTML report and a PPTX deck. It is the broader sibling of vsizer: same architectural mold (drop file in browser → see numbers → export → leave), much larger feature surface.

## Core Value

A user drops a RVTools workbook and walks away with a polished, shareable HTML report and PPTX deck describing their VMware estate — without uploading a single byte. **The report is the product.**

## Current State

**Shipped: v1.0.0** — released & deployed live at `https://fjacquet.github.io/vatlas/` (2026-05-19). 11 phases, 43 plans, ~23.6k LOC TypeScript. The full RVTools→atlas loop is in production: drop workbook(s) → global dashboard / inventory / allocation / DR / EOS / storage / network / threshold views / in-session trends → shareable self-contained **HTML report** + themed bilingual **PPTX deck** → leave (refresh = data gone). 484 tests; tsc/biome/supply-chain/bundle-size + the production build are CI-gated and green; client-side privacy invariant held throughout.

## Requirements

### Validated

- [x] Capacity-planning lens — separate "planned" what-if surface distinct from the realized "measured" ratio — *Phase 6 (realized satisfied by Phase 5 RCI-01); rendered + exported in Phase 11 (F-1, PLN-03/04)*
- [x] Disaster Recovery simulation — Server + Site loss, physical CPU/RAM impact, survivor verdict, factual caveats — *Phase 6 (G3)*
- [x] Global vCenter dashboard — clusters/ESX/VMs-by-OS/datastores, one column per cluster — *v1.0 (Phase 2)*
- [x] Detailed inventory with tree views, sortable/filterable tables, datastore views, CSV — *v1.0 (Phase 3)*
- [x] Rich per-cluster / host / ESX operational insights (estate + per-cluster, calculated) — *v1.0 (Phase 5, RCI-01..05)*
- [x] Multi-vCenter aggregation — several RVTools workbooks as one logical estate — *v1.0 (Phase 4, MVC-01..04)*
- [x] Stretched-cluster management — factual per-site split feeds DR — *v1.0 (Phase 4, STR-01..03)*
- [x] OS End-of-Support forecast — 3/6/9/12-month at-risk, bundled catalogue — *v1.0 (Phase 7, EOS-01..06)*
- [x] In-session trends — drop multiple snapshots, see evolution; refresh wipes — *v1.0 (Phase 8, TRD-01..05)*
- [x] Storage / Network / detailed views + threshold alerting + vSAN relink — *v1.0 (Phase 9, STG/NET/DTL/ALR/VSR; surfaced into report+deck in Phase 11, F-2)*
- [x] HTML report export — single self-contained shareable deliverable — *v1.0 (Phase 10, HTM-01..05; Phase 11 added P9 + planned sections)*
- [x] PPTX export — neutral brand-free Midnight Executive deck, real ECharts, FR+EN — *v1.0 (Phase 10, PPT-01..04; Phase 11 added Storage/Network/Planned slides)*
- [x] Visual-first UX — ECharts SVG charts first-class throughout — *v1.0 (Phase 2 infra, all phases)*
- [x] i18n FR + EN with CI key-parity gate — *v1.0 (continuous, Phases 1–11)*
- [x] Public deploy to GitHub Pages (`fjacquet.github.io/vatlas/`) — *v1.0 (Phase 10, DEP-01/02)*

### Active

- (None — v1.0 shipped. The next milestone defines new requirements via `/gsd-new-milestone`.)

### Out of Scope

- **Live Optics ingestion** — vsizer supports it; vatlas is RVTools-only. Reduces parser surface and ambiguity.
- **Cross-session persistence (DB, localStorage of dataset rows, OPFS, IndexedDB)** — would break the vsizer privacy invariant; trends are in-session only (user loads N monthly exports together).
- **Backend / server / file upload** — 100 % client-side is a hard product invariant. Nothing leaves the browser.
- **Telemetry of parsed contents** — same privacy invariant.
- **Editorial recommendations in the report** — like vsizer, vatlas reports carry numbers and forecasts, not opinions. Narrative stays with the presenter.
- **Real-time vCenter API integration** — RVTools workbook is the only input. No direct connection to vCenter.

## Context

- **Reference tool:** legacy RVTools Analyser desktop app (Windows, persistent DB). We are rebuilding its analytic value in a browser, ephemeral, RVTools-only.
- **Sibling project:** `/Users/fjacquet/Projects/vsizer` — same author, same stack family. vsizer focuses narrowly on producing a cluster-utilization PPTX. vatlas is broader (inventory + EOS + DR + trends) but stays in the same architectural mold and is RVTools-only (vsizer also supports Live Optics).
- **Reusable foundations from vsizer:** the RVTools-side of `engines/parser/` (parseXlsx, normalize, Zod schemas), `engines/aggregation/` math (physical / consumed GHz, per-cluster utilization, vCPU allocation, stretched-cluster DR reservation), Tailwind v4 theme, i18n scaffolding, Vitest + Biome configs, GitHub Pages CI shape.
- **Sample data on disk for tests/fixtures:** `vsizer/public/samples/rvtools-sample.xlsx` plus real RVTools exports in `~/Downloads/` and `~/Library/CloudStorage/OneDrive-Home/`.

## Constraints

- **Tech stack:** React 19 · TypeScript (strict) · Vite 8 · Tailwind v4 · Zustand 5 · react-i18next · Zod · SheetJS (`xlsx@0.20.3` from official tarball, **not** the CVE-affected npm package) · pptxgenjs 4 · Biome · Vitest + @testing-library/react · Apache ECharts via `echarts-for-react` (SVG renderer everywhere, tree-shaken). Match vsizer.
- **Engineering principles (binding):** **KISS**, **DRY**, **functional programming**. No premature abstractions, no class hierarchies for domain logic, no copy-paste between phases. Engines are pure functions; the Zustand store holds inputs only; `useEstateView` is the one place `useMemo` lives. If two phases would compute the same thing, the second imports from the first.
- **Privacy invariant:** no fetch ships workbook bytes; no telemetry of parsed contents; no `localStorage` of dataset rows. Refresh = data gone.
- **Deploy target:** GitHub Pages static site at `fjacquet.github.io/vatlas/` (same CI shape as vsizer: typecheck → lint → test → build → deploy).
- **Input format:** RVTools `.xlsx` only (no Live Optics, no `.zip` bundles in v1).
- **Charting:** Apache ECharts with `{ renderer: 'svg' }` mandated project-wide (locked in during research — SVG everywhere for crisp pictures and trivial HTML-report inlining). Canvas permitted only as a per-chart escape hatch for in-app >10k-point overviews that don't appear in the HTML report.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Project name = `vatlas` | Fits the `v*` family with vsizer; framing as an atlas of the VMware estate (inventory + trends + EOS + DR all under one map) | ✓ Good (v1.0) |
| Web client, not TUI | Despite directory name `rvtui`, target is a browser app, same form factor as vsizer | ✓ Good (v1.0) |
| 100 % client-side, no persistence between sessions | Preserves the vsizer privacy invariant; trends are handled by loading multiple snapshots together | ✓ Good (v1.0) |
| RVTools-only ingestion (drop Live Optics) | Narrower parser surface, fewer source-detection branches, focuses scope | ✓ Good (v1.0) |
| Reuse vsizer's RVTools parser + aggregation engines | Faster bootstrap; the math has tests and is correct | ✓ Good (v1.0) |
| Visual-first UX (charts/graphs as first-class) | Mirrors RVTools Analyser's strength; differentiates from vsizer's static-deck preview style | ✓ Good (v1.0) |
| Charting library = Apache ECharts via `echarts-for-react`, SVG renderer | ECharts ships treemap/sunburst/heatmap/calendar/gauge natively (4 of 6 chart families would be hand-built in visx); SVG renderer makes the HTML-report inline-SVG path trivial; live charts are already `<svg>`, plus `renderToSVGString()` for the report builder | ✓ Good (v1.0) |
| HTML + PPTX both v1 | "The report is the product" — both formats are how the value leaves the app | ✓ Good (v1.0) |
| KISS / DRY / functional programming as binding engineering principles | Pure-function engines, immutable data, no premature abstractions, no domain classes; engines compose via small typed functions. Inherits and extends vsizer's posture. Recorded as durable directive after roadmap. | ✓ Good (v1.0) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-19 after **v1.0 milestone complete** — 11/11 phases, 43 plans, v1.0.0 released & deployed to fjacquet.github.io/vatlas/. Full RVTools→atlas + shareable HTML report + bilingual PPTX deck shipped; audit passed (F-1/F-2 closed by Phase 11). All Key Decisions validated Good.*
