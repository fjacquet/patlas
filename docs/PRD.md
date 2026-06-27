# Product Requirements Document: patlas

**Status:** Current through v3.0 (feat/proxmox-atlas-v3)
**Document date:** 2026-06-27
**Sources reconciled:** `CLAUDE.md` (project constraints), `docs/ARCHITECTURE.md`, and the replan ADRs (`docs/adr/0020`, `0021`, `0022`). The shipped feature set reflects what is registered in `src/components/ViewToggle.tsx` and the `src/engines/aggregation/` directory.

---

## 1. Overview & Core Value

patlas is a 100% client-side web app that turns one or more Proxmox VE reports into a navigable, visual atlas of a Proxmox estate: a global dashboard, inventory tree views, allocation analysis, OS End-of-Support forecasting, in-session trends, RRD-based node headroom and storage growth analytics, protection and governance packs, storage-by-role segmentation, and Proxmox-native health views (Snapshot Sprawl, Storage Content, Cluster Health). It exports the result as a shareable HTML report and a PPTX deck. It is a fork of [vatlas](https://github.com/fjacquet/vatlas) (the VMware/RVTools sibling — historical fork provenance) and follows the same architectural mold (drop file in browser, see numbers, export, leave), with the domain remapped to Proxmox.

**Core value:** A user drops a Proxmox report and walks away with a polished, shareable HTML report and PPTX deck describing their Proxmox estate, without uploading a single byte. The report is the product.

Live app: **https://fjacquet.github.io/patlas/**

---

## 2. Goals & Non-Goals

### 2.1 Goals

- Accept the Proxmox report as a `.zip` bundle (contains `report.xlsx` + optional `network-diagram.svg`) or a bare `report.xlsx`. The upload zone accepts both.
- Parse the report off the main thread, with branded units that make MB-is-MiB and MHz-vs-GHz errors unrepresentable.
- Present a global cluster dashboard, navigable inventory at scale, rich per-cluster and per-node operational insights, a capacity-planning what-if lens, OS End-of-Support forecasting, and in-session multi-report trends.
- Provide three Proxmox-native views: Snapshot Sprawl (guest snapshot inventory), Storage Content (per-storage content-type breakdown + backup inventory), and Cluster Health (HA status + scheduled backup jobs).
- Produce a single self-contained shareable HTML report and a factual PPTX deck, both carrying numbers only (no editorial recommendations).
- Run entirely in the browser in English, French, German, or Italian, with light and dark themes, deployed publicly to GitHub Pages.

### 2.2 Non-Goals (explicit Out of Scope)

| Excluded | Reason |
|----------|--------|
| RVTools / Live Optics ingestion | Proxmox report is the only input format |
| Cross-session persistence (database / IndexedDB / OPFS / `localStorage` of dataset rows) | Breaks the privacy invariant — refresh = data gone |
| Backend / server / file upload | 100% client-side is a hard product invariant |
| Telemetry of parsed contents (even anonymous) | Same privacy invariant |
| Editorial recommendations in reports | patlas carries numbers only — narrative stays with the presenter |
| Real-time Proxmox API connection | The report file is the only input |
| Saved scenarios / accounts / shared dashboards | Requires backend, breaks privacy invariant |
| Mobile / touch-first UX | Large inventory tables are not a mobile use case |
| In-browser editing of inventory rows | The Proxmox report is the source of truth |
| Source-map upload in CI | Could leak repo internals |
| Service worker | Increases attack surface; no value for ephemeral data |
| Disaster-recovery / stretched-cluster analysis | No Proxmox analog in scope; removed from patlas |

---

## 3. Constraints

The binding tech stack, privacy invariant, and engineering principles are defined in `CLAUDE.md` (Project + Constraints sections) and detailed in `docs/ARCHITECTURE.md`. Summary:

- **Tech stack:** React 19, TypeScript (strict), Vite 8, Tailwind v4, Zustand 5, react-i18next (EN · FR · DE · IT), Zod (parser boundary only), SheetJS (`xlsx@0.20.3` from the official CDN tarball, not the CVE-affected npm package — ADR-0002), `fflate` (zip extraction), pptxgenjs ^4, Biome, Vitest + @testing-library/react, Apache ECharts 6 via `echarts-for-react` with the SVG renderer mandated project-wide and tree-shaken imports.
- **Privacy invariant (ADR-0001, ADR-0004):** No fetch ships report bytes; no telemetry of parsed contents; no `localStorage`/`IndexedDB`/`OPFS` of dataset rows. A runtime guard throws synchronously on any non-same-origin request; a CSP `connect-src 'self'` meta tag is defense in depth; a CI denylist blocks telemetry packages. Only `patlas-lang` and `patlas-theme` keys may write to `localStorage`. Refresh = data gone.
- **Units (ADR-0010):** Report "MB" values are read directly as MiB with no `* 1.048576` conversion. Branded `MiB`/`GiB`/`TiB`/`MHz`/`GHz` types enforce this at compile time.
- **Engineering principles (binding):** KISS, DRY, functional programming. Engines are pure functions (no React/DOM/Zustand; Zod only at the parser boundary). The Zustand store holds inputs only. `useEstateView` is the single `useMemo` bridge from store to UI/exports. No premature abstractions, no class hierarchies for domain logic, no copy-paste between phases.
- **Deploy target:** GitHub Pages static site at `fjacquet.github.io/patlas/`, via a CI pipeline running typecheck → lint → test → build → deploy on every push to `main`.
- **Input format:** Proxmox VE report as `.zip` bundle or bare `.xlsx`.

---

## 4. Functional Requirements by Area

### 4.1 Foundation, Parser, Units & Privacy — Phase 1 (Shipped)

- **FND-01..05:** 100% client-side at a public URL; drag-and-drop zone for one or more `.zip` or `.xlsx` files; full EN/FR/DE/IT i18n with auto-detect then toggle; light/dark theme; visible report capture-date indicator.
- **PAR-01..05:** Parsing in a Web Worker without blocking the UI; ZIP bundle extraction via `extractProxmoxBundle` (sniffs ZIP magic bytes, extracts `report.xlsx`; bare `.xlsx` parsed directly); clear error naming a missing sheet/column on schema mismatch; memory/storage fields preserved as MiB (no `* 1.048576`); refresh confirms data is gone.
- **PRV-01..03:** No non-same-origin request after load (runtime guard throws); CSP meta `connect-src 'self'`; no telemetry/analytics SDKs (denied at CI).

### 4.2 Aggregation & Global Dashboard — Phase 2 (Shipped)

- **DSH-01..06:** Global cluster dashboard, one column per cluster (nodes, guests by type — QEMU VM / LXC container, storage counts); estate-wide summary card; per-cluster physical/consumed GHz, mean CPU%/RAM%, vCPU allocation; OS-family breakdown at global and per-cluster level; three accounting modes (Configured / Active / Storage-realistic) with a visible toggle.
- **VIZ-01..03:** Crisp SVG charts at every zoom level (ECharts SVG renderer everywhere); chart families — stacked bar, donut, treemap, heatmap, calendar-heatmap, line, gauge, sparkline; consistent Midnight Executive theming.

### 4.3 Inventory Navigation — Phase 3 (Shipped)

- **INV-01..06:** Virtualised inventory tree (cluster → node → guest) responsive at scale; sortable/filterable tables for guests (unified QEMU + LXC with `guestType` flag), nodes, and storage pools; CSV export of the current filtered view; per-table column show/hide.

### 4.4 Multi-Cluster Merge — Phase 4 (Shipped, re-derived)

- **MVC-01..04:** Multiple Proxmox reports treated as one logical estate; visual suffix (no silent merge) on colliding cluster names; per-report cluster label and version in the report list.

Note: the former "Stretched Cluster" scope (STR-01..04) is removed. There is no Proxmox analog; all DR / stretched-cluster language is dropped.

### 4.5 Rich Cluster / Node Intelligence — Phase 5 (Shipped)

- **RCI-01..05:** Operational insights at estate and per-cluster scope — realized vCPU:pCPU overcommit, core-weighted average CPU%, node-mem-weighted average memory%, powered-on/off/suspended/template breakdown, provisioned-vs-in-use, storage footprint, guest data, total cores and node memory — every value calculated from parsed report columns, nothing invented; a dedicated Nodes view (estate rollup + expandable per-cluster node lists with factual version, model/vendor — no lifecycle verdict); an estate Operational Insights tile row on the dashboard; an em-dash sentinel for any metric that cannot be derived (never an invented 0).

### 4.6 Allocation / Capacity Planning — Phase 6 (Shipped, re-derived)

- **PLN-01:** A separate, explicitly-labelled "Capacity planning — what-if (planned)" surface, structurally distinct from the realized "measured" value.
- **PLN-02:** Planned CPU and RAM ratios via named preset buttons (CPU 1:1 / 4:1 / 8:1 / VDI 10:1; RAM same pattern) filling an editable numeric field; defaults CPU 4:1 / RAM 1:1; no slider widget.
- **PLN-03:** Planned ratios held in-memory only (Zustand inputs slice); no URL-hash codec, no `localStorage` — refresh = data gone.
- **PLN-04:** Planned what-if recomputes against physical cores (not hyperthreads) through the single `useEstateView` memo; the measured reference shown read-only with a "measured" qualifier — never conflated.

Note: the former DR Simulation scope (DRX-01..06) is removed. There is no Proxmox analog in scope.

### 4.7 OS End-of-Support Forecast — Phase 7 (Shipped)

- **EOS-01..06:** EOS forecast view with at-risk counts at +3/+6/+9/+12 months plus an "overdue" bucket; clickable buckets drilling into the affected guest list; nodes classified by build → support state; an "unknown OS" bucket for unmatched OS strings (not silently dropped); a `lastVerified` date on the EOS catalogue, refreshed at CI build time from endoflife.date.

### 4.8 In-Session Trends — Phase 8 (Shipped)

- **TRD-01..05:** Load 2–12 monthly Proxmox reports together and see headline metrics evolve; temporal X-axis using actual capture dates (not categorical labels); per-cluster sparklines on the dashboard when multiple reports are loaded; a delta panel showing what changed between consecutive reports; refresh confirms trends are gone (no cross-session persistence).

### 4.9 RRD Analytics, Protection & Governance Packs — Phase 9 (Shipped)

- **RRD-01..04 — RRD Analytics:** Node Headroom view (CPU / RAM peak, P95, average per node from RRD time-series) and Storage Growth view (storage time-to-full projection from RRD growth history). Only available when the cv4pve-report bundle includes RRD data.
- **PRO-01..04 — Protection Pack:** In-guest filesystem fill risk (FS utilisation from guest agent data), disk hygiene (old/orphaned disk detection), and backup coverage (per-guest backup recency status). Web-only view.
- **GOV-01..04 — Governance Pack:** cv4pve issues (parsed from the report issues sheet), access posture (API token + user audit), and resource pool analysis. Web-only view.
- **SBR-01..02 — Storage-by-Role:** Storage capacity segmented by role (VM data / backup / local) within the Storage view; real used vs configured capacity per role band.

### 4.10 HTML Report & PPTX Exports + Deploy — Phase 10 (Shipped)

- **HTM-01..05:** One-click download of a single self-contained `.html` file; opens offline with no JS execution required and crisp inline SVG charts; under 5 MB for a typical estate and under 15 MB for the largest supported (hard ceiling); contains cover, executive headlines, per-cluster, EOS forecast, trends, annex, methodology footer; factual numbers only (no editorial recommendations).
- **PPT-01..04:** One-click PPTX deck using the same neutral Midnight Executive palette; includes title, overview, per-cluster, EOS, trends, inventory summary; locale-formatted numbers (FR `,` with U+00A0 thousands separator, EN `.` with `,` thousands separator).
- **DEP-01..02:** Public access at `fjacquet.github.io/patlas/`; deploy is the result of a CI pipeline running typecheck → lint → test → build → deploy on every push to `main`.

### 4.11 Proxmox-Native Views — v2.1.0 (Shipped 2026-06-24)

These three views are **web-only** — deliberately excluded from the HTML report and PPTX deck.

- **SNP-01..04 — Snapshot Sprawl:** Guest snapshots still held on the estate: count, guests-with-snapshots, total size, oldest age. Parses the report `Snapshots` sheet; excludes the Proxmox `current` live-state marker.
- **STC-01..04 — Storage Content:** What occupies each storage, broken down by content type (images / rootdir / iso / vztmpl / backup …) and by storage, plus a backup-file inventory with per-guest recency. Parses the `Storage Content` sheet.
- **CLH-01..04 — Cluster Health:** HA status (quorum / fencing service state, HA-managed guest resources) and scheduled backup jobs. Parses the stacked composite `Cluster HA` / `Cluster` sheets via the shared `extractStackedSection` helper.

### 4.12 Requirement Status Summary

| Area | IDs | Status |
|------|-----|--------|
| Foundation / Parser / Privacy | FND-01..05, PAR-01..05, PRV-01..03 | Shipped |
| Aggregation / Dashboard / Viz | DSH-01..06, VIZ-01..03 | Shipped |
| Inventory Navigation | INV-01..06 | Shipped |
| Multi-Cluster Merge | MVC-01..04 | Shipped (re-derived; DR/Stretched removed) |
| Rich Cluster / Node Intelligence | RCI-01..05 | Shipped |
| Capacity Planning (what-if) | PLN-01..04 | Shipped (re-derived; old ALC/DRS retired) |
| Snapshot Sprawl | SNP-01..04 | Shipped |
| Storage Content | STC-01..04 | Shipped |
| Cluster Health (HA + backup jobs) | CLH-01..04 | Shipped |
| OS End-of-Support Forecast | EOS-01..06 | Shipped |
| In-Session Trends | TRD-01..05 | Shipped |
| RRD Analytics (Node Headroom + Storage Growth) | RRD-01..04 | Shipped |
| Protection Pack (FS fill risk, disk hygiene, backup coverage) | PRO-01..04 | Shipped |
| Governance Pack (issues, access posture, pools) | GOV-01..04 | Shipped |
| Storage-by-Role segmentation | SBR-01..02 | Shipped |
| HTML / PPTX Exports + Deploy | HTM-01..05, PPT-01..04, DEP-01..02 | Shipped |

---

## 5. Open Questions

No open requirements-blocking questions remain for the shipped scope. Future additions (if any) should follow the same discuss → spec → plan pattern.

---

## 6. References

- `CLAUDE.md` — Project + Constraints (binding tech stack, privacy invariant, engineering principles).
- `docs/ARCHITECTURE.md` — system architecture, engine spine, store and `useEstateView` design.
- `docs/adr/0001-privacy-invariant.md` — privacy invariant (runtime guard, CSP, CI denylist).
- `docs/adr/0002-sheetjs-xlsx-cdn-tarball-pin.md` — SheetJS tarball pin (CVE avoidance).
- `docs/adr/0004-no-localstorage-of-dataset-rows.md` — no persistence of dataset rows.
- `docs/adr/0010-rvtools-mb-as-mib.md` — cv4pve-report "MB" values treated as MiB (no `* 1.048576` conversion).
- `docs/adr/0020-allocation-ratio-is-calculated-not-selected.md` — allocation is calculated; planned lens is separate.
