# Requirements: vatlas

**Defined:** 2026-05-15
**Core Value:** A user drops one or more RVTools workbooks and walks away with a polished, shareable HTML report and PPTX deck describing their VMware estate — without uploading a single byte. The report is the product.

## v1 Requirements

### Foundation

- [x] **FND-01**: User loads the app at a public URL and the entire app runs 100 % client-side (no workbook bytes ever leave the browser)
- [x] **FND-02**: User sees a clear drag-and-drop zone for one or more RVTools `.xlsx` files on first load
- [x] **FND-03**: User can use the app entirely in French or English (i18n FR + EN, language auto-detected then user-toggleable)
- [x] **FND-04**: User can switch between a light and a dark visual theme
- [x] **FND-05**: User sees a visible "workbook capture date" indicator wherever data is displayed (header + footer of every export)

### Parsing

- [x] **PAR-01**: User drops an RVTools `.xlsx` file and the app parses it without blocking the UI (Web Worker)
- [x] **PAR-02**: User sees a clear error naming the missing sheet or column when a workbook does not match the RVTools schema
- [x] **PAR-03**: User can load workbooks from RVTools 3.10, 3.11, 4.0, and 4.4 — column-name drift is resolved transparently via an alias dictionary
- [x] **PAR-04**: User's workbook is parsed with all memory/storage fields preserved as MiB (no `* 1.048576` inflation — RVTools "MB" is MiB)
- [x] **PAR-05**: User can refresh the page and confirm the data is gone (no `localStorage` / `IndexedDB` / `OPFS` persistence of dataset rows)

### Global Dashboard

- [x] **DSH-01**: User sees a global vCenter dashboard with one column per cluster, showing counts of ESX, VMs (Windows / Linux / Other), datastores
- [x] **DSH-02**: User sees a global summary card with estate-wide totals (clusters, ESX, VMs, datastores, vCPU, vRAM, storage)
- [x] **DSH-03**: User sees per-cluster physical GHz, consumed GHz, mean CPU %, mean RAM %, vCPU allocation
- [x] **DSH-04**: User sees an OS-family breakdown (donut or stacked bar) at the global and per-cluster level
- [x] **DSH-05**: User sees CPU Ready % (from `vInfo.Overall Cpu Readiness`) where available — mean, max, count above the 5 % VMware-warning threshold
- [x] **DSH-06**: User sees three accounting modes (Configured / Active / Storage-realistic) with a visible toggle; defaults are sensible per metric

### Inventory Navigation

- [x] **INV-01**: User can navigate an inventory tree (vCenter → Datacenter → Cluster → ESX → VM) that stays responsive on estates with 10 000+ VMs
- [x] **INV-02**: User can view a sortable, filterable table of VMs with the columns RVTools provides
- [x] **INV-03**: User can view a sortable, filterable table of ESX hosts
- [x] **INV-04**: User can view a sortable, filterable table of datastores keyed on NAA/UUID (no double-count of shared LUNs)
- [x] **INV-05**: User can export the current filtered table view as CSV
- [x] **INV-06**: User can show/hide columns per table

### Multi-vCenter

- [ ] **MVC-01**: User drops multiple RVTools workbooks from different vCenters and the app treats them as one logical estate
- [ ] **MVC-02**: User sees a visual suffix (no silent merge) when two vCenters have identically-named clusters
- [ ] **MVC-03**: User's estate is keyed on `(VI SDK UUID, vm_bios_uuid)` so vMotion across vCenters is correctly deduplicated
- [ ] **MVC-04**: User sees each loaded snapshot's vCenter label and RVTools version in the snapshot list

### Stretched Clusters

- [ ] **STR-01**: User can toggle a cluster's "Étendu / Stretched" pill to mark it as a stretched cluster
- [ ] **STR-02**: User sees CPU and RAM reservation applied per-site (not a flat 50 %) when the cluster is asymmetric (e.g. 6+4)
- [ ] **STR-03**: User sees, factually, whether a stretched cluster's per-site split comes from real fault-domain data (Site A/B shown) or an assumed symmetric split — no high/medium/low verdict, no warning chip (UAT G1; the former low-confidence-chip requirement is retired/merged here)

<!-- Forward note (analytics-core replan): vSAN blank-`Cluster name` datastore
     attribution (vInfo VM→datastore→cluster relink) and full networks
     inventory (ports/switches) are deferred to Phase 9 — NOT Phase-4
     requirements. -->


### Rich Cluster / Host / ESX Intelligence (Phase 5 — analytics-core replan)

- [ ] **RCI-01**: User sees RVTools-Analyser-grade operational insights (realized vCPU:pCPU overcommit, core-weighted avg CPU %, host-mem-weighted avg memory %, powered-on/off/suspended/template breakdown, provisioned-vs-in-use, datastore footprint, guest data, total cores/host-memory) at BOTH estate scope and per-cluster — every value calculated from parsed RVTools columns, nothing invented
- [ ] **RCI-02**: User can open a dedicated one-window Hosts/ESX view (estate host-rollup + expandable per-cluster host lists) showing per-host capacity/utilization, ESXi version, fault domain, and host model/vendor as plain factual text (no lifecycle verdict)
- [ ] **RCI-03**: User sees the estate "Operational Insights" tile row on the dashboard alongside the shipped GlobalSummaryCard
- [ ] **RCI-04**: A metric that cannot be derived from the export (e.g. guest data when vPartition is absent) renders a factual em-dash sentinel, never an invented 0
- [ ] **RCI-05**: User clicks a dashboard cluster card and drills into a dedicated single-cluster detail screen showing that cluster's full metric set, laid out one-screen-fit (export-ready so Phase 10 = one PPTX slide per cluster), with a back affordance

### Allocated Resources

- [ ] **ALC-01**: User can adjust CPU and RAM allocation ratios via sliders, with named presets (1:1, 4:1, 8:1, VDI 10:1)
- [ ] **ALC-02**: User sees defaults of CPU 4:1 and RAM 1:1 on first load
- [ ] **ALC-03**: User's chosen ratios are encoded in the URL hash only (no `localStorage` persistence)
- [ ] **ALC-04**: User sees consolidation ratios calculated against physical cores (not hyperthreads)

### Disaster Recovery Simulation

- [ ] **DRS-01**: User can simulate the loss of one or more ESX hosts and see survivor cluster capacity
- [ ] **DRS-02**: User can simulate the loss of one or more entire clusters and see survivor estate capacity
- [ ] **DRS-03**: User can simulate the loss of one or more entire vCenters and see survivor estate capacity
- [ ] **DRS-04**: User sees an explicit assumptions panel listing what the sim DOES and DOES NOT model (HA admission control, anti-affinity, restart priority)
- [ ] **DRS-05**: User sees a `confidence` indicator and `caveats` array on every DR result
- [ ] **DRS-06**: User sees before/after numbers, evacuee totals, and per-survivor verdict for every DR scenario

### OS End-of-Support Forecast

- [ ] **EOS-01**: User sees an EOS forecast view with at-risk counts at +3, +6, +9, +12 months
- [ ] **EOS-02**: User sees an "overdue" bucket for VMs/hosts on already-EOS OSes (RHEL 7, Windows Server 2012 R2, ESXi 7.0, etc.)
- [ ] **EOS-03**: User can click a bucket to drill into the affected VM list
- [ ] **EOS-04**: User sees ESX hosts classified by build → support state, including patch-level and major-version EOS
- [ ] **EOS-05**: User sees an "unknown OS" bucket when a VM's OS string cannot be matched to the catalogue (rather than silently dropped)
- [ ] **EOS-06**: User sees a `lastVerified` date on the EOS catalogue (refreshed at CI build time from endoflife.date)

### In-Session Trends

- [ ] **TRD-01**: User can load 2–12 monthly RVTools snapshots together and see headline metrics evolve over time
- [ ] **TRD-02**: User sees a temporal X-axis (actual capture dates, not categorical labels) on every trend chart
- [ ] **TRD-03**: User sees per-cluster sparklines on the dashboard when multiple snapshots are loaded
- [ ] **TRD-04**: User sees a delta panel showing what changed between consecutive snapshots
- [ ] **TRD-05**: User can refresh the page and confirm trends are gone (no cross-session persistence)

### Visual UX (charts as first-class)

- [x] **VIZ-01**: User sees crisp SVG charts at every zoom level (Apache ECharts with `{ renderer: 'svg' }` everywhere)
- [x] **VIZ-02**: User sees the following chart families used throughout: stacked bar, donut, treemap (datastore footprint), heatmap (cluster × time), calendar-heatmap (EOS), line (trends), gauge (allocation), sparkline (per-row trend)
- [x] **VIZ-03**: User sees consistent theming (Midnight Executive palette) across all charts

### HTML Report Export

- [ ] **HTM-01**: User clicks one button and downloads a single self-contained `.html` file describing the estate
- [ ] **HTM-02**: User opens the exported HTML offline, with no JS execution required to view it, and sees crisp inline SVG charts
- [ ] **HTM-03**: User's HTML report is < 5 MB for a typical estate and < 15 MB for the largest supported (hard ceiling)
- [ ] **HTM-04**: User's HTML report contains: cover · executive headlines · per-cluster · EOS forecast · DR results · trends · annex · methodology footer
- [ ] **HTM-05**: User's HTML report carries factual numbers only — no editorial recommendations ("you should consolidate cluster X")

### PPTX Export

- [ ] **PPT-01**: User clicks one button and downloads a PPTX deck describing the estate
- [ ] **PPT-02**: User's PPTX uses the same neutral, brand-free Midnight Executive palette as vsizer
- [ ] **PPT-03**: User's PPTX includes: title · overview · per-cluster · CPU Ready annex (conditional) · EOS · DR · trends · inventory summary
- [ ] **PPT-04**: User's PPTX numbers are locale-formatted (FR `,` and U+00A0 thousands separator, EN `.` and `,` thousands separator)

### Privacy & Security

- [x] **PRV-01**: User's browser never makes a non-same-origin network request after the app is loaded (runtime `fetch`/`XHR`/`WS`/`Beacon` guard throws on any attempt)
- [x] **PRV-02**: User loads an app whose CSP meta tag is `connect-src 'self'`
- [x] **PRV-03**: User's app has no telemetry / analytics SDKs of any kind (Sentry, PostHog, Datadog, etc. denied at CI)

### Deployment

- [ ] **DEP-01**: User can access vatlas at the public URL `fjacquet.github.io/vatlas/`
- [ ] **DEP-02**: User's deploy is the result of a CI pipeline that runs typecheck → lint → test → build → deploy on every push to `main`

## v2 Requirements

### DR scenario presets

- **DR2-01**: User can pick a preset DR scenario from a menu ("lose largest cluster", "lose vCenter A", "lose left-side of stretched")

### Snapshot diff

- **DIF-01**: User can open a side-by-side comparison view showing what changed between any two loaded snapshots

### Estate treemap headline

- **TRM-01**: User sees an estate-wide treemap as a headline visual on the dashboard

### Cluster × time heatmap

- **HM2-01**: User sees a heatmap of clusters × time showing a chosen metric (CPU% / RAM% / VM count) when 3+ snapshots are loaded

### Multi-file `.zip` bundle ingestion

- **ZIP-01**: User can drop a `.zip` of multiple RVTools workbooks and the app parses them all

## Out of Scope

| Feature | Reason |
|---------|--------|
| Live Optics ingestion | RVTools-only is an explicit narrowing vs. vsizer; reduces parser surface |
| Cross-session persistence (DB / IndexedDB / OPFS / localStorage of rows) | Breaks the vsizer privacy invariant — refresh = data gone |
| Backend / server / file upload | 100 % client-side is a hard product invariant |
| Telemetry of parsed contents (even anonymous) | Same privacy invariant; reputation risk on operator-facing tools |
| Editorial recommendations in reports | Like vsizer, vatlas carries numbers only — narrative stays with the presenter |
| Real-time vCenter API connection | RVTools workbook is the only input; would re-introduce a network requirement |
| Right-sizing recommendation engine | RVTools snapshots lack peak-active data; unsound recommendations |
| Saved scenarios / accounts / shared dashboards | Requires backend, breaks privacy invariant |
| Mobile / touch-first UX | 10k+ row tables are not a mobile use case |
| In-browser editing of inventory rows | RVTools is source of truth; would invite drift |
| Source-map upload in CI | Could leak repo internals; no telemetry pipeline anyway |
| Service worker | Increases attack surface; offers no value for ephemeral data |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| FND-03 | Phase 1 | Complete |
| FND-04 | Phase 1 | Complete |
| FND-05 | Phase 1 | Complete |
| PAR-01 | Phase 1 | Complete |
| PAR-02 | Phase 1 | Complete |
| PAR-03 | Phase 1 | Complete |
| PAR-04 | Phase 1 | Complete |
| PAR-05 | Phase 1 | Complete |
| PRV-01 | Phase 1 | Complete |
| PRV-02 | Phase 1 | Complete |
| PRV-03 | Phase 1 | Complete |
| DSH-01 | Phase 2 | Complete |
| DSH-02 | Phase 2 | Complete |
| DSH-03 | Phase 2 | Complete |
| DSH-04 | Phase 2 | Complete |
| DSH-05 | Phase 2 | Complete |
| DSH-06 | Phase 2 | Complete |
| VIZ-01 | Phase 2 | Complete |
| VIZ-02 | Phase 2 | Complete |
| VIZ-03 | Phase 2 | Complete |
| INV-01 | Phase 3 | Complete |
| INV-02 | Phase 3 | Complete |
| INV-03 | Phase 3 | Complete |
| INV-04 | Phase 3 | Complete |
| INV-05 | Phase 3 | Complete |
| INV-06 | Phase 3 | Complete |
| MVC-01 | Phase 4 | Pending |
| MVC-02 | Phase 4 | Pending |
| MVC-03 | Phase 4 | Pending |
| MVC-04 | Phase 4 | Pending |
| STR-01 | Phase 4 | Pending |
| STR-02 | Phase 4 | Pending |
| STR-03 | Phase 4 | Pending |
| RCI-01 | Phase 5 | Pending |
| RCI-02 | Phase 5 | Pending |
| RCI-03 | Phase 5 | Pending |
| RCI-04 | Phase 5 | Pending |
| RCI-05 | Phase 5 | Pending |
| ALC-01 | Phase 4 | Pending |
| ALC-02 | Phase 4 | Pending |
| ALC-03 | Phase 4 | Pending |
| ALC-04 | Phase 4 | Pending |
| DRS-01 | Phase 4 | Pending |
| DRS-02 | Phase 4 | Pending |
| DRS-03 | Phase 4 | Pending |
| DRS-04 | Phase 4 | Pending |
| DRS-05 | Phase 4 | Pending |
| DRS-06 | Phase 4 | Pending |
| EOS-01 | Phase 5 | Pending |
| EOS-02 | Phase 5 | Pending |
| EOS-03 | Phase 5 | Pending |
| EOS-04 | Phase 5 | Pending |
| EOS-05 | Phase 5 | Pending |
| EOS-06 | Phase 5 | Pending |
| TRD-01 | Phase 6 | Pending |
| TRD-02 | Phase 6 | Pending |
| TRD-03 | Phase 6 | Pending |
| TRD-04 | Phase 6 | Pending |
| TRD-05 | Phase 6 | Pending |
| HTM-01 | Phase 7 | Pending |
| HTM-02 | Phase 7 | Pending |
| HTM-03 | Phase 7 | Pending |
| HTM-04 | Phase 7 | Pending |
| HTM-05 | Phase 7 | Pending |
| PPT-01 | Phase 7 | Pending |
| PPT-02 | Phase 7 | Pending |
| PPT-03 | Phase 7 | Pending |
| PPT-04 | Phase 7 | Pending |
| DEP-01 | Phase 7 | Pending |
| DEP-02 | Phase 7 | Pending |

**Coverage:**

- v1 requirements: 68 total (counted: FND 5 + PAR 5 + PRV 3 + DSH 6 + VIZ 3 + INV 6 + MVC 4 + STR 4 + ALC 4 + DRS 6 + EOS 6 + TRD 5 + HTM 5 + PPT 4 + DEP 2 = 68)
- Mapped to phases: 68 (final mapping, validated by roadmapper)
- Unmapped: 0

**Note:** The "56 total" figure in earlier drafts was a miscount — the actual v1 requirement total is **68**. Coverage remains 100 %.

---
*Requirements defined: 2026-05-15*
*Last updated: 2026-05-15 after roadmap creation — traceability finalized with 7-phase mapping*
