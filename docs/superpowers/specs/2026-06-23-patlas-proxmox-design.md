# patlas — Proxmox Atlas (design)

**Date:** 2026-06-23
**Status:** Approved (design); pending implementation plan
**Author:** Frederic Jacquet (with Claude)
**Relationship:** Sibling of [vatlas](https://github.com/fjacquet/vatlas) — same architectural mold, Proxmox instead of VMware/RVTools.

## 1. Summary

patlas is a 100%-client-side web app that turns a Proxmox VE report bundle
(`Report_<timestamp>.zip` → `report.xlsx` + `network-diagram.svg`) into a
navigable, visual atlas of a Proxmox estate — global dashboard, inventory tree,
allocation analysis, OS End-of-Support forecasting, right-sizing + Monster
guests, in-session trends across multiple reports — and exports the whole thing
as a shareable HTML report and a PPTX deck.

It is a **fork** of vatlas: clone the repo, strip RVTools/VMware-specific code,
keep the canonical data model **structurally** so the pure engines and views
are reused, and add a Proxmox adapter plus Proxmox-native views.

**Core value (inherited):** drop the report in the browser → see numbers →
export → leave. No byte ever leaves the machine. **The report is the product.**

## 2. Decisions (locked during brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Product shape | **Sibling tool (patlas)** — separate app, not multi-platform vatlas |
| D2 | Code reuse | **Fork the repo, diverge** — no shared packages / monorepo |
| D3 | Canonical model | **Keep shape, remap terms** — reuse `VInfoRow`/`VHostRow`/`Snapshot` structurally; rename only in UI/i18n |
| D4 | `cluster` pivot | **Proxmox cluster name** (from the Cluster sheet) — single bucket per report; multi-cluster only when several reports loaded |
| D5 | Containers | **Unified guests + `guestType` flag** — QEMU VMs and LXC containers both map into `VInfoRow`, segmented by `guestType: 'qemu' \| 'lxc'` |
| D6 | v1 scope | **Mirror vatlas + Proxmox extras** — carryover feature set (minus DR) plus new Proxmox-native views |

## 3. Architecture & repo

- **Fork** vatlas into a new `patlas` repo.
- **Keep verbatim:** app shell, `react-error-boundary` + `sonner` setup, the
  **privacy guard** (no-network invariant — throws on any non-same-origin
  fetch/XHR/WS/sendBeacon), `datasetStore` (inputs-only Zustand), the single
  `useEstateView` memo bridge, `Chart.tsx` (ECharts SVG renderer), `DataTable.tsx`,
  the HTML + PPTX export builders, Biome/Vitest config, the GitHub Pages CI shape
  (typecheck → lint → test → build → deploy).
- **Strip:** `adapters/rvtools.ts`, RVTools column-alias maps, RVTools-specific
  Zod schemas, the vSAN-relink / orphan-cluster-synthesis / multi-vCenter-merge
  logic (all VMware-specific), and the DR engine + DR views.
- **Reused unchanged** (consume the canonical `Snapshot`/`VInfoRow`/`VHostRow`,
  which we keep structurally): `engines/aggregation` (cluster/host/guest
  aggregation), `engines/aggregation/sizing.ts` (right-sizing), `monsterVm.ts`,
  the OS EOS forecast engine, and the trends engine.

## 4. Input handling

- Accept **both** the `.zip` bundle and a bare `.xlsx`. On `.zip`, extract
  `report.xlsx` + `network-diagram.svg` with **fflate**. This intentionally
  relaxes vatlas's "no .zip bundles" rule — the `.zip` is the Proxmox tool's
  native output.
- Parsing stays in the **Web Worker**; the `xlsx` import is confined to the
  worker (same as vatlas). `fflate` extraction also runs in the worker.
- The extracted `network-diagram.svg` rides on the `Snapshot` as an opaque
  string for the Network view + HTML report. No bytes leave the browser —
  privacy invariant intact.

## 5. Data model & adapter (`engines/parser/adapters/proxmox.ts`)

Keep `VInfoRow` / `VHostRow` / `Snapshot` shape; map Proxmox sources:

### 5.1 Hosts (`VHostRow`) ← `Nodes` sheet (39 cols)

| Canonical field | Proxmox source |
|---|---|
| `hostName` | `Node` |
| `cluster` | Cluster sheet → cluster `Name` |
| `sockets` | `Cpu Sockets` |
| `cores` | `Cpu Cores` |
| `speedMhz` | `Cpu Mhz` |
| `memoryMib` | `Memory Size GB` → MiB (×1024) |
| `model` / `vendor` | `Cpu Model` (vendor parsed/blank) |
| `esxVersion` (→ `Pve Version` in UI) | `Pve Version` |

### 5.2 Guests (`VInfoRow`) ← `VMs` (49 cols) + `Containers` (37 cols), unified

| Canonical field | Proxmox source |
|---|---|
| `vmName` | `Name` |
| `host` | `Node` |
| `cluster` | Cluster sheet → cluster `Name` |
| `vcpu` | VMs: `Cores`×`Sockets`; CT: `Cores` |
| `vramMib` | `Memory Size GB` → MiB (×1024) |
| `powerState` | `Status` (`running`→`poweredOn`, else `poweredOff`) |
| `template` | `Is Template` |
| `poweredOn` | derived from `powerState` |
| `osConfig` / `osTools` | `Os Name` + `Os Version` (CT: `Os Version` only) |
| `provisionedMib` | `Disk Size GB` → MiB |
| `inUseMib` | `Disk Usage GB` → MiB |
| `host`/identity | `Vm Id` (Proxmox VMID — cluster-unique, not global) |
| **extension** `guestType` | `'qemu'` (VMs sheet) \| `'lxc'` (Containers sheet) |

### 5.3 Runtime usage (`vmUsage`) ← native Proxmox usage columns

Proxmox reports usage directly (no vMemory/vCPU equivalent needed):

| Canonical field | Proxmox source |
|---|---|
| `cpuUsageMhz` | derived from `Cpu Usage %` × host per-core MHz |
| memory usage | `Memory Usage GB` → MiB (or `Memory Usage %`) |
| host-relative | `Host Cpu Usage %`, `Host Memory Usage %` |

Right-sizing & Monster guests work out of the box. Every metric is `null` when
the source cell is absent/blank ("not derivable"), never coerced to `0`
(vatlas ADR-0012 rule preserved).

### 5.4 Storage (`VDatastoreRow`) ← `Storages` sheet (10 cols)

| Canonical field | Proxmox source |
|---|---|
| `name` | `Storage` |
| `type` | `Plugin Type` |
| `capacityMib` | `Disk Size GB` → MiB |
| `freeMib` | `Disk Size GB` − `Disk Usage GB` → MiB |
| `provisionedMib` | `Disk Usage GB` → MiB |
| `hosts` | `Node` |
| shared flag (extension) | `Shared` |

### 5.5 Units

- Treat Proxmox **"GB" as GiB (binary)** → MiB via `×1024`, mirroring vatlas
  ADR-0010 ("MB"=MiB; never a raw `*1.048576`). Use the branded units module.
- **Assumption to verify (R1):** confirm the binary interpretation against one
  node of known physical RAM before locking the factor — it is a ~7% swing.

### 5.6 Validation

- Zod **only at the parser boundary** (the one place patlas runs Zod; engines
  stay Zod-free). Rows failing validation are dropped and reported as
  `invalid-row` ParseError, surfaced to the UI as a count. Engines never
  re-validate.

## 6. Feature set

### 6.1 Carryover (engines reused as-is)

- **Global dashboard** — estate totals (guest count, node count, vCPU, RAM,
  storage), split by `guestType`.
- **Inventory tree** — cluster → node → guest, with QEMU/LXC segmentation.
- **Allocation** — vCPU:pCPU and RAM commit ratios per node/cluster (calculated,
  never user-entered — vatlas allocation-is-calculated rule preserved).
- **OS EOS forecast** — from guest `Os Name`/`Os Version`. **Factually
  degrades** where the guest agent didn't report OS (common on Proxmox): those
  guests are counted as "OS unknown," never guessed. Surface coverage %.
- **Right-sizing + Monster guests** — fed by Proxmox native usage %. "Max across
  loaded snapshots, powered-on only" rule unchanged. Monster = largest by
  configured vCPU / vRAM.
- **In-session trends** — multi-file ingest = multiple reports over time *or*
  multiple clusters in scope. Refresh wipes everything.
- **HTML report + PPTX deck** — the product. ECharts SVG inline; native
  pptxgenjs shapes + text for deck visuals (no rasterized chart text — resvg has
  no embedded font; vatlas learning preserved).

### 6.2 Cut

- **DR / stretched-cluster / site analysis** — no Proxmox analog. Removed
  cleanly (engine + views deleted), not stubbed.

### 6.3 Proxmox-native extras (new pure engines + views)

Each follows the right-sizing/monster pattern: pure
`engines/aggregation/<name>.ts` → `EstateView` slice (threaded through the
single `useEstateView` memo) → view + export section, emit-when-data-present.

- **Storage & backups health** — `Storages` + `Storage Content` + `Backups`:
  storage usage %, shared/plugin type, which guests are backed up, last-backup
  age, orphaned backup files.
- **HA status** — Cluster sheet HA sub-table: HA-managed vs unmanaged guests.
- **Snapshot sprawl** — `Snapshots` sheet: count, age, total reclaimable GB,
  "include RAM" flags.
- **Network diagram** — inline the bundled `network-diagram.svg` in a Network
  view and the HTML report.

## 7. Terminology & i18n

- Engines/types stay VMware-named internally (`cluster`, `host`, `vinfo`) — zero
  engine churn.
- **All user-facing strings remap** in i18n: Host→**Node**, VM→**Guest** (or
  VM/Container by `guestType`), Datastore→**Storage**, vCenter→**Cluster**.
- Ship **all four locales** (en/fr/de/it) from day one; `keyParity.test.ts`
  gate carries over. DE/IT technical terms inherit the "pending native review"
  caveat.
- New `inventory:col.<id>` keys for every new column (the `DataTable`
  header-resolution gotcha: `headerFor` is CSV-only; visible headers resolve via
  `t('col.<id>')`).

## 8. Testing, CI, privacy

- Engines + adapter Vitest-gated **≥75%** (vatlas ADR-0005). The real
  `report.xlsx` becomes the canary/realfile fixture — **sanitized** (no real
  hostnames/IPs committed) or git-ignored like vatlas's real workbook.
- **Privacy invariant — unchanged and absolute:** no fetch of bytes, no
  telemetry of parsed contents, no localStorage of dataset rows. Only
  `patlas-theme` + `patlas-lang` keys allowed. Refresh = data gone.
- Supply-chain gate (telemetry pkgs / xlsx pin drift), bundle-size gate
  (echarts chunk < 300 KB gz), keyParity gate all carry over.
- `semgrep` scan on generated parser/adapter code.

## 9. Key risks & assumptions (resolve during planning)

1. **R1 — GiB vs GB factor:** verify the binary interpretation against one node
   of known RAM before locking the conversion (~7% swing). §5.5.
2. **R2 — Composite Cluster sheet:** the 72-"column" Cluster sheet is several
   stacked sub-tables (cluster info, HA, backup jobs, storage defs). The adapter
   needs row-range splitting, not a single table read. Highest-effort parsing
   item.
3. **R3 — Sparse guest-agent OS data:** EOS coverage will be partial; surface
   coverage % honestly rather than implying full coverage.
4. **R4 — Single-cluster collapse:** mid-tier comparison views show one bucket
   until multiple reports are loaded. Acceptable (D4), but dashboard copy should
   set that expectation.
5. **R5 — Multi-cluster identity:** when several reports merge, key guests by
   `Vm Id` + cluster (Proxmox VMIDs are cluster-unique, not global). No BIOS/
   instance UUID for containers.

## 10. Out of scope (v1)

- Live Proxmox API ingest (report file only).
- PDF export (HTML + PPTX only, as vatlas).
- Persisting any dataset across refresh.
- Multi-platform unification with vatlas (separate product by D1/D2).
