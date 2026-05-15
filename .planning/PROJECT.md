# vatlas

## What This Is

vatlas is a 100 % client-side web app that turns one or more RVTools `.xlsx` exports into a navigable, visual atlas of a VMware estate — global dashboard, inventory tree views, allocation/DR analysis, OS End-of-Support forecasting, in-session trends across multiple snapshots — and exports the whole thing as a shareable HTML report and a PPTX deck. It is the broader sibling of vsizer: same architectural mold (drop file in browser → see numbers → export → leave), much larger feature surface.

## Core Value

A user drops a RVTools workbook and walks away with a polished, shareable HTML report and PPTX deck describing their VMware estate — without uploading a single byte. **The report is the product.**

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Global vCenter dashboard — clusters / ESX / VMs (by OS) / datastores, one column per cluster
- [ ] Detailed inventory with tree views (cluster → ESX → VM), sortable tables, datastore views
- [ ] Multi-vCenter aggregation — load several RVTools workbooks, treat as one logical estate
- [ ] OS End-of-Support forecast — Linux / Windows / ESX EOS dates, 3 / 6 / 9 / 12-month at-risk forecast
- [ ] Allocated-resource calculation with configurable CPU/RAM ratios and custom failover scenarios
- [ ] Disaster Recovery simulation — mark vCenter(s) / cluster(s) as failed, recompute survivor capacity
- [ ] Stretched-cluster management — Étendu / Stretched pill on clusters drives DR reservation (CPU + RAM) and feeds DR sim
- [ ] In-session trends — drop multiple monthly exports, see evolution of clusters / ESX / VMs / vCPU / vRAM / disks
- [ ] HTML report export — a single self-contained shareable HTML deliverable
- [ ] PPTX export — same neutral, brand-free style family as vsizer
- [ ] Visual-first UX — charts and graphs as first-class throughout, not table-only
- [ ] i18n FR + EN (react-i18next)
- [ ] Public deploy to GitHub Pages (`fjacquet.github.io/vatlas/`)

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

- **Tech stack:** React 19 · TypeScript (strict) · Vite 8 · Tailwind v4 · Zustand 5 · react-i18next · Zod · SheetJS (`xlsx@0.20.3` from official tarball, **not** the CVE-affected npm package) · pptxgenjs 4 · Biome · Vitest + @testing-library/react. Match vsizer.
- **Privacy invariant:** no fetch ships workbook bytes; no telemetry of parsed contents; no `localStorage` of dataset rows. Refresh = data gone.
- **Deploy target:** GitHub Pages static site (same CI shape as vsizer: typecheck → lint → test → build → deploy).
- **Input format:** RVTools `.xlsx` only (no Live Optics, no `.zip` bundles in v1).
- **Charting library:** undecided — chart-types-driven choice deferred to research phase.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Project name = `vatlas` | Fits the `v*` family with vsizer; framing as an atlas of the VMware estate (inventory + trends + EOS + DR all under one map) | — Pending |
| Web client, not TUI | Despite directory name `rvtui`, target is a browser app, same form factor as vsizer | — Pending |
| 100 % client-side, no persistence between sessions | Preserves the vsizer privacy invariant; trends are handled by loading multiple snapshots together | — Pending |
| RVTools-only ingestion (drop Live Optics) | Narrower parser surface, fewer source-detection branches, focuses scope | — Pending |
| Reuse vsizer's RVTools parser + aggregation engines | Faster bootstrap; the math has tests and is correct | — Pending |
| Visual-first UX (charts/graphs as first-class) | Mirrors RVTools Analyser's strength; differentiates from vsizer's static-deck preview style | — Pending |
| Charting library deferred to research | Choice depends on chart types needed (treemaps for storage? heatmaps for EOS?); let researcher recommend | — Pending |
| HTML + PPTX both v1 | "The report is the product" — both formats are how the value leaves the app | — Pending |

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
*Last updated: 2026-05-15 after initialization*
