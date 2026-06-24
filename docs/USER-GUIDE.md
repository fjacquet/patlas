<!-- generated-by: gsd-doc-writer -->
# patlas — User Guide

patlas turns one or more Proxmox VE reports into a navigable, visual atlas of your Proxmox estate: a global dashboard, an inventory browser, a nodes view, capacity planning, OS End-of-Support forecasting, in-session trends across multiple reports, storage analysis, network overview, right-sizing, monster guests, and three Proxmox-native views (Snapshot Sprawl, Storage Content, Cluster Health). You open it in a web browser, drop your report file, and read the numbers.

This guide is for the person using the deployed app at `https://fjacquet.github.io/patlas/`. No installation, account, or server is involved.

The on-screen text is available in **English**, **Français**, **Deutsch**, and **Italiano**. This guide quotes the English labels.

---

## 1. The privacy promise (read this first)

patlas runs entirely inside your browser tab. There is no server-side processing.

- **Your report never leaves your browser.** The file you drop is read locally by the browser and parsed in memory. No bytes of it are uploaded anywhere.
- **No telemetry.** patlas does not send the contents of your estate — guest names, node names, clusters, anything — to any external service.
- **Refresh = data gone.** The parsed data lives only in memory. Reloading the page, closing the tab, or navigating away discards everything. There is no "save", and the dataset is never written to browser storage.
- **The only things remembered between visits** are your language choice and your light/dark theme preference. These hold a setting code, never any estate data.

The footer of the app states this directly: *"100% client-side · your file never leaves your browser"*.

This privacy model is by design and is enforced: patlas has no feature that would send your data off the page.

---

## 2. Obtaining a Proxmox report

patlas reads the Proxmox VE report exported from your cluster. To produce one:

1. Log into your Proxmox VE cluster and export a report using the standard Proxmox report tool. The result is a `.zip` bundle containing a `report.xlsx` workbook and, optionally, a `network-diagram.svg`.
2. Alternatively, if you only have the bare `report.xlsx` file, patlas accepts that directly.

patlas accepts:
- **`.zip` bundle** — the standard Proxmox report bundle (`report.xlsx` + optional `network-diagram.svg` inside).
- **`.xlsx` file** — a bare Proxmox report workbook.

The upload zone accepts both formats. Do **not** use RVTools exports or Live Optics exports — patlas reads the Proxmox report format only.

If you have multiple Proxmox report exports (e.g. monthly snapshots), you can drop several files at once to compare them in-session.

---

## 3. Loading one or more reports

When you first open patlas you see a large drop area in the center of the page:

> **Drop your Proxmox reports**
> or *browse your files*
> Accepted formats: .zip (Proxmox report bundle) or .xlsx (Proxmox report). Drop one file or several at once.

To load data:

- **Drag and drop** one or more `.zip` or `.xlsx` files onto the drop area, **or**
- Click the area (or press Enter/Space when it is focused) and pick files with the **browse your files** dialog.

Multiple files are supported in a single drop. Each file becomes one **snapshot**.

Files that are not a recognized Proxmox report are ignored with an error message. If a file fails to parse, re-export the report and drop it again.

### The snapshot sidebar

Once at least one report is loaded, a left sidebar appears listing every loaded snapshot, oldest at the top. Each snapshot card shows:

- the filename
- the **cluster** label and the **Captured** date
- the number of nodes and guests (QEMU VMs + LXC containers)

Click a card to make that snapshot the **active** one — every view shows the active snapshot. Use the **✕** in a card's corner to remove that snapshot. The compact drop zone at the top of the sidebar lets you add more reports without leaving the current view.

In-session trend charts across multiple loaded snapshots are available from the Trends view.

---

## 4. The global dashboard

The top navigation has segments — **Dashboard**, **Inventory**, **Nodes**, **Planning**, and others. The app opens on **Dashboard**.

The Dashboard shows, for the active snapshot:

- **Estate summary** — the headline totals (clusters, nodes, guests, storage pools, vCPU, vRAM, storage, physical GHz, consumed GHz, CPU %, RAM %), with the capture date.
- **Operational insights** — vCPU : pCPU ratio, average CPU %, average memory %, power-state breakdown (running / stopped / templates), provisioned vs in-use storage, storage footprint, total physical cores, total node memory. Where a value cannot be derived from the report, an em-dash `—` is shown.
- **Operating systems** — a Windows / Linux / Other breakdown donut.
- **Clusters** — one column per cluster (standalone node ⇒ a single implicit "proxmox" bucket), scrolling horizontally. Each column carries node and guest counts, an OS mini-bar, storage count, physical and consumed GHz, CPU / RAM / vCPU-per-core gauges.

### Switching the accounting mode

Top-right of the Dashboard is the **Accounting mode** control with three segments:

| Segment | What it counts |
|---|---|
| **Configured** | All guests including stopped (vCPU / vRAM as configured). |
| **Active** | Running guests only. |
| **Storage-realistic** | Running guests for CPU / RAM, all guests for provisioned storage. |

Switching the segment recomputes every number on the screen. The Dashboard opens on **Active**.

### Per-cluster detail

Each cluster column has a **Cluster detail** button. Clicking it replaces the dashboard body with that cluster's full-detail screen. Use **Back to dashboard** to return.

---

## 5. Navigating the inventory

Select the **Inventory** segment in the top navigation.

The Inventory view has two panes:

- **Left — the inventory tree.** A cluster → node → guest tree. The tree root is the active snapshot's cluster label. Selecting a node scopes the table on the right to that node's guests. Selecting the root removes the scope.
- **Right — a table.** An **Object type** control switches the table between **Guests** (VMs and containers), **Nodes**, and **Storage** pools. Guests are segmented by type (QEMU VM / LXC container).

Above the table:

- A **filter** box — *"Filter by name, OS, node…"* — narrows rows live as you type. Clear it to see all rows again.
- A **Columns** button opens the column picker, letting you show or hide individual columns; **Reset** restores the default set.
- An **Export CSV** button (see §8).

Column headers are sortable. Tables are virtualized, so large estates scroll smoothly.

---

## 6. Allocation and the Planning lens

Select the **Planning** segment in the top navigation.

### Measured vs planned allocation

There are two distinct ideas, kept deliberately separate:

- **Measured ratio** — the vCPU : pCPU consolidation actually realized in this snapshot. It is **calculated from your data**, not something you set. You read it on the Dashboard under **Operational insights** (the *vCPU : pCPU* tile). patlas measures this; it never asks you to invent a number.
- **Planned ratio** — a what-if lens. On the Planning view, the **Capacity planning — what-if** panel lets you set a **Planned CPU ratio (vCPU : pCPU)** and a **Planned RAM ratio**, either by typing a value or by clicking a preset (**1:1**, **4:1**, **8:1**, **VDI 10:1**). The panel states *"Planned lens … Not the measured value."*

The planned ratios live in memory only; refreshing the page resets them.

---

## 7. Proxmox-native views

Three views show Proxmox-specific data parsed from dedicated report sheets. These views are **web-only** — they are not included in the HTML report export or the PPTX deck.

### Snapshot Sprawl

Select **Snapshot Sprawl** from the navigation.

Shows guest snapshots still held across the estate:

- Total snapshot count, number of guests with snapshots, total snapshot size, oldest snapshot age.
- Per-guest table of snapshots with name, creation date, size, and age.

The Proxmox `current` live-state marker is excluded — only real checkpoints appear. Parsed from the report `Snapshots` sheet.

### Storage Content

Select **Storage Content** from the navigation.

Shows what occupies each Proxmox storage pool, broken down by content type:

- Content-type breakdown: images (VM disks), rootdir (container data), iso (ISO images), vztmpl (container templates), backup, and others.
- Per-storage summary table.
- Backup-file inventory with per-guest recency information.

Parsed from the report `Storage Content` sheet.

### Cluster Health

Select **Cluster Health** from the navigation.

Shows the HA and scheduled backup status of the cluster:

- **HA status** — quorum state, fencing service state, and HA-managed guest resources.
- **Scheduled backup jobs** — backup job inventory parsed from the cluster configuration.

Parsed from the stacked composite `Cluster HA` / `Cluster` sheets in the report.

---

## 8. Exporting tables to CSV

On the **Inventory** view, the **Export CSV** button above the table downloads the current table as a `.csv` file.

- The export reflects the **visible columns** and the **current filter** — what you see in the table is what you get in the file.
- The filename is `patlas-{object}-{YYYYMMDD}.csv` (for example `patlas-guest-20260624.csv`), where `{object}` is `guest`, `node`, or `storage` depending on the active object type.
- The file is generated entirely in your browser and saved through the normal browser download — nothing is uploaded.

---

## 9. HTML report and PPTX export

The **Export** controls produce shareable output from the inherited analytics views (Dashboard, Inventory, Nodes, Planning, Trends, Right-sizing, Monster guests):

- **HTML report** — a self-contained, statically viewable HTML file. Charts are embedded as SVG; no JavaScript is required to view it.
- **PPTX deck** — a PowerPoint-compatible slide deck generated entirely in the browser.

The three Proxmox-native views (Snapshot Sprawl, Storage Content, Cluster Health) are deliberately excluded from both exports — they are web-only.

---

## 10. Changing language and theme

Both controls live at the top-right of the header, next to the view navigation.

- **Language** — a toggle between **English**, **Français**, **Deutsch**, and **Italiano**. The whole interface switches immediately. Your choice is remembered for next time.
- **Theme** — an **Auto / Light / Dark** toggle. **Auto** follows your operating system's appearance setting; **Light** and **Dark** force the respective theme. Your choice is remembered for next time.

These two preferences are the only things patlas stores between sessions, and they contain no estate data.

---

## Quick reference

| I want to… | Do this |
|---|---|
| Load data | Drop one or more Proxmox `.zip` or `.xlsx` files on the drop area |
| Switch which snapshot is shown | Click a card in the left sidebar |
| Remove a snapshot | Click **✕** on its sidebar card |
| See estate totals | **Dashboard** segment |
| Change how stopped guests are counted | **Accounting mode** control (Configured / Active / Storage-realistic) |
| Drill into one cluster | **Cluster detail** on a cluster column; **Back to dashboard** to return |
| Browse guests / nodes / storage | **Inventory** segment, then the **Object type** control |
| Narrow a table | The filter box; or the inventory tree to scope by node |
| See all nodes at once | **Nodes** segment |
| Set a planned consolidation ratio | **Planning** segment → Capacity planning — what-if |
| View snapshot sprawl | **Snapshot Sprawl** segment (web-only) |
| View storage content breakdown | **Storage Content** segment (web-only) |
| View HA and backup job status | **Cluster Health** segment (web-only) |
| Export a table | **Export CSV** on the Inventory view |
| Export HTML report or PPTX deck | Export controls (inherited analytics only) |
| Switch language / theme | Header toggles, top-right |
| Discard everything | Refresh or close the tab |
