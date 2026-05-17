<!-- generated-by: gsd-doc-writer -->
# vatlas — User Guide

vatlas turns one or more RVTools `.xlsx` exports into a navigable, visual atlas of your VMware estate: a global dashboard, an inventory browser, an all-hosts view, and a capacity-planning / disaster-recovery lens. You open it in a web browser, drop your workbook, and read the numbers.

This guide is for the person using the deployed app at `https://fjacquet.github.io/vatlas/`. No installation, account, or server is involved.

The on-screen text is available in **English** and **Français**. This guide quotes the English labels.

---

## 1. The privacy promise (read this first)

vatlas runs entirely inside your browser tab. There is no server-side processing.

- **Your workbook never leaves your browser.** The `.xlsx` file you drop is read locally by the browser and parsed in memory. No bytes of it are uploaded anywhere.
- **No telemetry.** vatlas does not send the contents of your estate — VM names, hostnames, clusters, anything — to any external service.
- **Refresh = data gone.** The parsed data lives only in memory. Reloading the page, closing the tab, or navigating away discards everything. There is no "save", and the dataset is never written to browser storage.
- **The only things remembered between visits** are your language choice and your light/dark theme preference. These hold a setting code, never any estate data.

The footer of the app states this directly: *"100% client-side · your file never leaves your browser"*.

This privacy model is by design and is enforced: vatlas has no feature that would send your data off the page.

---

## 2. Getting an RVTools `.xlsx` export

vatlas reads the standard RVTools workbook. To produce one:

1. Run RVTools against your vCenter (or against an existing connection your VMware team manages).
2. Use **Export all to xlsx** (RVTools' standard "export all tabs" action). This produces a single `.xlsx` workbook containing the `vInfo`, `vHost`, `vDatastore`, `vMetaData`, and related sheets.
3. Keep the file as `.xlsx`. vatlas accepts that format only — not `.xlsm`, `.xlsb`, `.csv`, `.ods`, or `.zip`, and not Live Optics exports.

If you have monthly RVTools exports, you can keep each one as a separate `.xlsx` and load several at once (see the next section).

---

## 3. Loading one or more workbooks

When you first open vatlas you see a large drop area in the center of the page:

> **Drop your RVTools exports**
> or *browse your files*
> Accepted format: .xlsx (RVTools export). Drop one file or several at once.

To load data:

- **Drag and drop** one or more `.xlsx` files onto the drop area, **or**
- Click the area (or press Enter/Space when it is focused) and pick files with the **browse your files** dialog.

Multiple files are supported in a single drop. Each file becomes one **snapshot**.

Files that are not `.xlsx` are ignored. If a workbook is not a recognizable RVTools export, vatlas reports *"Unrecognized format. Drop an RVTools .xlsx export."* If a file is the right type but fails to parse, you get *"Failed to read the file: …"* — re-export the workbook and drop it again.

### The snapshot sidebar

Once at least one workbook is loaded, a left sidebar appears listing every loaded snapshot, oldest at the top. Each snapshot card shows:

- the filename
- the **vCenter** label and the **Captured** date
- the number of vCenters and their server names (a single RVTools workbook can contain several vCenters; vatlas counts the distinct ones)
- the **RVTools** version
- row counts: VMs · ESX · clusters · datastores

Click a card to make that snapshot the **active** one — every view (Dashboard, Inventory, Hosts, Planning) shows the active snapshot. Use the **✕** in a card's corner to remove that snapshot. The compact drop zone at the top of the sidebar lets you add more workbooks without leaving the current view.

> **Note on multiple snapshots:** loading several workbooks lets you switch between them one at a time from the sidebar. In-session trend charts across snapshots are **not yet available** (planned for a later release).

---

## 4. The global dashboard

The top navigation has four segments — **Dashboard**, **Inventory**, **Hosts**, **Planning**. The app opens on **Dashboard**.

The Dashboard shows, for the active snapshot:

- **Estate summary** — the headline totals (clusters, ESX, VMs, datastores, vCPU, vRAM, storage, physical GHz, consumed GHz, CPU %, RAM %), with the capture date.
- A neutral one-line echo of how many clusters you have marked as stretched (see §6).
- **Operational insights** — vCPU : pCPU ratio, average CPU %, average memory %, power-state breakdown (on / off / suspended / templates), provisioned vs in-use storage, datastore footprint, guest data, total physical cores, total host memory. Where a value cannot be derived from the workbook (for example guest data with no partition sheet), an em-dash `—` is shown rather than a guessed number.
- **Operating systems** — a Windows / Linux / Other breakdown donut.
- **Clusters** — one column per cluster, scrolling horizontally. Each column carries ESX and VM counts, an OS mini-bar, datastore count, physical and consumed GHz, CPU / RAM / vCPU-per-core gauges, CPU Ready statistics, and the stretched-cluster control (§6).
- **CPU Ready** — CPU Ready mean, CPU Ready max, and the count of VMs above 5% CPU Ready. Where RVTools did not report readiness, the value reads *"not reported"*.

### Switching the accounting mode

Top-right of the Dashboard is the **Accounting mode** control with three segments:

| Segment | What it counts |
|---|---|
| **Configured** | All VMs including powered-off (vCPU / vRAM as configured). |
| **Active** | Powered-on VMs only. |
| **Storage-realistic** | Powered-on VMs for CPU / RAM, all VMs for provisioned storage. |

Switching the segment recomputes every number on the screen. The Dashboard opens on **Active**.

### Per-cluster detail

Each cluster column has a **Cluster detail** button. Clicking it replaces the dashboard body with that cluster's full-detail screen. Use **Back to dashboard** to return.

> **Not yet available on the Dashboard:** OS End-of-Support forecasting and in-session multi-snapshot trends are planned for later releases and are not present in the current app.

---

## 5. Navigating the inventory

Select the **Inventory** segment in the top navigation.

The Inventory view has two panes:

- **Left — the inventory tree.** A vCenter → cluster → host → VM tree. The tree root is the active snapshot's vCenter label. Selecting a node scopes the table on the right to that node's subtree (a host shows its VMs; a cluster shows its clusters' VMs). Selecting the root removes the scope.
- **Right — a table.** An **Object type** control switches the table between **VMs**, **ESX hosts**, and **Datastores**. (The Datastores table is estate-wide and is not narrowed by tree selection, because datastores are deduplicated across the estate.)

Above the table:

- A **filter** box — *"Filter by name, OS, host…"* — narrows rows live as you type. Clear it to see all rows again.
- A **Columns** button opens the column picker, letting you show or hide individual columns; **Reset** restores the default set.
- An **Export CSV** button (see §7).

Column headers are sortable. Tables are virtualized, so large estates scroll smoothly.

---

## 6. Allocation, the Planning lens, and DR simulation

Select the **Planning** segment in the top navigation.

### Measured vs planned allocation

There are two distinct ideas, kept deliberately separate:

- **Measured ratio** — the vCPU : pCPU consolidation actually realized in this snapshot. It is **calculated from your data**, not something you set. You read it on the Dashboard under **Operational insights** (the *vCPU : pCPU* tile). vatlas measures this; it never asks you to invent a number. (Background: ADR-0020.)
- **Planned ratio** — a what-if lens. On the Planning view, the **Capacity planning — what-if** panel lets you set a **Planned CPU ratio (vCPU : pCPU)** and a **Planned RAM ratio**, either by typing a value or by clicking a preset (**1:1**, **4:1**, **8:1**, **VDI 10:1**). This is explicitly the planned lens — the panel states *"Planned lens … Not the measured value."* and carries a caption pointing you back to the measured ratio on the Dashboard.

The planned ratios live in memory only; refreshing the page resets them.

### DR simulation (server / site, physical impact)

Below the planned-ratios panel is the **DR simulation** panel with a **Loss scenario** control offering two modes:

- **Server loss** — pick which hosts to treat as failed. You can tick individual hosts under *"Simulate these hosts failed"*, or use the per-cluster **"Hosts failed in {cluster}"** number stepper (it reads *"N of M"*). Selection is reversible and neutral — a failed host is shown struck-through with a *"simulated failed"* chip; unticking it restores instantly. There is no confirmation dialog and no alarm styling.
- **Site loss** — pick the site (fault domain) to treat as failed. The Site segment is always present; the site picker only lists the fault-domain values of the clusters **you have declared stretched** (see below). If you have declared no stretched clusters, the panel says so factually: *"Site loss needs at least one cluster you have declared stretched."*

The headline result is the **physical impact**: **Physical CPU removed** (in GHz and cores) and **Physical RAM removed** (in MiB) for the failed hosts or site. It is physical capacity, not vCPU.

The panel shows **Before** and **After** estate summaries (clusters, hosts, VMs, GHz, RAM) and a per-surviving-cluster verdict using the factual words **absorbs**, **tight**, or **overflows** — plain text, no traffic-light coloring or grade.

A **"Apply planned ratios to this scenario"** checkbox switches the DR result between your measured allocation and the planned-lens ratios. It states which is in effect: *"This DR result uses the measured allocation."* / *"… uses the planned lens ratios, not the measured ratios."*

The **What this models** disclosure is always shown:

- *Models:* physical CPU and RAM subtraction for the failed hosts or site; respects the active accounting mode and the chosen allocation ratios.
- *Does not model:* HA admission control, anti-affinity rules, VM restart priority, stretched-cluster split-brain.

For **Site loss**, two factual points apply: any workload physically at the failed site that has no stretched DR target is surfaced as an explicit *"lost — no DR target"* line with its VM count, CPU, and RAM; and the before/after delta counts every host at the failed site as removed (including hosts of declared-stretched clusters) — surviving-site failover is not modeled.

### "Stretched cluster" is your declaration

vatlas does not guess which of your clusters are stretched. On the Dashboard, each cluster column has an **Étendu / Stretched** toggle. Pressing it marks that cluster as stretched **by your declaration**. When marked, the column shows factual site data — **Site A** / **Site B** capacity when RVTools provided fault-domain data, the **Reservation** percentage, and a neutral caption: *"site data: detected"* when fault-domain data is present, or *"symmetric split assumed (no site data)"* when it is not.

There is no high / medium / low confidence judgement. vatlas presents the site data factually; the stretched-cluster decision is yours, and the Site-loss DR picker only acts on the clusters you have declared. (Background: ADR-0021 for the DR model, ADR-0022 for the stretched-cluster declaration.)

---

## 7. Exporting tables to CSV

On the **Inventory** view, the **Export CSV** button above the table downloads the current table as a `.csv` file.

- The export reflects the **visible columns** and the **current filter** — what you see in the table is what you get in the file.
- The filename is `vatlas-{object}-{YYYYMMDD}.csv` (for example `vatlas-vm-20260517.csv`), where `{object}` is `vm`, `esx`, or `datastore` depending on the active object type.
- The file is generated entirely in your browser and saved through the normal browser download — nothing is uploaded.

> **Not yet available:** the shareable HTML report and the PowerPoint (PPTX) deck are planned for later releases. CSV table export is the export available in the current app.

---

## 8. Changing language and theme

Both controls live at the top-right of the header, next to the view navigation.

- **Language** — a **Français / English** toggle. The whole interface switches immediately. Your choice is remembered for next time.
- **Theme** — an **Auto / Light / Dark** toggle. **Auto** follows your operating system's appearance setting; **Light** and **Dark** force the respective theme. Your choice is remembered for next time.

These two preferences are the only things vatlas stores between sessions, and they contain no estate data.

---

## Quick reference

| I want to… | Do this |
|---|---|
| Load data | Drop one or more RVTools `.xlsx` files on the drop area |
| Switch which snapshot is shown | Click a card in the left sidebar |
| Remove a snapshot | Click **✕** on its sidebar card |
| See estate totals | **Dashboard** segment |
| Change how powered-off VMs are counted | **Accounting mode** control (Configured / Active / Storage-realistic) |
| Drill into one cluster | **Cluster detail** on a cluster column; **Back to dashboard** to return |
| Browse VMs / hosts / datastores | **Inventory** segment, then the **Object type** control |
| Narrow a table | The filter box; or the inventory tree to scope by node |
| See all hosts at once | **Hosts** segment |
| Set a planned consolidation ratio | **Planning** segment → Capacity planning — what-if |
| Simulate losing hosts or a site | **Planning** segment → DR simulation |
| Mark a cluster stretched | **Étendu / Stretched** toggle on its Dashboard column |
| Export a table | **Export CSV** on the Inventory view |
| Switch language / theme | Header toggles, top-right |
| Discard everything | Refresh or close the tab |
