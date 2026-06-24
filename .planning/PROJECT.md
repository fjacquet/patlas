# patlas

## What This Is

patlas is a 100 % client-side web app that turns one or more **Proxmox VE reports** into a navigable, visual atlas of a Proxmox estate — global dashboard, inventory tree views, capacity/allocation analysis, OS End-of-Support forecasting, in-session trends across multiple snapshots, Snapshot Sprawl, Storage Content, and Cluster Health views — and exports the whole thing as a shareable HTML report and a PPTX deck. It is a fork of [vatlas](https://github.com/fjacquet/vatlas) (the VMware/RVTools sibling): same architectural mold (drop file in browser → see numbers → export → leave), remapped to Proxmox terminology and extended with Proxmox-native analytics.

## Core Value

A user drops a Proxmox VE report (`.zip` bundle or bare `.xlsx`) and walks away with a polished, shareable HTML report and PPTX deck describing their Proxmox estate — without uploading a single byte. **The report is the product.**

## Current State

**Shipped: v2.1.0** (2026-06-24) — live at `https://fjacquet.github.io/patlas/`. Three Proxmox-native views added: **Snapshot Sprawl** (guest snapshots still held on the estate), **Storage Content** (what occupies each storage by content type, plus backup-file inventory with per-guest recency), and **Cluster Health** (HA quorum/fencing service state, HA-managed guest resources, scheduled backup jobs). Also fixed the `.zip` upload bug so the upload zone accepts both Proxmox `.zip` report bundles and bare `.xlsx`. All three views are web-only (excluded from HTML report + PPTX deck by design). Inherited analytics relabeled to Proxmox; DR analysis removed.

Prior: **v2.0** (2026-05-20) — installable, fully-offline PWA (audited ADR-0001 service-worker exception), redesigned dashboard (one left column, KPI tiles, scannable cluster table), Capacity Planning visual return, vatlas-grade PPTX deck (brand-free, all charts native pptxgenjs, fully labeled). 506 tests across 80 files; tsc/biome/supply-chain/bundle-size + production build CI-gated and green.

**Next milestone goals:** TBD via `/gsd-new-milestone`. Candidate carry-forwards: consolidated Playwright browser UAT (offline cold-boot, web-layout visuals); swap the hand-authored UIX icons for the icons-project exact set; DE/IT native terminology review.

## Requirements

### Validated

- [x] Capacity-planning lens — separate "planned" what-if surface distinct from the realized "measured" ratio — *Phase 6 (realized satisfied by Phase 5 RCI-01); rendered + exported in Phase 11 (F-1, PLN-03/04)*
- [x] Global cluster dashboard — clusters/nodes/guests-by-OS/storage, one column per cluster — *v1.0 (Phase 2)*
- [x] Detailed inventory with tree views, sortable/filterable tables, storage views, CSV — *v1.0 (Phase 3)*
- [x] Rich per-cluster / node operational insights (estate + per-cluster, calculated) — *v1.0 (Phase 5, RCI-01..05)*
- [x] Cluster aggregation — several Proxmox reports as one logical estate — *v1.0 (Phase 4)*
- [x] OS End-of-Support forecast — 3/6/9/12-month at-risk, bundled catalogue — *v1.0 (Phase 7, EOS-01..06)*
- [x] In-session trends — drop multiple snapshots, see evolution; refresh wipes — *v1.0 (Phase 8, TRD-01..05)*
- [x] Storage / Network / detailed views + threshold alerting — *v1.0 (Phase 9, STG/NET/DTL/ALR; surfaced into report+deck in Phase 11, F-2)*
- [x] HTML report export — single self-contained shareable deliverable — *v1.0 (Phase 10, HTM-01..05; Phase 11 added P9 + planned sections)*
- [x] PPTX export — neutral brand-free Midnight Executive deck, real ECharts, FR+EN — *v1.0 (Phase 10, PPT-01..04; Phase 11 added Storage/Network/Planned slides)*
- [x] Visual-first UX — ECharts SVG charts first-class throughout — *v1.0 (Phase 2 infra, all phases)*
- [x] i18n EN · FR · DE · IT with CI key-parity gate — *v1.0 (continuous, Phases 1–11); DE+IT shipped 2026-05-25*
- [x] Public deploy to GitHub Pages (`fjacquet.github.io/patlas/`) — *v1.0 (Phase 10, DEP-01/02)*
- [x] Installable, fully-offline PWA — audited precache-only SW (ADR-0001 exception), smart auto-update — *v2.0 (Phases 12–13, GOV/PWA; installability browser-confirmed)*
- [x] Redesigned UI — one left column, KPI-tile dashboard, scannable cluster table — *v2.0 (Phases 14–15, 18, NAV/UIX)*
- [x] Capacity Planning visual return — measured-vs-planned headroom — *v2.0 (Phase 16, PLN-01)*
- [x] PPTX deck rebuilt to vatlas parity — brand-free, native charts, fully labeled, dense factual — *v2.0 (Phases 17–18, PPT)*
- [x] Snapshot Sprawl view — guest snapshots on the estate: count, guests-with-snapshots, total size, oldest age — *v2.1.0*
- [x] Storage Content view — per-storage content-type breakdown + backup-file inventory with per-guest recency — *v2.1.0*
- [x] Cluster Health view — HA quorum/fencing, HA-managed guest resources, scheduled backup jobs — *v2.1.0*
- [x] Accept Proxmox `.zip` report bundle in upload zone (in addition to bare `.xlsx`) — *v2.1.0*
- [x] Unified QEMU/LXC guests with `guestType` flag; UI segments by type — *v2.x (fork foundation)*

### Active

- (None — v2.1.0 shipped. Define the next milestone via `/gsd-new-milestone`.)

### Out of Scope

- **Disaster Recovery / DR simulation** — no Proxmox analog in scope. Removed from patlas.
- **Stretched-cluster / fault-domain analysis** — not applicable to Proxmox.
- **RVTools ingestion** — patlas accepts Proxmox reports only (`.zip` bundle or bare `.xlsx`).
- **Cross-session persistence of dataset rows (DB, localStorage of rows, OPFS, IndexedDB)** — would break the privacy invariant; trends are in-session only. *(v2.0 note: a precache-only service worker for static app assets is now permitted under the amended ADR-0001 exception; it never touches dataset rows. Refresh = data gone still holds.)*
- **Backend / server / file upload** — 100 % client-side is a hard product invariant. Nothing leaves the browser.
- **Telemetry of parsed contents** — same privacy invariant.
- **Editorial recommendations in the report** — patlas reports carry numbers and forecasts, not opinions. Narrative stays with the presenter.
- **Real-time Proxmox API integration** — the Proxmox report file is the only input. No direct API connection.

## Context

- **Parent project:** [vatlas](https://github.com/fjacquet/vatlas) — the VMware/RVTools sibling. patlas is a fork of vatlas; it keeps the same architectural mold (drop file in browser → see numbers → export → leave) and remaps terminology to Proxmox at the UI/i18n layer.
- **Sibling project:** `/Users/fjacquet/Projects/vsizer` — same author, same stack family. vsizer focuses narrowly on producing a cluster-utilization PPTX for VMware.
- **Reusable foundations from vatlas:** `engines/parser/` (parseXlsx, normalize, Zod schemas), `engines/aggregation/` math (physical / consumed GHz, per-cluster utilization, allocation), Tailwind v4 theme, i18n scaffolding, Vitest + Biome configs, GitHub Pages CI shape.
- **Additional patlas runtime:** `fflate` for ZIP extraction (`extractProxmoxBundle`); parser worker sniffs ZIP magic bytes.
- **Sample data on disk for tests/fixtures:** Proxmox report exports in `~/Downloads/` and `~/Library/CloudStorage/OneDrive-Home/`.

## Constraints

- **Tech stack:** React 19 · TypeScript (strict) · Vite 8 · Tailwind v4 · Zustand 5 · react-i18next · Zod · SheetJS (`xlsx@0.20.3` from official CDN tarball, **not** the CVE-affected npm package) · `fflate` (ZIP extraction) · pptxgenjs 4 · Biome · Vitest + @testing-library/react · Apache ECharts via `echarts-for-react` (SVG renderer everywhere, tree-shaken).
- **Engineering principles (binding):** **KISS**, **DRY**, **functional programming**. No premature abstractions, no class hierarchies for domain logic, no copy-paste between phases. Engines are pure functions; the Zustand store holds inputs only; `useEstateView` is the one place `useMemo` lives. If two phases would compute the same thing, the second imports from the first.
- **Privacy invariant:** no fetch ships report bytes (a runtime guard throws synchronously on any non-same-origin request; CSP blocks third-party connections); no telemetry of parsed contents; no `localStorage` of dataset rows (only `patlas-theme` / `patlas-lang`). Refresh = data gone.
- **Deploy target:** GitHub Pages static site at `fjacquet.github.io/patlas/` (same CI shape: typecheck → lint → test → build → deploy).
- **Input format:** Proxmox VE report as a `.zip` bundle (contains `report.xlsx` + optional `network-diagram.svg`) or bare `report.xlsx`. The upload zone accepts both.
- **Charting:** Apache ECharts with `{ renderer: 'svg' }` mandated project-wide — SVG everywhere for crisp pictures and trivial HTML-report inlining. Canvas permitted only as a per-chart escape hatch for in-app >10k-point overviews that don't appear in the HTML report.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Project = patlas (fork of vatlas) | Reuses vatlas's architectural mold (parser, aggregation engines, i18n, CI) remapped to Proxmox; faster bootstrap; the math has tests | ✓ Good (v1.0) |
| Web client, 100 % client-side | Preserves the vatlas privacy invariant; trends are handled by loading multiple reports together; nothing leaves the browser | ✓ Good (v1.0) |
| Proxmox report `.zip` / `.xlsx` ingestion | Matches the Proxmox report format; ZIP magic-byte sniff in the parser worker extracts `report.xlsx` from bundles | ✓ Good (v2.1.0 — `.zip` fix) |
| Guests = unified QEMU VMs + LXC containers (`guestType` flag) | Proxmox treats both as guests; UI segments by type | ✓ Good (v1.0) |
| Cluster pivot = Proxmox cluster name | Standalone node ⇒ implicit "proxmox" bucket; replaces multi-vCenter merge | ✓ Good (v1.0) |
| DR analysis dropped | No Proxmox analog in scope; removes stretched-cluster / fault-domain complexity | ✓ Good (v1.0) |
| Three Proxmox-native views are web-only | Snapshot Sprawl, Storage Content, Cluster Health have no clean PPTX/HTML-report analog — excluding them keeps exports focused and avoids incomplete deck slides | ✓ Good (v2.1.0) |
| Visual-first UX (charts/graphs as first-class) | Differentiates from vsizer's static-deck style; ECharts SVG renderer makes HTML-report inlining trivial | ✓ Good (v1.0) |
| Charting library = Apache ECharts via `echarts-for-react`, SVG renderer | ECharts ships treemap/sunburst/heatmap/calendar/gauge natively; SVG renderer makes the HTML-report inline-SVG path trivial | ✓ Good (v1.0) |
| HTML + PPTX both v1 | "The report is the product" — both formats are how the value leaves the app | ✓ Good (v1.0) |
| KISS / DRY / functional programming as binding engineering principles | Pure-function engines, immutable data, no premature abstractions, no domain classes; engines compose via small typed functions | ✓ Good (v1.0) |
| v2.0: amend ADR-0001 to allow a scoped, audited service worker | Offline/installable PWA requires a SW; ADR-0001 forbade SWs as a privacy attack surface. Exception is tightly bounded: injectManifest (own code), precache-only, same-origin, and `src/sw.ts` imports the privacy guard so cross-origin fetch throws inside SW scope too | ✓ Good (v2.0 — gate-enforced; installable PWA browser-confirmed) |

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
*Last updated: 2026-06-24 after **v2.1.0 milestone complete** (Proxmox-Native Views) — Snapshot Sprawl, Storage Content, Cluster Health views + `.zip` upload fix; inherited analytics relabeled to Proxmox; DR analysis removed. Prior: v2.0 (2026-05-20) — ADR-0001 SW exception + gate, installable offline PWA, one-column KPI-tile redesign + cluster table, Capacity Planning visual return, vatlas-grade native-chart PPTX deck. Prior: v1.0 (2026-05-19, 11 phases).*
