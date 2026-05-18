# Feature Research

**Domain:** VMware estate analytics web app (RVTools-only, 100 % client-side) — vatlas
**Researched:** 2026-05-15
**Confidence:** MEDIUM-HIGH (RVTools schema, EOS catalogue, DR methodology, viz patterns are
all well-documented in public sources; the precise paid feature matrix of the closed-source
reference tool "RVTools Analyser" by Ymsoft is partially LOW confidence — vendor docs are
behind login/paywall, so behaviour is inferred from public product listings + user reports.)

## Scope reminder

vatlas is a sibling of vsizer. The product invariants are inherited and **non-negotiable**:

- 100 % client-side (no upload, no telemetry, no `localStorage` of dataset rows)
- RVTools `.xlsx` only — no Live Optics, no `.zip` bundles in v1
- Reports are **factual** — numbers and forecasts, no editorial verdicts
- The deliverable is the product (shareable HTML + PPTX)

Every feature below is filtered through those invariants. Several common "table stakes"
features for capacity tools (e.g., real-time vCenter polling, recommendation engines,
saved scenarios across sessions) become **anti-features** for vatlas.

---

## Feature Landscape

### Table Stakes (Users Expect These)

VMware admins coming from RVTools Analyser, Aria Operations, Live Optics, or even
hand-rolled pivot tables expect the following. Missing any of these = "this is incomplete".

| # | Feature | Why Expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| 1 | Global vCenter dashboard, one column per cluster | Direct mirror of RVTools Analyser's headline screen; how VMware admins read their estate at a glance | MEDIUM | Rows: # ESX hosts, # VMs (and split by Windows / Linux / Other), # datastores, raw CPU GHz, raw RAM GB, used CPU%, used RAM%, vCPU allocation, allocation ratio. Driven entirely from vsizer's existing `engines/aggregation/perCluster.ts` plus new VM-OS classification. |
| 2 | Inventory tree: vCenter → Datacenter → Cluster → ESX → VM | Hierarchical mental model VMware admins use daily; matches vSphere Client navigation | MEDIUM-HIGH | At 10k+ VMs this must be virtualized. Use `@tanstack/react-virtual` for row virtualization (proven up to 50k+ rows, see Borstch/Medium). Expand-on-demand: don't render children until parent expanded. |
| 3 | Sortable, filterable tables per object class (VM list, ESX list, Datastore list) | RVTools strength is its tabular detail; users need to drill down and grep for one VM | MEDIUM | Reuse TanStack Table primitives. Filters: text contains, numeric range, OS family multiselect, power state. Column show/hide. CSV export of current filter is mandatory — admins always want "give me this list as a spreadsheet". |
| 4 | Datastore view (capacity, free, %used, # VMs, provisioning ratio) | Storage capacity is half of every capacity conversation | LOW-MEDIUM | RVTools `vDatastore` tab — `Capacity MiB`, `Free MiB`, `Provisioned MiB`, `In Use MiB`. Flag thin-provisioned overcommit and stores >85% used. |
| 5 | Multi-vCenter aggregation (load N RVTools workbooks, treat as one estate) | A real customer rarely has one vCenter; the question is always "show me all of them together" | MEDIUM | See §"Multi-vCenter merge semantics" below. Disambiguate by `VI SDK Server` (vCenter hostname/FQDN) and `VI SDK UUID` (globally unique 128-bit service instance UUID). RVTools 3.9.2+ adds both columns to every per-VM tab. |
| 6 | OS End-of-Support forecast with at-risk horizons (3/6/9/12 months) | Asset-lifecycle reporting is the second-most-asked question after capacity (Windows 2012/2016 unsupported, RHEL 7 unsupported, ESXi 6.7 EOGS) | MEDIUM | See §"OS EOS catalogue" below. Source: `endoflife.date` static JSON, bundled at build time, MIT-licensed. Classifier: regex on RVTools `OS according to the VMware Tools` field with fallback to `OS according to the configuration file`. |
| 7 | Allocated-resource calculation with configurable CPU and RAM ratios | Every assessment conversation includes "what if I assume 4:1 CPU consolidation, what's my real headroom?" | LOW | Default values: **CPU 4:1**, **RAM 1:1** (no overcommit) — see §"Allocation ratio defaults". User-tunable sliders, immediate recompute, persisted in URL hash only (not localStorage — respects privacy invariant). |
| 8 | DR / failover simulation: mark vCenter(s) or cluster(s) as failed, recompute survivor capacity | This *is* the value-add of an analytics tool over plain RVTools | MEDIUM-HIGH | See §"DR simulation methodology" below. Three modes: vCenter loss, cluster loss, host loss (N+1 / N+2). |
| 9 | Stretched-cluster awareness — "Étendu / Stretched" pill on a cluster reserves 50 % CPU + RAM | Already implemented in vsizer (ADR-0007); admins running stretched vSAN know they only have half their capacity available | LOW | Reuse `engines/aggregation/dr.ts` from vsizer wholesale. Pill is a per-cluster boolean toggle. Feeds the DR sim (a stretched cluster losing one site = predictable 50 % cap loss). |
| 10 | In-session trends across multiple monthly RVTools snapshots | RVTools Analyser advertises "evolution of Clusters / ESX / Datastores / VMs / vCPU / vRAM / Disks" — this is its USP over plain RVTools | MEDIUM-HIGH | User drops N workbooks; each tagged with a date (from filename, or workbook timestamp, or manual input). Line charts of headline metrics over time. Per-cluster sparklines on dashboard cards. **No DB — in-session only.** Reload = gone. |
| 11 | Visual-first UX (charts as first-class, not afterthought) | The reference tool's stated differentiator; aligns with vatlas's stated `Visual-first UX` requirement | MEDIUM | Charts to ship: stacked bar (per-cluster headcount), donut (OS family mix), treemap (datastore footprint by VM), heatmap (cluster × time for trends), line chart (trends), histogram (VM sizes). Library recommendation in STACK.md (ECharts via lazy import is the leading candidate). |
| 12 | HTML report export — single self-contained `.html` file | Stated requirement; aligns with "the report is the product" | MEDIUM-HIGH | See §"HTML report structure". Self-contained = inline CSS + inline base64 images for charts (rendered to PNG/SVG via the chart lib's export API). No external CDN refs (would break offline review). |
| 13 | PPTX export — same neutral, brand-free family as vsizer | Stated requirement; reuse the existing pptxgenjs deck builder shape | MEDIUM | Reuse vsizer's `engines/export/pptx/` style tokens (Midnight Executive palette, factual-only text per ADR-0003). vatlas's deck has more slides than vsizer's: title, estate overview, per-cluster (one slide each), EOS forecast, DR scenarios, trends. |
| 14 | Drag-and-drop multi-file upload | Same as vsizer; users expect "drop a folder full of monthly exports" to just work | LOW | Reuse `FileDropzone` from vsizer; allow `multiple`. Detect per-file the source vCenter via `VI SDK UUID`. |
| 15 | i18n FR + EN | Stated requirement, matches vsizer | LOW | Reuse vsizer's i18next scaffolding. New namespaces needed: `inventory`, `eos`, `dr`, `trends`, `report`. |
| 16 | Sortable tables that handle thousands of rows without freezing | Same scale as RVTools itself (which routinely produces 10k+ row workbooks) | MEDIUM | Use TanStack Table + TanStack Virtual. Sort/filter on the canonical row arrays in the store (Zustand selectors). Do not re-derive on every render; memoize. |
| 17 | CSV export of any visible table | RVTools users live in Excel; the escape hatch is non-negotiable | LOW | Reuse vsizer's `utils/csv.ts`. Export the current filter/sort, not the raw underlying. |
| 18 | Light + dark theme | Same as vsizer; modern web app baseline | LOW | Reuse vsizer's `useTheme` hook and `index.css` tokens. |

### Differentiators (vs RVTools Analyser and the wider field)

These are where vatlas can be **notably better** than the reference tool, not just a clone.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D1 | **Zero-install, zero-upload, browser-only** | RVTools Analyser is a Windows desktop app with a persistent local DB. vatlas runs in the browser, refresh = gone. For consultants who can't install software on client laptops, this is a game-changer. | LOW (inherited from vsizer) | The vsizer privacy story is already articulated; reuse the narrative on the upload screen and the README. |
| D2 | **OS EOS catalogue auto-refreshable at build time** | RVTools Analyser ships its EOS dates statically and updates require a software release. vatlas pulls from endoflife.date at CI build time → always-current dataset bundled with every deploy. | LOW | Add a `scripts/sync-eos-catalogue.ts` that fetches `endoflife.date/api/v1/products/{esxi,windows-server,windows,ubuntu,debian,rhel,sles,oraclelinux,alma,rocky,centos,centos-stream,amazon-linux}.json` and writes a single bundled JSON. Run at CI before `vite build`. |
| D3 | **At-risk horizon view: 3/6/9/12 months, with one-click drill to affected VMs** | RVTools Analyser shows EOS dates per-row. vatlas can show "32 VMs go unsupported in the next 90 days → click to see them" — that's the conversation that drives action. | LOW-MEDIUM | Compute classifications client-side from bundled EOS catalogue + parsed VM OS strings. The 3/6/9/12 buckets are pure date arithmetic on parsed canonical rows. |
| D4 | **DR scenario presets** ("lose largest cluster", "lose vCenter A", "lose left-side of stretched") plus custom multi-select | Aria Operations has rich what-if, RVTools Analyser has a paid DR sim. vatlas can offer one-click presets that match the questions executives actually ask. | MEDIUM | Each preset is a saved JSON-encoded selection; user can also pick checkboxes for arbitrary set. The preset library is a small enum, not user-savable (privacy invariant — no persistence). |
| D5 | **Per-cluster sparklines on the dashboard** when multiple snapshots are loaded | A heatmap calendar (à la GitHub contributions) and per-row sparklines together let you eyeball trend direction without leaving the global view. Aria does this; RVTools Analyser does not. | MEDIUM | Sparkline chart is tiny SVG, no axes. The dashboard cluster rows already exist; tack on a sparkline column when `snapshots.length > 1`. |
| D6 | **Self-contained shareable HTML report (single file, works offline)** | Aria's reports are HTML but reference its server. RVTools' export is .xlsx. vatlas's HTML can be emailed and reviewed on a plane. | MEDIUM-HIGH | Inline everything: CSS (Tailwind tree-shaken), images (base64), charts (rendered to inline `<svg>` or canvas-PNG). Use a separate "report builder" entry-point in the bundle that's not the dashboard. |
| D7 | **Side-by-side snapshot comparison** ("show me what changed between Jan and April") | Trends are one thing; *diff* is another. "12 new VMs, 3 powered-off, +480 GB allocated" is the natural follow-up question. | MEDIUM | Compute set differences over `(VI SDK UUID, VM UUID)` keys between two selected snapshots. Display as a "delta" panel: added / removed / changed VMs. |
| D8 | **Treemap of estate footprint** (VM → cluster → datacenter, sized by allocated RAM or storage) | A treemap reveals scale imbalances ("this one cluster is half the estate") that bar charts hide. ECharts supports it natively. | LOW-MEDIUM | One chart, depends on chart-lib choice (deferred to STACK.md). |
| D9 | **Cluster utilization heatmap (clusters × time)** | When you have N clusters and M snapshots, a heatmap shows the whole estate's trend direction at a glance. | MEDIUM | Y-axis = cluster, X-axis = snapshot date, cell color = CPU% or RAM%. Toggle metric. |
| D10 | **Explicit display of data freshness** (when was the RVTools export taken? show it prominently) | RVTools workbooks are point-in-time; presenting a 6-month-old export as current is a foot-gun. The reference tool buries this. | LOW | RVTools' `vSource` tab includes the run timestamp. Show it in the header, and on every export footer. |
| D11 | **Drop-zone validation that names which sheets/columns are missing** | Most "RVTools companion tools" silently fail on malformed inputs. Be explicit. | LOW-MEDIUM | Reuse vsizer's Zod-at-the-boundary pattern; surface the validation error in a `Toaster`. |
| D12 | **No editorial recommendations** (this *is* the differentiator vs Aria/Live Optics) | vsizer ADR-0003 — match it. The deck/report carries numbers, never "you should consolidate cluster X". The narrative is the consultant's job. | LOW | Cultural — enforce in copy review, lint i18n strings for "recommend / should / poor / good". |

### Anti-Features (Commonly Requested, Often Problematic)

| # | Anti-Feature | Why Requested | Why Problematic | Alternative |
|---|--------------|---------------|-----------------|-------------|
| A1 | **Real-time vCenter API connection / "just connect to my vCenter"** | "Why do I have to run RVTools? Just talk to my vCenter directly." | Breaks every product invariant: requires a backend (creds in browser are unsafe), requires network egress, requires per-user firewall holes, kills the 100% client-side privacy story. Also: vCenter API surface is huge and version-specific. RVTools already does this well. | Keep RVTools-only. The split of concerns ("RVTools collects, vatlas analyzes") is a feature, not a limitation. |
| A2 | **Persisted scenarios / saved dashboards / user accounts** | "I want to come back tomorrow and see the same view." | Requires a DB, login, hosting → server-side state. Breaks privacy invariant. Drives the product toward Aria Operations' shape, which is not the niche. | URL-hash-encoded scenario state (shareable link, but no server-side store). Or: tell the user to re-drop the workbooks; the import takes seconds. |
| A3 | **Editorial recommendations ("you should consolidate", "this cluster is over-provisioned")** | "Just tell me what to do." | (a) The model would be wrong half the time without context. (b) It demotes the speaker/consultant — the narrative *is* their value-add. (c) ADR-0003 in vsizer already rejected this for the same reason. | Show the numbers and the forecasts. Let the presenter interpret. |
| A4 | **Telemetry / "anonymous usage stats"** | "It would help us improve the product." | Even anonymous telemetry of parsed *contents* breaks the privacy invariant. The user might be surveying a regulated estate. | Zero telemetry. Reuse vsizer's CSP-locked posture and the "open DevTools, watch Network, see nothing" demo. |
| A5 | **Live Optics ingestion** | "We already use Live Optics, just take that too." | Doubles the parser surface; adds source-detection branches; ambiguous joins where RVTools and Live Optics overlap with different field names. vsizer carries this complexity precisely because vsizer needs it; vatlas has chosen scope reduction. | RVTools-only, hard scope line. Tell Live Optics users to use vsizer (which already supports it) for the deck. |
| A6 | **Multi-file `.zip` bundle support** | "I have a folder of monthly exports as a zip." | Trivial unzipping logic, but multiplies the "what file did this row come from?" identity-tracking problem; introduces a path-encoded ordering question; adds JSZip to the bundle. Out of scope for v1 per PROJECT.md. | Multi-file drop (multiple `.xlsx` at once) covers the same use case without the unzip code. |
| A7 | **In-browser editing of inventory rows** | "I want to fix the OS classification for this one VM" | Mutating parsed data drifts vatlas away from "the workbook is the source of truth" into "now we have local edits to track". Persistence problem (privacy) + provenance problem (where did this row come from?). | Keep RVTools as source of truth. If the OS classification is wrong, the fix is on RVTools / vCenter side. Surface "unknown OS" as a bucket so the user can see the gap. |
| A8 | **Cross-session persistence (IndexedDB / OPFS) for "convenience"** | "Don't make me re-drop the files every time." | Even for "just convenience", this changes the trust posture. Once data is at rest in the browser, it can be exfiltrated by any XSS, picked up by browser sync, etc. PROJECT.md explicitly rejects it. | Make re-importing fast (parse is already <2s for typical workbooks). |
| A9 | **Recommendation engine for right-sizing VMs** | "Tell me which VMs to shrink." | Requires performance data (CPU Ready, %RDY, %CSTP, peak active memory over time) that RVTools snapshots *don't* contain — only `Overall Cpu Readiness` at the moment of export. Recommendations from snapshot data would be misleading. | Surface allocation vs theoretical capacity. Let humans decide what to right-size. |
| A10 | **Mobile / touch-first UX** | "Can I view this on my iPad?" | Inventory tables of 10k+ rows are not a mobile use case. Optimizing for it costs significant layout work for no real audience. | Desktop-first responsive (works on iPad in landscape if needed). PPTX/HTML exports are the mobile-friendly surface. |
| A11 | **Built-in vCenter capacity recommendations à la Aria** | "Show me how many more VMs I can fit." | Requires a sizing model that depends on the customer's workload mix, RVTools snapshots don't capture peak. | Surface raw allocation, raw consumption, configurable ratios. The user runs the "what if" by changing the ratio. |

---

## OS EOS Catalogue — Source, Format, Licensing

**Recommended source:** [`endoflife.date`](https://endoflife.date/) — community-maintained,
covers 380+ products, **MIT-licensed** (verified via the [GitHub repo
README](https://github.com/endoflife-date/endoflife.date)) — usable in a commercial project,
attribution is courteous but not legally required.

**API shape:** Static JSON, generated by Jekyll at build time (see [DeepWiki API
notes](https://deepwiki.com/endoflife-date/endoflife.date/6-api-and-data-access)). The v1
endpoints we care about:

```
https://endoflife.date/api/v1/products/esxi.json
https://endoflife.date/api/v1/products/windows-server.json
https://endoflife.date/api/v1/products/windows.json
https://endoflife.date/api/v1/products/ubuntu.json
https://endoflife.date/api/v1/products/debian.json
https://endoflife.date/api/v1/products/rhel.json
https://endoflife.date/api/v1/products/sles.json
https://endoflife.date/api/v1/products/oraclelinux.json
https://endoflife.date/api/v1/products/almalinux.json
https://endoflife.date/api/v1/products/rocky-linux.json
https://endoflife.date/api/v1/products/centos.json
https://endoflife.date/api/v1/products/centos-stream.json
https://endoflife.date/api/v1/products/amazon-linux.json
```

Each product returns a `releases[]` array; each release has at least:
`name`, `releaseDate`, `eolFrom` / `eol`, `latest`, `lts` (bool), `extendedSupport` (date or
bool, where applicable). Confidence: HIGH for shape (verified via Swagger docs at
[endoflife.date/docs/api/v1/](https://endoflife.date/docs/api/v1/)).

**Important caveat:** The API is officially in **Beta** as of mid-2026 (see [issue

# 2066](<https://github.com/endoflife-date/endoflife.date/issues/2066>)). Breaking changes are

possible. **Mitigation:** vatlas bundles a *snapshot* of the JSON at CI build time
(`scripts/sync-eos-catalogue.ts`) rather than fetching at runtime. This:

1. Removes the runtime network dependency (privacy: no fetch when the user runs vatlas).
2. Pins the schema to what the CI script validates against (Zod schema).
3. Makes vatlas usable offline.
4. Means EOS data refreshes when vatlas is redeployed — once a month is plenty for EOS.

**ESXi specifics (verified, HIGH confidence):**

| ESXi | End of General Support |
|------|------------------------|
| 6.5  | 2022-10-15             |
| 6.7  | 2022-10-15             |
| 7.0  | 2025-10-02             |
| 8.0  | 2027-10-11             |

Source: [endoflife.date/esxi](https://endoflife.date/esxi), corroborated by
[Broadcom KB 326984](https://knowledge.broadcom.com/external/article/326984/end-of-general-support-for-vsan-656667.html).

**Classifier strategy for VM OS rows:** Use `OS according to the VMware Tools` (more
reliable: detected from running guest tools) with fallback to `OS according to the
configuration file` (the configured guest OS type, which can be stale or wrong if the guest
was reinstalled without updating vCenter). When both are present and disagree, prefer Tools
and surface a "OS mismatch" flag on that VM row — that's already a useful audit signal.

---

## Multi-vCenter Merge Semantics

**The columns that disambiguate:**

| RVTools column | Type | Role |
|----------------|------|------|
| `VI SDK Server` | string (FQDN or IP) | The vCenter the data was pulled from. Human-readable. Present on every per-VM tab since RVTools 3.9.2. |
| `VI SDK UUID` | string (128-bit hex GUID) | **Globally unique identifier of the vCenter service instance.** This is the right primary key for "which vCenter". |
| `VM UUID` (a.k.a. "VirtualCenter-specific 128-bit UUID") | string (128-bit hex GUID) | **Globally unique VM identity** assigned by vCenter (not the SMBIOS UUID, which can be duplicated across templated VMs). Present since RVTools 3.9.2. |

Sources: [Yellow Bricks 3.9.2 changelog](https://www.yellow-bricks.com/2017/03/03/cool-tool-update-rvtools-3-9-2/),
[virtual-allan.com 3.9.2](https://www.virtual-allan.com/rvtools-3-9-2-released/),
[James Delaney's multi-vCenter approach](https://jamesdelaney.co.uk/blog/2021/02/10/vmware-rvtools-to-excel-for-multiple-vcenters/).

**Canonical row identity for merge:** `(VI SDK UUID, VM UUID)` is the global PK for VMs.
`(VI SDK UUID, ESX Host)` for hosts. `(VI SDK UUID, Cluster name)` for clusters.

**Merge conflicts to handle:**

1. **Same vCenter, multiple snapshots.** Same `VI SDK UUID` across files → treat as
   *trend data*, not aggregation. Tag each file with a snapshot date (from filename, from
   the `vSource` sheet's run timestamp, or from a user-provided date input).
2. **Different vCenters, same snapshot date.** Different `VI SDK UUID` → aggregate as one
   logical estate. Top-level navigation shows a vCenter selector ("All / vCenter A / B").
3. **Cluster name collision across vCenters.** "Prod-Cluster-01" exists in both vCenter A
   and B. **Disambiguate visually** with the vCenter name in the tree (`A > Prod-Cluster-01`,
   `B > Prod-Cluster-01`); never silently merge them.
4. **VM UUID collision across vCenters** (extremely rare but possible if a VM was migrated
   between vCenters via cold-clone). `(VI SDK UUID, VM UUID)` PK handles it — show as two
   distinct rows under their respective vCenters.
5. **Missing `VI SDK UUID` column** (RVTools pre-3.9.2 exports). Fallback: derive a pseudo-key
   from filename + index. Surface a "this file has no VI SDK UUID, multi-vCenter merge may
   produce odd results" warning at upload.
6. **Datastore shared across vCenters via Linked Mode** (the datastore appears in both
   workbooks). De-duplicate by `(Datastore Name, Capacity, URL)` if available; otherwise
   show as separate entries with a "possible duplicate" flag.

**Snapshot-date inference order:**

1. Explicit user input on upload (per-file date picker).
2. Parse the filename for an ISO date (`RVTools_2026-04-15.xlsx`).
3. Read the workbook's `vSource` tab — RVTools writes the run timestamp there.
4. Fall back to file's `lastModified`.
5. Last resort: ordinal order in upload list.

---

## DR Simulation Methodology

**Standard VMware DR practice (HIGH confidence, sourced from
[Broadcom techdocs vSphere HA Admission Control](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/vsphere-availability/creating-and-using-vsphere-ha-clusters/vsphere-ha-admission-control.html)
and [vSAN Stretched Cluster Guide](https://www.vmware.com/docs/vsan-stretched-cluster-guide)):**

vSphere HA has three admission control policies that map directly onto the simulation
modes vatlas needs to support:

1. **Host Failures Cluster Tolerates (slot-based)** — "N+1 / N+2". Reserves capacity
   equivalent to losing the largest N hosts. Most common policy in non-stretched clusters.
2. **Percentage of Cluster Resources Reserved** — explicit % CPU and % RAM reservation.
   Default 25 %/25 %, **always 50 %/50 % on stretched clusters** (Broadcom guidance).
3. **Specify Failover Host** — dedicated standby host(s). Less common.

**vatlas's three simulation modes (mapping to the user's stated requirements):**

### Mode 1 — Host loss within a cluster (N+1 / N+2)

User selects a cluster and a number of hosts to remove. vatlas:

1. Subtracts the lost hosts' GHz and RAM from the cluster's physical capacity.
2. Recomputes utilization ratios against survivor capacity.
3. Flags survivors that go over their configured threshold (default 80 %) — surface as
   warning rows, *not* as recommendations.
4. For stretched clusters, the host-loss simulation respects the 50 % reservation already
   subtracted by vsizer's existing `dr.ts` engine; losing one site = predictable outcome.

### Mode 2 — Cluster loss (full cluster down)

User checks one or more clusters; vatlas:

1. Marks every VM on those clusters as "to be evacuated".
2. Sums their vCPU / vRAM allocation.
3. Tries to fit them onto the remaining clusters (FIT calculation):
   - Compares total allocated vCPU+vRAM of evacuees vs total survivor headroom.
   - Reports YES/NO plus per-surviving-cluster delta.
4. Does **not** attempt a real placement algorithm (DRS does that at runtime; faking it
   here is misleading). Just the headroom arithmetic.

### Mode 3 — vCenter loss (one whole vCenter down)

Same as Mode 2 but the selection is "all clusters under vCenter X". Useful when the user
wants to model whole-site DR.

### Bonus: Stretched-cluster split-brain ("lose left side")

For a stretched cluster, the user picks which site fails. vatlas treats the half-cluster
as a "cluster loss" inside the same stretched cluster — the 50 % reservation already
accounted for this; the simulation result for a correctly-sized stretched cluster should
be "still OK" at 100 % survivor utilization.

**Expected output of every DR simulation:**

- Survivors' CPU %, RAM %, vCPU allocation ratio **before** and **after** the failure
- Total evacuees (VM count, vCPU sum, vRAM sum, disk sum)
- Per-survivor-cluster delta cards
- Verdict cell per survivor: `OK` / `OVER 80% CPU` / `OVER 80% RAM` / `OVER allocated`
- A factual sentence: "Failing [X] removes [Y] GHz / [Z] GB; survivors absorb at [n%] CPU,
  [m%] RAM." — **no recommendation**.

**Dependency:** DR sim **depends on** stretched-cluster awareness (the pill toggle) because
a stretched cluster's effective capacity is already reduced by 50 %. Without the pill,
the sim would over-report headroom for stretched setups.

---

## Allocation Ratio Defaults

Sourced from [VMware's vCloud Architecture Toolkit
§5.8](https://download3.vmware.com/vcat/vmw-vcloud-architecture-toolkit-spv1-webworks/Core%20Platform/Architecting%20a%20vSphere%20Compute%20Platform/Architecting%20a%20vSphere%20Compute%20Platform.1.019.html),
[Broadcom blog "vCPU-to-pCPU Ratio
Guidelines"](https://blogs.vmware.com/cloud-foundation/2025/06/04/vcpu-to-pcpu-ratio-guidelines/),
and [Heroix vCPU Over-allocation guide](https://www.heroix.com/blog/vmware-vcpu-over-allocation/).

| Workload | vCPU:pCPU CPU ratio | RAM overcommit | Confidence |
|----------|---------------------|----------------|------------|
| **Server / mixed** (vatlas default) | **4 : 1** | **1 : 1** (no overcommit) | HIGH |
| Light server (web tier, idle DR site) | 6 : 1 to 8 : 1 | 1 : 1 to 1.2 : 1 | HIGH |
| Heavy server (DB, ERP, large CPU-bound) | 1 : 1 to 2 : 1 | 1 : 1 | HIGH |
| VDI | 6 : 1 to 10 : 1 | 1 : 1 to 1.5 : 1 (TPS-aware) | MEDIUM |

**vatlas defaults:** CPU 4:1, RAM 1:1. UI offers sliders (1:1 → 12:1 CPU, 1:1 → 2:1 RAM)
with named presets ("Conservative 1:1", "Standard 4:1", "Aggressive 8:1", "VDI 10:1").

**The metric that proves you're at the right ratio is CPU Ready** (already pulled from
RVTools' `Overall Cpu Readiness` per ADR-0012 in vsizer). vatlas should display CPU Ready
contextually next to the allocated-ratio panel — "you're at 6:1 with 1.2 % mean CPU Ready,
you have room" — but **without** translating it into a recommendation (anti-feature A3).

---

## Trends Visualization Patterns

User has dropped N monthly snapshots. What's the right visual?

| Pattern | Best for | Use in vatlas | Confidence |
|---------|----------|---------------|------------|
| **Per-cluster sparklines** in the dashboard table | At-a-glance trend direction for many clusters simultaneously | YES — one tiny SVG per row, no axes, color = mean CPU% or growth direction | MEDIUM |
| **Line chart, multi-series** (one line per cluster, X = date, Y = metric) | Comparing a handful of clusters' evolution | YES — on the "Trends" view, with a series selector (cap at 12 visible to avoid spaghetti) | HIGH |
| **Calendar heatmap** (date × cluster, cell = metric) | Spotting which cluster/date crossed a threshold | YES — but as a secondary view ("heatmap" toggle on Trends); primary view is line chart. Sourced from common practice for time-series-with-categories (see [Columbia time-series heatmaps](https://www.columbia.edu/~sg3637/blog/Time_Series_Heatmaps.html)) | MEDIUM |
| **Stacked area** (estate-wide VM count over time, broken by OS family) | Telling the "Windows 2012 problem is shrinking" story over a year | YES — on the EOS trends panel | HIGH |
| **Delta panel** (Snapshot A vs Snapshot B side-by-side numbers) | Answering "what changed between two months" precisely | YES — as differentiator D7 | HIGH |
| Animated transitions between snapshots | Demo-friendly but rarely useful for analysis | NO — anti-pattern, drives attention away from the numbers | HIGH |
| Real-time auto-refresh | Streaming data UIs | NO — vatlas data is by definition static snapshots | HIGH |

**Snapshot count practical bounds:** 2 = required minimum to show trends. ~12 = sane upper
bound (one year of monthly exports). Beyond that, sparklines/line charts become illegible
and the user should subsample.

**Headline trend metrics (mirror RVTools Analyser's own list, since users expect it):**

# Clusters, # ESX, # Datastores, # VMs (and per-OS-family), total vCPU allocated, total

vRAM allocated, total disk allocated.

---

## HTML Report Structure

Reference points: [WWT VCF Technical
Assessment](https://www.wwt.com/assessment/vmware-cloud-foundation-technical), [ReadyWorks
Rapid Discovery Framework](https://www.readyworks.com/blog/vmware-migration-assessment-in-2-weeks-a-rapid-discovery-framework),
plus Live Optics AIR report shape.

**Recommended section order for vatlas's HTML report:**

1. **Cover** — project name (user input), estate fingerprint (#vCenters / #clusters /
   #ESX / #VMs), generation date, snapshot date(s). Neutral palette (Midnight Executive
   like vsizer's PPTX).
2. **Executive headlines** — 4-to-6 KPI tiles: total physical CPU/RAM, % used, # VMs at
   risk of EOS in 12 months, # clusters over 80 %, # stretched clusters. No verbs, no
   adjectives.
3. **Per-cluster summary** — one mini-card per cluster (same data as dashboard row,
   inlined). Charts inline as SVG.
4. **OS EOS forecast** — table per family (Windows / Linux / ESX), with the 3/6/9/12-month
   buckets. Each row hyperlinks to the affected VMs list lower in the report.
5. **DR simulation results** (only if the user ran one) — chosen scenario, before/after
   table, evacuee summary.
6. **Trends** (only if multiple snapshots were loaded) — line chart of headline metrics,
   delta panel between first and last snapshot.
7. **Detailed inventory annex** — every VM, paginated. Optional; off by default for short
   reports.
8. **Methodology footer** — "data source: RVTools workbook X, taken on Y. CPU ratio
   assumption: 4:1. RAM: 1:1. Stretched-cluster reservation: 50 %." Provenance is
   non-negotiable for any shareable report.

**Polish requirements (matches "report is the product" philosophy):**

- Single `.html` file, fully self-contained (inline CSS, inline base64 images, inline SVG
  charts).
- Print-friendly via CSS `@media print` rules (page breaks between sections).
- Works fully offline (no CDN refs, no external fonts beyond `system-ui` stack).
- File size budget: <5 MB for a typical 5k-VM estate (achievable with SVG charts + gzip).
- No JavaScript in the exported HTML (it's a report, not an app — readers should be able
  to open it in any browser, including ones with JS disabled).

**Anti-pattern to avoid:** Don't generate a Word .docx — it triggers an Office install
expectation, fights with formatting, and isn't shareable in the same way HTML is. PPTX
already covers the "needs Office" persona.

---

## Inventory Tree UX (Cluster → ESX → VM)

**Scale assumption:** Real RVTools workbooks routinely have 5k–20k VMs, 50–500 ESX hosts,
10–50 clusters. Naive `<table>` rendering kills the browser at this scale.

**Reference patterns:**

- [TanStack Virtual + TanStack Table](https://medium.com/@ashwinrishipj/building-a-high-performance-virtualized-table-with-tanstack-react-table-ced0bffb79b5)
  — proven up to 50k rows, sort/filter/pinning all still smooth. **This is the path.**
- [Material React Table V3 row virtualization
  example](https://www.material-react-table.com/docs/examples/row-virtualization) — same
  pattern, alternative wrapper.

**Recommended UX:**

1. **Virtualized rows** — only render visible rows + small overscan buffer. `@tanstack/react-virtual`.
2. **Lazy children expansion** — clusters render their hosts only when expanded; hosts
   render their VMs only when expanded. Don't fold the whole tree into a flat 20k-row list
   eagerly.
3. **Server-side-style search bar** but client-side — debounced text input that filters
   across all rows by name/OS/IP. Recompute filtered list as memoized selector.
4. **Multi-column sort** — primary + secondary sort, click headers to toggle.
5. **Column show/hide menu** — RVTools' `vInfo` sheet has 50+ columns; vatlas's default
   should be ~8 columns, with the rest opt-in.
6. **Sticky header + sticky first column** — name/identifier always visible while scrolling.
7. **Row hover preview** — quick popover with key fields (OS, RAM, vCPU, datastore,
   provisioning) without leaving the tree.
8. **Power state, OS family, EOS status as filter chips** at the top.

**vSphere Client visual language** — admins are used to it. Use the same iconography
intuition (folder for datacenter, four-host icon for cluster, single-host for ESX,
machine for VM) even if implemented with simple SVG.

---

## Feature Dependencies

```
[1: Global dashboard]
  └─ depends on ─▶ [parser: vsizer's RVTools adapter, reused]
  └─ depends on ─▶ [aggregation: vsizer's perCluster.ts, reused]

[5: Multi-vCenter merge]
  └─ depends on ─▶ [parser must surface VI SDK UUID + VM UUID columns]
  └─ feeds ─▶ [1: dashboard with vCenter selector]
  └─ feeds ─▶ [8: DR sim across vCenters]
  └─ feeds ─▶ [10: trends]

[6: OS EOS forecast]
  └─ depends on ─▶ [bundled endoflife.date catalogue at CI build time]
  └─ depends on ─▶ [OS classifier on `OS according to the VMware Tools` column]
  └─ feeds ─▶ [12: HTML report EOS section]
  └─ feeds ─▶ [13: PPTX export EOS slide]

[7: Allocation ratios]
  └─ feeds ─▶ [1: dashboard "allocation ratio" column]
  └─ feeds ─▶ [8: DR sim verdict computation]

[9: Stretched-cluster pill]
  └─ ALREADY EXISTS in vsizer (ADR-0007)
  └─ feeds ─▶ [8: DR sim must subtract 50 % reservation first]

[8: DR sim]
  └─ depends on ─▶ [9: stretched-cluster handling] (must subtract reservation)
  └─ depends on ─▶ [5: multi-vCenter merge] (for "lose vCenter X" mode)
  └─ depends on ─▶ [7: allocation ratios] (verdict thresholds)
  └─ feeds ─▶ [12: HTML report DR section]
  └─ feeds ─▶ [13: PPTX export DR slides]

[10: Trends]
  └─ depends on ─▶ [parser tagging each file with a snapshot date]
  └─ depends on ─▶ [5: VI SDK UUID for cross-snapshot identity stability]
  └─ feeds ─▶ [D5: sparklines on dashboard]
  └─ feeds ─▶ [D7: snapshot delta panel]
  └─ feeds ─▶ [D9: cluster-time heatmap]
  └─ feeds ─▶ [12: HTML report trends section]

[12: HTML report]
  └─ depends on ─▶ everything else (it's the synthesis surface)

[13: PPTX export]
  └─ depends on ─▶ vsizer's pptx engine (reused)
  └─ structurally similar to [12] but format-constrained
```

### Critical dependency notes

- **DR sim cannot land before stretched-cluster handling lands.** Stretched-cluster is
  already done in vsizer; the work is to surface the pill in vatlas's UI and feed it
  into the new DR sim engine. Order: pill UI → DR sim.
- **Trends cannot land before multi-vCenter merge has stable identifiers.** Without
  `(VI SDK UUID, VM UUID)` keys, "is this the same VM in two snapshots?" is unanswerable.
  Order: merge → trends.
- **HTML and PPTX reports are co-equal, but PPTX is simpler** (vsizer already has the
  engine and the palette). Order if forced: PPTX first (proves data shape), HTML second
  (consolidates into the shareable artifact).
- **EOS forecast is independent of multi-vCenter and DR** — it's a pure VM-row
  classification. Can land early and ship value standalone.

---

## MVP Definition

### Launch With (v1 — the stated v1 must-haves, ordered for delivery)

A defensible MVP that delivers the stated PROJECT.md value in roughly this build order:

1. **[1] Single-vCenter dashboard (one workbook)** — reuse vsizer's parser + aggregation.
2. **[3, 4] Sortable VM / ESX / Datastore tables** — TanStack Table without virtualization
   yet, prove the data shape end-to-end.
3. **[2] Cluster → ESX → VM tree** with virtualization (TanStack Table + TanStack Virtual).
4. **[7] Allocation ratio sliders** with defaults 4:1 CPU / 1:1 RAM.
5. **[9] Stretched-cluster pill** — port from vsizer.
6. **[6] OS EOS forecast** with 3/6/9/12-month buckets. Build the
   `scripts/sync-eos-catalogue.ts` first; bundle the JSON.
7. **[5] Multi-vCenter merge** — disambiguate by `VI SDK UUID`; tree shows vCenter as
   top level.
8. **[8] DR simulation** — three modes (host, cluster, vCenter loss). Stretched-cluster-aware.
9. **[10] In-session trends** — same-vCenter multiple snapshots; line chart + delta panel.
10. **[13] PPTX export** — reuse vsizer's deck builder shape; add the new section slides.
11. **[12] HTML report export** — the synthesis surface; comes last so it can include every
    feature above.
12. **[15] i18n FR + EN** — woven through from the start (i18next keys go in as each UI
    string is written, not retrofitted).
13. **[11, D8, D9] Visual-first polish** — treemap of estate, heatmap of cluster×time,
    sparklines on dashboard.

### Add After Validation (v1.x)

- **[D4] DR scenario presets** ("lose largest cluster" etc.) — easy once DR sim engine
  is solid.
- **[D7] Two-snapshot side-by-side diff view** — natural extension of trends, but the
  UX is its own design problem (what's the right way to show added/removed/changed?).
- Multi-file `.zip` bundle support (if a real user asks; otherwise stay out-of-scope).
- More OS distros in the EOS catalogue as users hit gaps.
- Richer drill-down filters (provisioning ratio, snapshot count per VM, orphaned VMDKs).

### Future Consideration (v2+)

- **Saved scenarios encoded in URL hash** (no server, but shareable links).
- **Comparison against an industry baseline** ("your vCPU:pCPU ratio is at the 60th
  percentile of similar estates") — would require building a baseline dataset, non-trivial.
- **Plugin architecture for custom calculators** — only if real demand emerges; otherwise YAGNI.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| [1] Global dashboard, one column per cluster | HIGH | LOW (reuse vsizer) | **P1** |
| [2] Inventory tree (cluster→ESX→VM, virtualized) | HIGH | MEDIUM-HIGH | **P1** |
| [3] Sortable tables (VM/ESX/Datastore) | HIGH | MEDIUM | **P1** |
| [4] Datastore view | HIGH | LOW-MEDIUM | **P1** |
| [5] Multi-vCenter merge | HIGH | MEDIUM | **P1** |
| [6] OS EOS forecast (3/6/9/12 months) | HIGH | MEDIUM | **P1** |
| [7] Allocation ratios w/ sliders | HIGH | LOW | **P1** |
| [8] DR simulation (3 modes) | HIGH | MEDIUM-HIGH | **P1** |
| [9] Stretched-cluster pill | HIGH | LOW (port from vsizer) | **P1** |
| [10] In-session trends | HIGH | MEDIUM-HIGH | **P1** |
| [11] Visual-first UX | HIGH | MEDIUM | **P1** |
| [12] HTML report export | HIGH | MEDIUM-HIGH | **P1** |
| [13] PPTX export | HIGH | MEDIUM (reuse vsizer) | **P1** |
| [14] Drag-and-drop multi-upload | MEDIUM | LOW | **P1** |
| [15] i18n FR + EN | MEDIUM | LOW | **P1** |
| [16] Table virtualization | HIGH | MEDIUM | **P1** (folded into [2/3]) |
| [17] CSV export | MEDIUM | LOW | **P1** (port from vsizer) |
| [18] Light/dark theme | LOW | LOW | **P1** (port from vsizer) |
| [D1] Browser-only narrative | HIGH | LOW (cultural/copy) | **P1** |
| [D2] CI-time EOS catalogue refresh | MEDIUM | LOW | **P1** |
| [D3] One-click drill from EOS bucket to affected VMs | HIGH | LOW | **P1** |
| [D10] Data freshness display | MEDIUM | LOW | **P1** |
| [D11] Upload validation with sheet/column errors | MEDIUM | LOW-MEDIUM | **P1** |
| [D12] No editorial recommendations (cultural) | HIGH | LOW | **P1** |
| [D4] DR scenario presets | MEDIUM | LOW | **P2** |
| [D5] Per-cluster sparklines | MEDIUM | LOW | **P2** |
| [D7] Snapshot side-by-side diff | HIGH | MEDIUM | **P2** |
| [D8] Estate treemap | MEDIUM | LOW-MEDIUM | **P2** |
| [D9] Cluster × time heatmap | MEDIUM | MEDIUM | **P2** |
| [D6] HTML report polish + offline assertion | MEDIUM | MEDIUM (already in P1 [12]) | **P1** |

**Priority key:**

- **P1** — must ship in v1. Stated requirements + minimal viable polish to make the
  result trustworthy.
- **P2** — add quickly after v1 ships; high value, low cost, but not blocking the v1
  announcement.
- **P3** — future consideration; depends on real-user feedback.

---

## Competitor Feature Analysis

| Feature | RVTools Analyser (Ymsoft) | VMware Aria Operations | Live Optics | vatlas approach |
|---------|---------------------------|------------------------|-------------|-----------------|
| **Source** | RVTools `.xlsx` | Live vCenter API | Collector agent + live polling | RVTools `.xlsx` only |
| **Install** | Windows desktop, persistent local DB | Server appliance (VM) | Cloud upload + collector | Web app, zero install |
| **Privacy** | Local desktop; data persists in DB | Sends to vRealize backend (on-prem) | **Data uploaded to Dell cloud** | 100% client-side, refresh = gone |
| **Global dashboard** | YES (one column per cluster) | YES (Inventory Summary, Capacity Summary dashboards) | YES (web dashboard) | YES (mirror RVTools Analyser shape) |
| **Inventory tree** | YES | YES (Inventory tree) | Partial (table-driven) | YES (virtualized) |
| **Multi-vCenter aggregation** | YES (paid?) | YES (native) | YES (multiple workloads) | YES (free; disambiguate by VI SDK UUID) |
| **OS EOS forecast** | YES (a stated feature, free per public listing) | NO (capacity-only) | NO (performance-focused) | YES (endoflife.date bundled; 3/6/9/12-month horizons; drill to VMs) |
| **DR simulation** | YES (paid option per public listing) | YES (rich what-if scenarios) | Partial (sizing for HCI) | YES (3 modes, free, stretched-aware) |
| **Stretched cluster awareness** | Unknown (no public docs) | YES (Aria knows stretched topology) | Partial | YES (50 % reservation; ADR-0007 inherited from vsizer) |
| **Trends over snapshots** | YES (built-in DB; cross-session) | YES (continuous time-series; native) | YES (continuous in cloud) | YES (in-session only; load N workbooks together; **not** persistent) |
| **HTML report** | NO (Excel/PDF export) | YES (built-in report scheduler) | YES (AIR report, **cloud-generated**) | YES (self-contained, offline-readable, in-browser) |
| **PPTX export** | NO | NO (HTML reports only) | YES (cloud-generated) | YES (reuse vsizer engine) |
| **Editorial recommendations** | Some ("spot risks, reduce waste") | YES (rich recommendations engine) | YES (sizing recommendations) | **NO** (deliberate anti-feature; ADR-0003) |
| **Pricing** | Freemium (DR sim is paid) | Enterprise license | Free for VMware/Dell partners | Free, open-source |

### Bottom-line positioning

vatlas competes on three vectors RVTools Analyser cannot match: **browser-only delivery
(zero install, no persistence)**, **CI-fresh EOS catalogue**, and **self-contained HTML
report**. It deliberately concedes: persistence/cross-session, real-time vCenter polling,
recommendation engine.

---

## Sources

**RVTools and multi-vCenter merge:**

- [Yellow Bricks — RVTools 3.9.2: VI SDK Server + VI SDK UUID columns](https://www.yellow-bricks.com/2017/03/03/cool-tool-update-rvtools-3-9-2/)
- [Virtual Allan — RVTools 3.9.2 release notes](https://www.virtual-allan.com/rvtools-3-9-2-released/)
- [James Delaney — RVTools to Excel for multiple vCenters (merge approach)](https://jamesdelaney.co.uk/blog/2021/02/10/vmware-rvtools-to-excel-for-multiple-vcenters/)
- [Broadcom community — RVTools append multiple vCenter results](https://community.broadcom.com/vmware-cloud-foundation/discussion/rvtools-append-multiple-vcenters-results-to-single-xls-file)
- [vGemba — RVTools exporting information](https://www.vgemba.net/vmware/RVTools-Export/)
- [Microsoft Learn — Azure Migrate RVTools XLSX import](https://learn.microsoft.com/en-us/azure/migrate/tutorial-import-vmware-using-rvtools-xlsx?view=migrate)
- [4sysops — What's new in RVTools 4](https://4sysops.com/archives/whats-new-in-rvtools-4-for-vmware-vsphere/)

**RVTools Analyser (reference tool):**

- [RVTools Analyser product listing](https://rvtools-analyser.software.informer.com/)
- [Dell — RVTools / VMware Infrastructure Management](https://www.dell.com/en-us/shop/vmware/sl/rvtools)
- [WitcherIT — RVTools Analyzer overview](https://witcherit.com/2021/06/03/rvtools-analyzer/)

**OS EOS catalogue:**

- [endoflife.date — homepage](https://endoflife.date/)
- [endoflife.date — API v1 docs](https://endoflife.date/docs/api/v1/)
- [endoflife.date — GitHub repo (MIT licensed)](https://github.com/endoflife-date/endoflife.date)
- [endoflife.date — DeepWiki API and data access](https://deepwiki.com/endoflife-date/endoflife.date/6-api-and-data-access)
- [endoflife.date — ESXi page](https://endoflife.date/esxi)
- [endoflife.date — Windows Server page](https://endoflife.date/windows-server)
- [endoflife.date — Linux kernel page](https://endoflife.date/linux)
- [Broadcom KB — End of General Support for vSphere 6.5/6.7/7.0](https://knowledge.broadcom.com/external/article/326984/end-of-general-support-for-vsan-656667.html)
- [Logicalis — End of General Support for vSphere 6.5/6.7](https://www.uki.logicalis.com/Announcing-End-of-General-Support-for-VMware-vSphere-6.5-and-vSphere-6.7)

**DR sim methodology and HA admission control:**

- [Broadcom TechDocs — vSphere HA Admission Control (8.0)](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/vsphere-availability/creating-and-using-vsphere-ha-clusters/vsphere-ha-admission-control.html)
- [Broadcom TechDocs — Slot Policy Admission Control](https://docs.vmware.com/en/VMware-vSphere/7.0/com.vmware.vsphere.avail.doc/GUID-85D9737E-769C-40B6-AB73-F58DA1A451F0.html)
- [VMware vCAT — §8.1.1 Determining the Number of Host Failures to Tolerate](https://download3.vmware.com/vcat/vmw-vcloud-architecture-toolkit-spv1-webworks/Core%20Platform/Architecting%20a%20vSphere%20Compute%20Platform/Architecting%20a%20vSphere%20Compute%20Platform.1.061.html)
- [BuildVirtual — Calculate Host Failure Requirements](https://buildvirtual.net/calculate-host-failure-requirements/)
- [Settlersoman — Understanding VMware HA Admission Control](https://www.settlersoman.com/understanding-vmware-ha-admission-control/)

**Stretched cluster:**

- [VMware — vSAN Stretched Cluster Guide](https://www.vmware.com/docs/vsan-stretched-cluster-guide)
- [Broadcom TechDocs — vSAN Stretched Clusters introduction](https://techdocs.broadcom.com/us/en/vmware-cis/vsan/vsan/8-0/planning-and-deployment/working-with-virtual-san-stretched-cluster/introduction-to-stretched-clusters.html)
- [Microsoft Learn — Azure VMware Solution stretched cluster architecture](https://learn.microsoft.com/en-us/azure/azure-vmware/architecture-stretched-clusters)

**Allocation ratios:**

- [Broadcom blog — vCPU-to-pCPU Ratio Guidelines (2025)](https://blogs.vmware.com/cloud-foundation/2025/06/04/vcpu-to-pcpu-ratio-guidelines/)
- [VMware vCAT — §5.8 Determining an Appropriate vCPU-to-pCPU Ratio](https://download3.vmware.com/vcat/vmw-vcloud-architecture-toolkit-spv1-webworks/Core%20Platform/Architecting%20a%20vSphere%20Compute%20Platform/Architecting%20a%20vSphere%20Compute%20Platform.1.019.html)
- [Heroix — Maximizing VMware Performance and CPU Utilization](https://www.heroix.com/blog/vmware-vcpu-over-allocation/)
- [Know IT Like Pro — vCPU/pCPU ratios in 2025](https://knowitlikepro.com/virtual-cpu-to-physical-cpu-ratios-are-they-still-relevant-in-2025/)

**VMware Aria Operations (competitor reference):**

- [Broadcom TechDocs — Aria Operations Inventory Summary Dashboard](https://techdocs.broadcom.com/us/en/vmware-cis/aria/aria-operations/8-18/vmware-aria-operations-configuration-guide-8-18/predefined-dashboards-in-vrealize-operations-manager/dashboard-library/executive-summary-dashboards/inventory-summary-dashboard.html)
- [Broadcom TechDocs — Aria Operations Capacity Summary Dashboard](https://techdocs.broadcom.com/us/en/vmware-cis/aria/aria-operations/8-18/vmware-aria-operations-configuration-guide-8-18/predefined-dashboards-in-vrealize-operations-manager/dashboard-library/executive-summary-dashboards/capacity-summary-dashboard.html)
- [Broadcom TechDocs — Aria Operations What-If Workload Planning](https://techdocs.broadcom.com/us/en/vmware-cis/aria/aria-operations/8-18/vmware-aria-operations-configuration-guide-8-18/optimizing-capacity-and-improving-performance/how-to-plan-for-capacity-changes/what-if-analysis-workload-planning-traditional.html)

**Live Optics (competitor reference):**

- [Live Optics — homepage](https://www.liveoptics.com/)
- [Live Optics — VMware Guest VM Performance docs](https://support.liveoptics.com/hc/en-us/articles/360048929974-VMware-Guest-VM-Performance)
- [Live Optics — Security Tech Brief](https://app.liveoptics.com/library/download/register/LiveOptics_Security_Tech_Brief.pdf)

**Inventory tree UX and virtualization:**

- [Ashwin Rishi (Medium) — High-performance virtualized table with TanStack React Table](https://medium.com/@ashwinrishipj/building-a-high-performance-virtualized-table-with-tanstack-react-table-ced0bffb79b5)
- [Borstch — Optimizing Large Data Sets with Virtualized Columns and Rows in React TanStack Table](https://borstch.com/blog/development/optimizing-large-data-sets-with-virtualized-columns-and-rows-in-react-tanstack-table)
- [Material React Table V3 — Row Virtualization example](https://www.material-react-table.com/docs/examples/row-virtualization)
- [Strapi — Data Grid Performance Guide](https://strapi.io/blog/table-in-react-performance-guide)

**Trends and heatmap visualization:**

- [Columbia (Sam Greydanus) — Time-Series Calendar Heatmaps](https://www.columbia.edu/~sg3637/blog/Time_Series_Heatmaps.html)
- [Data Europa — Calendar heatmap visualization guide](https://data.europa.eu/apps/data-visualisation-guide/calendar-heatmap)
- [ChartGen — Heatmap visualization guide 2025](https://chartgen.ai/resources/blog/heatmap-data-visualization-complete-guide-examples)

**HTML report and assessment deliverables:**

- [WWT — VMware Cloud Foundation Technical Assessment](https://www.wwt.com/assessment/vmware-cloud-foundation-technical)
- [ReadyWorks — VMware Migration Assessment in 2 Weeks](https://www.readyworks.com/blog/vmware-migration-assessment-in-2-weeks-a-rapid-discovery-framework)
- [Brock Peterson — vROps 8.3 Cloud Management Assessment](https://www.brockpeterson.com/post/vrops-8-3-cloud-management-assessment)

**vsizer (sibling project, source of inherited engines and ADRs):**

- `/Users/fjacquet/Projects/vsizer/README.md`
- `/Users/fjacquet/Projects/vsizer/CLAUDE.md`
- `/Users/fjacquet/Projects/vsizer/docs/adr/0001-client-side-only-processing.md` (privacy invariant)
- `/Users/fjacquet/Projects/vsizer/docs/adr/0003-factual-only-pptx-output.md` (no editorial recs)
- `/Users/fjacquet/Projects/vsizer/docs/adr/0004-memory-only-state.md` (no persistence)
- `/Users/fjacquet/Projects/vsizer/docs/adr/0007-stretched-cluster-dr-reservation.md` (50% rule)
- `/Users/fjacquet/Projects/vsizer/docs/adr/0009-vcpu-pcpu-consolidation-ratio.md` (DR-aware ratios)
- `/Users/fjacquet/Projects/vsizer/docs/adr/0012-cpu-ready-contention-asymmetric-source.md` (CPU Ready source)

---
*Feature research for: VMware estate analytics web app (vatlas, RVTools-only)*
*Researched: 2026-05-15*
