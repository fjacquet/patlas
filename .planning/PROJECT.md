# vatlas

## What This Is

vatlas is a 100 % client-side web app that turns one or more RVTools `.xlsx` exports into a navigable, visual atlas of a VMware estate — global dashboard, inventory tree views, allocation/DR analysis, OS End-of-Support forecasting, in-session trends across multiple snapshots — and exports the whole thing as a shareable HTML report and a PPTX deck. It is the broader sibling of vsizer: same architectural mold (drop file in browser → see numbers → export → leave), much larger feature surface.

## Core Value

A user drops a RVTools workbook and walks away with a polished, shareable HTML report and PPTX deck describing their VMware estate — without uploading a single byte. **The report is the product.**

## Current State

**Shipped: v2.0** (2026-05-20) on top of v1.0.0 (2026-05-19, live at `https://fjacquet.github.io/vatlas/`). vatlas is now an **installable, fully-offline PWA** (under a deliberately amended, audited ADR-0001 service-worker exception), with a **redesigned dashboard** (one left column, KPI tiles, a scannable cluster table with central stretched toggles), a **Capacity Planning visual return** (measured-vs-planned headroom), and a **vsizer-grade PPTX deck** (brand-free, all charts native pptxgenjs, fully labeled). 506 tests across 80 files; tsc/biome/supply-chain/bundle-size + production build CI-gated and green; the privacy invariant now extends into the service-worker scope (guard-first `sw.ts`, precache-only).

**Next milestone goals:** TBD via `/gsd-new-milestone`. Candidate carry-forwards: consolidated Playwright browser UAT (offline cold-boot, web-layout visuals); DR slide stretched-reservation summary when no scenario; swap the hand-authored UIX icons for the icons-project exact set.

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
- [x] Installable, fully-offline PWA — audited precache-only SW (ADR-0001 exception), smart auto-update — *v2.0 (Phases 12–13, GOV/PWA; installability browser-confirmed)*
- [x] Redesigned UI — one left column, KPI-tile dashboard, scannable cluster table with central stretched toggles — *v2.0 (Phases 14–15, 18, NAV/UIX)*
- [x] Capacity Planning visual return — measured-vs-planned headroom — *v2.0 (Phase 16, PLN-01)*
- [x] PPTX deck rebuilt to vsizer parity — brand-free, native charts, fully labeled, dense factual — *v2.0 (Phases 17–18, PPT)*

### Active

- (None — v2.0 shipped. Define the next milestone via `/gsd-new-milestone`.)

### Out of Scope

- **Live Optics ingestion** — vsizer supports it; vatlas is RVTools-only. Reduces parser surface and ambiguity.
- **Cross-session persistence of dataset rows (DB, localStorage of rows, OPFS, IndexedDB)** — would break the privacy invariant; trends are in-session only. *(v2.0 note: a precache-only service worker for static app assets is now permitted under the amended ADR-0001 exception; it never touches dataset rows. Refresh = data gone still holds.)*
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
| v2.0: amend ADR-0001 to allow a scoped, audited service worker | Offline/installable PWA requires a SW; ADR-0001 forbade SWs as a privacy attack surface. Exception is tightly bounded: injectManifest (own code), precache-only, same-origin, and `src/sw.ts` imports the privacy guard so cross-origin fetch throws inside SW scope too — extending the 3-layer model rather than poking a hole. | ✓ Good (v2.0 — gate-enforced; installable PWA browser-confirmed) |

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
*Last updated: 2026-05-20 after **v2.0 milestone complete** (Offline-Capable, Redesigned, Better Deck) — Phases 12–18: ADR-0001 SW exception + gate, installable offline PWA, one-column KPI-tile redesign + cluster table, Capacity Planning visual return, and a vsizer-grade native-chart PPTX deck. 506 tests green. Prior: v1.0 (11 phases, deployed 2026-05-19).*
