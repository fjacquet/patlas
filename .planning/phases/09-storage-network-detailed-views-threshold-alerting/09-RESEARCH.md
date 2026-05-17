# Phase 9: Storage / Network / Detailed Views + Threshold Alerting - Research

**Researched:** 2026-05-17
**Domain:** RVTools storage/network parser extension · in-memory threshold config · vSAN VM→datastore→cluster relink · ECharts treemap/stacked-bar · click-drill detail screens
**Confidence:** HIGH (all parser/relink claims empirically verified against the two real RVTools workbooks on this machine; UI/engine claims verified against shipped source; ECharts API verified via Context7)

<user_constraints>
## User Constraints (from 09-CONTEXT.md)

### Locked Decisions

- **D-01:** Threshold alerting **IS in this milestone** (not deferred).
- **D-02:** Config held **in-memory only** — a Zustand *inputs* slice (same class as `plannedRatios`). **NO new `localStorage` key**, no `vatlas-thresholds`, no URL-hash. Refresh ⇒ defaults restored.
- **D-03:** Default thresholds mirror RVTools-Analyser: guest filesystem alert at **< 10 % free (≥ 90 % used)**, datastore alert at **> 85 % used**. LU/logical-unit default chosen by Claude in PLAN, documented. All user-editable at runtime.
- **D-04:** Alert presentation **factual only** — counts + flagged rows (row highlight/badge), **no verdict, no editorial verb, no traffic-light color**. Reuse factual-caption + em-dash-sentinel idioms.
- **D-05:** Add **two new top-level ViewToggle segments: "Storage" and "Network"** (8 total: Dashboard · Inventory · Hosts · Planning · EOS · Trends · Storage · Network). **Extend the shipped `fieldset`+`aria-pressed` ViewToggle** — do NOT build a new nav component.
- **D-06:** Detail screens are **click-drill in-app view-state branches** (the P5 pattern — lifted component state, NOT URL routing, NOT a 2nd `useMemo`). New drills: **Datastore detail**, **VM detail**, **ESX storage+network detail** (ESX augments the shipped Hosts view; does NOT duplicate the P5 cluster-detail drill).
  - Datastore detail: capacity/provisioned/in-use/free, VMs on it, host count, threshold flags.
  - VM detail: vCPU/vRAM, disks, partitions (threshold flags), portgroups/switches, datastores.
  - ESX detail: datastores mounted + vSwitch/dvSwitch/uplinks per host, attached to existing Hosts view.
- **D-07:** Storage-by-X (Cluster/ESX/VM/Datastore) ships **both lenses behind a toggle**: (a) provisioned vs in-use (incl `.vswp`+snapshots) and (b) datastore capacity vs used vs free. Reuse the **shipped accounting-toggle idiom** for the lens switch — do NOT invent a new toggle.
- **D-08:** Primary visual = **datastore-footprint treemap** (VIZ-02; ECharts treemap, SVG renderer) for consumption lens; **stacked-bar** for the capacity lens. Tables alongside reuse P3 `DataTable`/`ColumnPicker`/CSV (mind the `inventory:col.<id>` header-key gotcha).
- **D-09:** Implement the **vInfo VM→datastore→cluster relink** (P5-deferred). Closes STR-04/Pitfall-6 vSAN under-count. ONLY valid cluster-identity path for blank-`Cluster name` rows. MUST be real-file-validated against `~/Library/CloudStorage/OneDrive-Home/20260430_1400_allvCenters.xlsx` (75 blank-cluster datastores) — unit tests insufficient.
- **D-10:** Shared-LUN edge case (datastore spanning multiple clusters) — **Claude's discretion**: pick the minimal-inference, factual approach (proportional-by-VM-provisioned split OR explicit "shared across N clusters" line excluded from single-cluster rollups), decide in PLAN, document + validate on a real multi-cluster file. No silent allocation guesses.
- **D-11:** **Full vSwitch/dvSwitch topology**: regression-gated parser extension for **vNetwork + vSwitch + dvSwitch (+ dvPort when present)**. New sheets **OPTIONAL** with factual-degrade (mirror the existing `vDatastore`/`vPartition` pattern), never a throw. MUST NOT regress the existing parser (MiB canary + existing fixtures green) — the P5 D-07 regression-gated-parser-change pattern.

### Claude's Discretion

LU/logical-unit default threshold value (D-03); exact tile/column ordering + EN/FR factual label strings (no editorial verbs, parity); screen-fit layout grids for the 3 new detail drills; the treemap/stacked-bar option configs; the shared-LUN attribution approach (D-10); the minimal-blast-radius parser-extension shape; the plan/wave breakdown.

### Deferred Ideas (OUT OF SCOPE)

- Persisted threshold config (`vatlas-thresholds` localStorage UI-pref key) — explicitly rejected (D-02).
- Conservative/earlier-warning default threshold preset — not chosen (D-03 uses RVTools-Analyser defaults); could become a selectable preset later.
- Storage/network analytics beyond inventory + thresholds (IOPS/latency trends, capacity-forecast) — not in RVTools exports, out of scope, potential v2.
- HTML/PPTX export generation (→ P10); GitHub Pages deploy (→ P10); any persisted-to-disk threshold config.
</user_constraints>

<phase_requirements>
## Phase Requirements

P9 requirement IDs do not exist yet and MUST be derived by the planner (mirror the P5/P6 re-derivation pattern, update the Traceability table). The capability surface below is grouped so REQ-IDs map cleanly. Suggested ID stems (planner decides final): **STG-** (storage views #10), **NET-** (network inventory #12), **DTL-** (detail drills #12), **ALR-** (threshold alerting #12/#14), **VSR-** (vSAN relink — closes the open STR-04).

| Group | Capability surface | Reference | Research support |
|-------|--------------------|-----------|------------------|
| STG (Storage views #10) | Disk sizes by Cluster/ESX/VM/Datastore; two lenses (provisioned-vs-in-use, capacity-vs-used-vs-free) behind the accounting-toggle idiom; treemap (consumption) + stacked-bar (capacity); tables reuse P3 DataTable | RVTools #10, D-07/D-08 | §Standard Stack, §Architecture Patterns (Pattern 2/3), §Code Examples (treemap) |
| NET (Network inventory #12) | vNetwork (VM→portgroup), vSwitch (std), dvSwitch (distributed) + dvPort topology; uplinks, portgroup VLANs; OPTIONAL-sheet factual-degrade | RVTools #12, D-11 | §Standard Stack (parser ext), §Runtime State Inventory, §Pitfall 1, real-column tables |
| DTL (Detail drills #12) | Datastore detail, VM detail, ESX storage+network detail; click-drill view-state (P5 pattern); screen-fit/export-ready | D-06 | §Architecture Patterns (Pattern 1), §Code Examples (drill) |
| ALR (Threshold alerting #12/#14) | In-memory thresholds slice (filesystem ≥90 % used, datastore >85 % used, LU default TBD); factual flag counts/badges; user-editable config surface | D-01..D-04 | §Architecture Patterns (Pattern 4), §Don't Hand-Roll, §Security Domain |
| VSR (vSAN relink — closes STR-04) | vInfo VM→datastore→cluster relink for blank-`Cluster name` rows; shared-LUN attribution (D-10); NAA-dedupe interaction | D-09/D-10 | §Architecture Patterns (Pattern 5), §Runtime State Inventory, §Pitfall 2, §Validation Architecture |
</phase_requirements>

## Summary

This is a large, four-to-five-plan phase. The technical core is **not** new libraries — the entire stack (React 19, ECharts SVG `<Chart>`, Zustand inputs store, Zod-at-parser-boundary, P3 `DataTable`) is already shipped and reused verbatim. The research effort went into **the RVTools data model**, validated empirically against the two real workbooks on this machine, because every P9 decision hinges on what the columns actually contain.

The single most consequential finding: **the vSAN relink join in 09-CONTEXT D-09 must key off `vInfo.Path` (the VM config-file path, e.g. `[SITEL12_SILVER_08] vm/vm.vmx`), NOT `vDisk."Disk Path"`.** In the real 75-blank-cluster workbook, `vDisk."Disk Path"` holds **guest mount points** (`/, /boot, /var/lib/kubelet/...`) with zero bracketed-datastore tokens (3825/3825 parse-fail), whereas `vInfo.Path` carries the `[datastore]` token on every VM (1413/1447 parsable). The relink resolves 25 of 67 blank-cluster datastores; 42 cannot be relinked (no VM references them — they are genuinely workload-less, e.g. `powerflex-CL_CTRL_PFLEX101-ds-1`) and must remain estate-only with a factual em-dash, never fabricated onto a cluster. Exactly **one** blank datastore (`Y-TEMPLATES`) is a true shared-LUN edge (resolves to 5 clusters) — D-10's "shared across N clusters" approach is the right minimal-inference choice and is empirically rare.

The second consequential finding: **RVTools exports come in two radically different shapes.** The OneDrive file has the full 27-sheet set including `vNetwork`/`vSwitch`/`dvSwitch`/`dvPort`. The Downloads file has only 8 sheets (`vInfo`, `RVTools_tabvHost`, `RVTools_tabvDatastore`, `RVTools_tabvPartition`, plus empty `Sheet1..4`) — **no network sheets at all**. This is the literal D-11 factual-degrade case and proves the OPTIONAL-sheet pattern is mandatory, not theoretical. The existing `findSheet` already handles the `RVTools_tab*` prefix; new network adapters must follow the same `findSheet` + warning-push path.

**Primary recommendation:** Structure as five waves — (1) regression-gated parser extension (network sheets + `vInfo.Path` + `vPartition` Free% as OPTIONAL, MiB canary + existing fixtures green), (2) storage-by-X + vSAN-relink engine (extends `estateView.ts` single pass, no new memo), (3) in-memory thresholds Zustand slice + pure threshold-flag engine, (4) Storage view shell + treemap/stacked-bar + Datastore/VM detail drills, (5) Network view shell + ESX storage+network detail augmenting the shipped Hosts view. Validate waves 1–2 against `20260430_1400_allvCenters.xlsx` before declaring done.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RVTools network/storage sheet parsing | Parser worker (`parser.worker.ts` / `adapters/rvtools.ts`) | — | `xlsx` import is confined to the worker; all new sheet adapters live beside the existing ones (CLAUDE.md architecture) |
| vSAN VM→datastore→cluster relink | Pure engine (`engines/aggregation/`) | — | Pure function, Vitest-gated ≥75 %; composes into the single `buildEstateView` pass |
| Storage-by-X / threshold-flag projections | Pure engine (`engines/aggregation/`) | — | All metrics flow through `EstateView`, consumed via the single `useEstateView` memo |
| In-memory thresholds config (inputs) | Zustand store (`snapshotStore.ts`) | — | Inputs-only slice, exactly the `plannedRatios` precedent; no persistence |
| Storage/Network views + detail drills | React presenter components | `useEstateView` (read-only) | Click-drill is lifted in-app view-state in `App.tsx`, the P5 pattern; presenters consume `EstateView` props only |
| Chart rendering (treemap/stacked-bar) | `src/components/Chart.tsx` (single ECharts site) | — | SVG renderer mandated; option built by a pure selector off memoized `EstateView` |

## Standard Stack

### Core (all already shipped — reuse verbatim, install nothing)

| Library | Version (pinned) | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| React | `^19.2.6` | UI runtime | Shipped; no new deps for P9 [VERIFIED: package.json / CLAUDE.md] |
| Zustand | `^5.0.13` | In-memory thresholds inputs slice | `plannedRatios` is the exact precedent (D-02) [VERIFIED: src/store/snapshotStore.ts] |
| Zod | `^4.4.3` | Runtime validation at parser boundary ONLY | New `VSwitchRow`/`VNetworkRow`/`DvSwitchRow` schemas join `schemas.ts` [VERIFIED: src/engines/parser/schemas.ts] |
| Apache ECharts | `^6.0.0` | Treemap (consumption) + stacked-bar (capacity) | `TreemapChart` is NOT yet registered in `Chart.tsx` — must add to the `echarts.use([...])` list [VERIFIED: src/components/Chart.tsx lines 1-42; CITED: /apache/echarts-doc treemap.md] |
| `echarts-for-react` | `^3.0.6` | React binding (via `<Chart>`) | Single chart site; no change to `<Chart>` API [VERIFIED: src/components/Chart.tsx] |
| `@tanstack/react-table` | (shipped) | Storage/network tables via `DataTable` | P3 `DataTable`/`ColumnPicker`/CSV reused [VERIFIED: src/components/inventory/DataTable.tsx] |
| react-i18next | `^16.6.6` | EN/FR parity for new namespaces | New `storage`/`network`/`alerts` namespaces, keys in BOTH `en/`+`fr/` [VERIFIED: src/i18n/locales/{en,fr}/] |

### The one ECharts registration change

`src/components/Chart.tsx` registers `BarChart, PieChart, GaugeChart, HeatmapChart, LineChart` but **NOT `TreemapChart`**. D-08's treemap requires adding `TreemapChart` to the `echarts/charts` import and the `echarts.use([...])` array. This is a one-line registry addition in the single sanctioned chart site — no `<Chart>` API change (the universal `option` prop already covers it). `[VERIFIED: src/components/Chart.tsx lines 1-42]` The stacked-bar reuses the already-registered `BarChart` (stacking is an `option` config, not a new series type). **Watch the CI bundle-size gate** (`npm run check:bundle-size`, ≤300 KB gz echarts chunk) — treemap is a small incremental series; verify the gate stays green after registration.

### Version verification

No new packages. ECharts treemap is part of the already-installed `echarts@^6.0.0` (`echarts/charts` subpath) — confirmed current and API-stable in v6 via Context7 (`/apache/echarts-doc`, treemap.md). `[VERIFIED: ctx7 /apache/echarts-doc]`

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ECharts treemap | Custom SVG rects | D-08 mandates ECharts treemap (VIZ-02 already locked it project-wide); custom would break the HTML-report SVG-inline plan and the `<Chart>` single-site invariant |
| Zustand thresholds slice | React context / localStorage | D-02 explicitly forbids localStorage; `plannedRatios` slice is the locked precedent |
| `vInfo.Path` relink | `vDisk."Disk Path"` relink | Empirically `vDisk."Disk Path"` = guest mount points in real data (0 % parseable as `[datastore]`); `vInfo.Path` = 98 % parseable. Not a real alternative — it is a correctness requirement |

## Architecture Patterns

### System Architecture Diagram

```
RVTools .xlsx (1..N files)
        │
        ▼  [parser.worker.ts — xlsx import confined here]
  parseXlsx → adaptRvtools()
        │  REQUIRED: vInfo, vHost  (throw if absent)
        │  OPTIONAL (push warning if absent): vDatastore, vPartition, vMetaData,
        │            + NEW: vNetwork, vSwitch, dvSwitch, dvPort
        ▼
  Snapshot { vinfo(+Path), vhost, vdatastore, vpartition,
             vnetwork, vswitch, dvswitch, dvport, parseErrors[] }
        │
        ▼  [Zustand snapshotStore — INPUTS ONLY]
   snapshots Map · selectedSnapshotIds · stretchedClusters
   · plannedRatios · scenario · NEW: thresholds {fsUsedPct,dsUsedPct,luUsedPct}
        │
        ▼  [useEstateView — THE single useMemo]
   mergeSnapshotsToEstate(selected) → buildEstateView(merged, …, { thresholds })
        │  (one pure pass — NO 2nd memo)
        ├─ existing: clusters, hosts, datastores, vmRows, insights, eos, trends …
        ├─ NEW: storageByCluster/Esx/Vm/Datastore (two lenses)
        ├─ NEW: vsanRelink → datastoreClusterAttribution (blank-cluster rows)
        ├─ NEW: network topology (vswitch/dvswitch/portgroup/uplink rollups)
        └─ NEW: thresholdFlags (fs partitions ≥90%, datastores >85%, LU >N%)
        │
        ▼  EstateView (frozen, plain props)
  ┌──────────────┬───────────────┬──────────────────────────────┐
  Storage view   Network view    Detail drills (lifted view-state in App.tsx)
  (treemap +     (vSwitch/        Datastore detail · VM detail ·
   stacked-bar +  dvSwitch +      ESX storage+network detail
   DataTable)     portgroup       (augments shipped Hosts view)
                  tables)
```

File-to-implementation mapping is in the Recommended Project Structure note below — the diagram shows data flow only.

### Recommended Project Structure (extend, do not restructure)

```
src/engines/parser/adapters/rvtools.ts   # + adaptRvtoolsVNetwork/VSwitch/DvSwitch/DvPort; + vInfo.Path; + vPartition Free%
src/engines/parser/schemas.ts            # + V{Network,Switch,DvSwitch,DvPort}RowSchema
src/types/snapshot.ts                    # + V{Network,Switch,DvSwitch,DvPort}Row interfaces; Snapshot gains arrays
src/engines/aggregation/
  vsanRelink.ts        (NEW)             # vInfo.Path → datastore → cluster; shared-LUN attribution (D-09/D-10)
  storageByX.ts        (NEW)             # storage-by-cluster/esx/vm/datastore, two lenses (D-07)
  thresholdFlags.ts    (NEW)             # pure flag projection driven by thresholds slice (D-01..D-04)
  network.ts           (NEW)             # vswitch/dvswitch/portgroup/uplink rollups (D-11)
  estateView.ts        (EXTEND)          # compose all of the above into the single pass
src/store/snapshotStore.ts               # + thresholds inputs slice (plannedRatios precedent)
src/components/
  ViewToggle.tsx       (EXTEND)          # + 'storage' + 'network' to AppView union + VIEWS array
  storage/             (NEW)             # StorageView, StorageLensToggle(reuse idiom), DatastoreDetail, VmDetail
  network/             (NEW)             # NetworkView, switch/portgroup tables
  hosts/               (EXTEND)          # ESX storage+network detail augments the shipped Hosts view (D-06)
  inventory/columns/   (EXTEND)          # new column defs; remember inventory:col.<id> i18n keys
src/i18n/locales/{en,fr}/
  storage.json network.json alerts.json  (NEW — EN/FR parity mandatory)
src/App.tsx                              # + storage/network view branches + detail-drill lifted state
```

### Pattern 1: Click-drill detail screen = lifted in-app view-state (the P5 precedent)

**What:** Detail screens are NOT routes. `App.tsx` holds `activeView` (`useState<AppView>`); a child renders a screen and a `back` callback. P5's `ClusterDetail` is the reference — reached by clicking a card, takes `{ detail, onBack }`, renders one-screen-fit, no router, no 2nd memo.

**When to use:** All three new drills (Datastore detail, VM detail, ESX storage+network detail).

**How it composes:** The Storage/Network view owns a local `useState` for "which datastore/VM is drilled". `App.tsx` only routes the top-level segment; the drill state lives in the view shell (exactly how `GlobalDashboard` owns the cluster-detail selection, not `App.tsx`).

```tsx
// Source: src/components/cluster/ClusterDetail.tsx (shipped P5 pattern — copy this shape)
export interface DatastoreDetailProps { detail: DatastoreDetail; onBack: () => void }
export function DatastoreDetail({ detail, onBack }: DatastoreDetailProps) {
  const { t, i18n } = useTranslation('storage')
  // one-screen-fit fixed grid, NO internal scroll, 16:9 — Phase-10 snapshots it as one slide
  // factual rows only; em-dash sentinel when a value is not derivable; dark: twin on every color
}
```

### Pattern 2: New metric → extend `buildEstateView`'s single pass (NO new memo)

**What:** Every P9 projection (storage-by-X, relink attribution, network rollup, threshold flags) is computed inside the existing `buildEstateView` function and returned on `EstateView`. The grep-gated single-`useMemo` invariant means a 2nd `useMemo` anywhere in non-test `src/` fails CI.

**How:** Add pure helper modules (`storageByX.ts`, `vsanRelink.ts`, etc.), call them inside `buildEstateView` in the same pass that already iterates `merged.vinfo`/`merged.vhost`, return new fields on the `EstateView` object. `EMPTY_VIEW` must gain frozen empty equivalents (the established `EMPTY_INSIGHTS`/`EMPTY_EOS` pattern). `[VERIFIED: src/engines/aggregation/estateView.ts lines 286-372]`

```ts
// Source: src/engines/aggregation/estateView.ts (the established extension shape)
const vsan = relinkBlankClusterDatastores(merged.vinfo, merged.vdatastore)        // NEW pure call
const storage = storageByX(merged, mode, vsan)                                    // NEW pure call
const flags = computeThresholdFlags(merged.vpartition, datastores, opts?.thresholds) // NEW pure call
return { /* …all existing fields…, */ storage, vsan, flags, network }             // extend the return
```

### Pattern 3: Storage-lens toggle = the shipped accounting-toggle idiom (DRY, D-07)

**What:** D-07's two lenses (provisioned-vs-in-use / capacity-vs-used-vs-free) use the exact `AccountingModeToggle` shape: `<fieldset role="group"><legend className="sr-only">…<button aria-pressed>`. Same keyboard handling (Arrow Left/Right wraparound), same active treatment.

**Source pattern:** `src/components/dashboard/AccountingModeToggle.tsx` — copy the structure, change the union (`'consumption' | 'capacity'`) and the i18n namespace. `[VERIFIED: src/components/dashboard/AccountingModeToggle.tsx]`

### Pattern 4: In-memory thresholds = the `plannedRatios` slice precedent (D-02)

**What:** Add a `thresholds` field + `setThresholds` action to `snapshotStore.ts`, defaulting to RVTools-Analyser values. REPLACE-never-mutate (Zustand `Object.is`). Add `selectThresholds`/`selectSetThresholds` selectors. Thread it into `buildEstateView` via the `opts` bag (like `plannedRatios`), and into `useEstateView`'s memo deps (like `planned.cpu, planned.ram`). `[VERIFIED: src/store/snapshotStore.ts lines 59-66, 87, 137, 181, 209-213; src/hooks/useEstateView.ts lines 47-60]`

```ts
// Source: src/store/snapshotStore.ts (the plannedRatios precedent — mirror exactly)
thresholds: { fsUsedPct: 90, dsUsedPct: 85, luUsedPct: /* Claude picks in PLAN */ },
setThresholds: (t) => set({ thresholds: { ...t } }),   // fresh object — no persist, no localStorage
// clearAll() must also reset thresholds to defaults (refresh = defaults restored, D-02)
```

> **NOTE — store filename:** 09-CONTEXT and code_context call it `src/store/datasetStore.ts`. The actual shipped file is **`src/store/snapshotStore.ts`** (`useSnapshotStore`). The planner must reference the real path. `[VERIFIED: ls src/store/]`

### Pattern 5: vSAN relink — `vInfo.Path` is the join key (D-09), `vDisk."Disk Path"` is NOT

**What:** For a blank-`Cluster name` datastore row, parse the leading `[datastoreName]` token from each VM's `vInfo.Path` cell, build `datastoreName → Set<cluster>` from `vInfo.Cluster`, and attribute the blank datastore to that cluster set. NAA-dedupe key is `naa ?? name` (unchanged; one blank ds has empty NAA so the name fallback matters — empirically 1/67).

**When to use:** Only blank-`Cluster name` rows (real exports DO carry `Cluster name` for ~56 % of datastores; those are used directly). A blank datastore that no VM references (42/67 in the real file) stays estate-only with an em-dash — never fabricated onto a cluster (`feedback_no_domain_guesses_in_uat`).

```ts
// Source: empirically derived from 20260430_1400_allvCenters.xlsx (verified this session)
const BRACKET = /^\[([^\]]+)\]/
const dsToClusters = new Map<string, Set<string>>()
for (const vm of merged.vinfo) {
  const m = BRACKET.exec(vm.path ?? '')           // vInfo.Path, e.g. "[SITEL12_SILVER_08] vm/vm.vmx"
  if (!m) continue                                 // ~2 % unparseable (no config path) — skip, factual
  const ds = m[1].trim(), cl = vm.cluster.trim()
  if (!cl) continue
  ;(dsToClusters.get(ds) ?? dsToClusters.set(ds, new Set()).get(ds)!).add(cl)
}
// shared-LUN (size>1): empirically rare (1/67 — "Y-TEMPLATES" → 5 clusters).
// D-10 minimal-inference: surface as explicit "shared across N clusters" line,
// EXCLUDE from single-cluster rollups (no proportional guess, no double-count).
```

This requires the parser to **add `path` to `VInfoRow`** (a new optional string field, default `''`). `vInfo.Path` is column index 71 in the real file, header `Path`; aliases none needed but add `['path']`. This is a `VInfoRow` schema change — it ripples to `VInfoRowSchema` and every `VInfoRow` literal in tests (the P5 D-07 lesson). Default `''` so existing consumers are unaffected.

### Anti-Patterns to Avoid

- **Relinking off `vDisk."Disk Path"`:** empirically guest mount points, not `[datastore]` tokens — 0 % parseable. The 09-CONTEXT/memory phrasing "vInfo VM→datastore→cluster" is correct; the join column is `vInfo.Path`.
- **Summing shared-LUN capacity across clusters:** `perDatastore` already takes capacity from the FIRST row in an NAA group and never sums (Moderate-11). The relink must preserve this — attribute *identity to a cluster*, never re-sum capacity.
- **A 2nd `useMemo`:** grep-gated CI failure. All projections compose in `buildEstateView`.
- **Throwing when a network sheet is absent:** the Downloads workbook has zero network sheets — that is a supported input. Push a collected warning + factual degrade, exactly like `vDatastore`/`vPartition`.
- **Editorial verb / traffic-light on threshold flags:** D-04. Counts + neutral badge only. Note CLAUDE.md gotcha: a doc-comment containing the literal forbidden token can trip the security hook / grep gates — phrase absence comments without the literal token.
- **A new top-level nav component:** D-05 — extend the shipped `ViewToggle` union + `VIEWS` array (the P5/P6/P7/P8 precedent: one commit each added a segment).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Datastore NAA dedupe | A new dedupe pass | Existing `perDatastore`/`datastoreCountByCluster` (`naa ?? name` key) | Moderate-11 invariant already correct; relink only adds cluster attribution |
| Tabular storage/network views | A custom table | P3 `DataTable` + `ColumnPicker` + CSV | Virtualized, sortable, CSV-of-filtered already shipped; mind `inventory:col.<id>` keys |
| Lens / config toggles | A new toggle widget | `AccountingModeToggle` fieldset idiom | Keyboard + a11y + theming already solved |
| Treemap rendering | Custom SVG | ECharts `TreemapChart` via `<Chart>` | SVG renderer + HTML-report inline plan + theme already wired |
| In-memory config persistence | localStorage / context | Zustand `plannedRatios`-class slice | D-02 forbids localStorage; precedent exists |
| Detail navigation | React Router | Lifted `useState` view-state | No router in app shell; P5 precedent; 2nd-memo-free |
| RVTools sheet/column drift | New alias logic | `findSheet`/`findColumn`/`mapColumns` | Already handles `RVTools_tab*` prefix + case/whitespace; FR/DE aliases |

**Key insight:** P9 introduces **zero new libraries and zero new architectural mechanisms**. Every piece has a shipped precedent. The risk is entirely in (a) RVTools data-model correctness (mitigated by the empirical findings here) and (b) regressing the validated parser (mitigated by the canary + fixture gate).

## Runtime State Inventory

> P9 extends the validated parser (D-11) — this section is mandatory.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastore/dataset persistence (PAR-05 privacy invariant; store is in-memory `Map`). Verified: `src/store/snapshotStore.ts` does no browser-storage writes. | None |
| Live service config | None — 100 % client-side, no external services. | None |
| OS-registered state | None — browser app, no OS registration. | None |
| Secrets/env vars | None — no secrets in this phase. | None |
| Build artifacts | CI bundle-size gate (`npm run check:bundle-size`, ≤300 KB gz echarts chunk) will re-evaluate after `TreemapChart` is registered in `Chart.tsx`. Treemap is a small incremental series; verify the gate stays green. CI supply-chain gate (`npm run check:supply-chain`) unaffected (no new deps). | Run `npm run check:bundle-size` after the ECharts registry change |

**Parser-extension blast radius (the real "state" for a refactor-class change):**

- `VInfoRow` gains `path: string` (default `''`) → ripples to `VInfoRowSchema` (`schemas.ts`) and **every `VInfoRow` object literal in tests** (`*.test.ts` fixtures). The P5 D-07 `Powerstate`/`Template` change is the exact precedent — search `VInfoRow` literals and add the field. `[VERIFIED: src/engines/parser/schemas.ts lines 45-63]`
- `Snapshot` gains `vnetwork`, `vswitch`, `dvswitch`, `dvport` arrays (default `[]`) → ripples to `releaseRawRows` (must clear them too, like `vinfo: []`), `mergeSnapshotsToEstate` (must flatten them), `EMPTY_VIEW` if any are surfaced. `[VERIFIED: src/store/snapshotStore.ts lines 157-172; src/types/snapshot.ts lines 49-52]`
- `vPartition` already has `Free %` in real exports (verified: value `55` for a 57949/25668 partition). Adding `freePct` to `VPartitionRow` is OPTIONAL — the threshold engine can compute `used/cap` from the existing `capacityMib`/`consumedMib` (already parsed). Recommend computing, not adding a column (smaller blast radius). `consumedMib/capacityMib` is the reliable filesystem-used signal.
- The MiB canary fixture (`__fixtures__/rvtools-mib-canary.xlsx`) + `canary.test.ts` MUST stay green unchanged. New fixtures are additive.

## Common Pitfalls

### Pitfall 1: RVTools network sheets are frequently entirely absent

**What goes wrong:** Code assumes `vNetwork`/`vSwitch`/`dvSwitch` exist; a real export (the Downloads workbook, 8 sheets only) has none — the Network view throws or renders empty-without-explanation.
**Why it happens:** RVTools export scope is operator-configurable; trimmed exports (only vInfo/vHost/vDatastore/vPartition) are common.
**How to avoid:** Mirror the shipped OPTIONAL-sheet path exactly: `findSheet(...)` → if absent, `warnings.push({sheet, kind:'missing-sheet', message})` and adapt to `[]`. The Network view shows a factual "network inventory not available in this export" (i18n key, no editorial verb), not a crash. `[VERIFIED: src/engines/parser/adapters/rvtools.ts lines 353-378]`
**Warning signs:** A test fixture that always includes network sheets; no test for the network-absent case.

### Pitfall 2: The vSAN relink silently does nothing (the STR-04 repeat)

**What goes wrong:** The relink is wired but, like the original Pitfall-6 attempt (which used `vDatastore.Hosts` — a count, inert), it resolves zero datastores on real data and STR-04 stays unmet.
**Why it happens:** Joining on the wrong column. `vDatastore.Hosts` = numeric count. `vDisk."Disk Path"` = guest mount points. Only `vInfo.Path` carries the `[datastore]` token.
**How to avoid:** Validate against the named real file as a phase gate, asserting a **non-zero** relink count (empirically 25/67 blank datastores resolve, 116 VM rows match). A test that asserts `> 0` blank-cluster datastores get a cluster on this exact file is the regression guard the memory demands. Unit tests with synthetic data are insufficient (the explicit STR-04 lesson).
**Warning signs:** Relink count is 0 on the real file; "works on the fixture" without a real-file assertion.

### Pitfall 3: `inventory:col.<id>` header-key desync on new columns

**What goes wrong:** A new storage/network column `id` renders its raw key (`inventory.col.foo`) instead of a header because `DataTable` resolves headers via `useTranslation('inventory') → t('col.<id>')`, and the `headerFor` prop is CSV-only.
**Why it happens:** The CLAUDE.md-documented latent gotcha; new column ids need an `inventory:col.<id>` key in BOTH `en/` and `fr/inventory.json`.
**How to avoid:** For every new column id, add `inventory:col.<id>` to both locale files (or pass an explicit `headerFor` for non-inventory-namespace tables — but the shipped tables use the inventory namespace). Also ensure `<thead>` uses the same `flex w-full` + per-cell `flex-1` layout as the virtualized `<tbody>` (the P7-fixed desync). `[VERIFIED: CLAUDE.md §Gotchas; src/components/inventory/columns/datastoreColumns.ts]`
**Warning signs:** Raw `inventory.col.*` strings visible in a table header.

### Pitfall 4: Two RVTools metadata/sheet shapes diverge per export

**What goes wrong:** A new adapter assumes `vSwitch`/`vNetwork` column names from one workbook; another export uses `RVTools_tab*` sheet names or different headers.
**Why it happens:** RVTools 3.x vs 4.x and tab-naming differences (the Downloads file uses `RVTools_tabvHost` etc., already handled by `findSheet`'s prefix match).
**How to avoid:** Build alias arrays for every new column (the `VINFO_COLS` convention: longest/exact spelling first, FR/DE variants, MiB-suffixed first). The real column names captured below are the 4.x ground truth; keep `findSheet` prefix matching for `RVTools_tab*`. `[VERIFIED: both real workbooks this session]`
**Warning signs:** Hard-coded `sheet.Sheets['vSwitch']` instead of `findSheet(workbook, ['vswitch','rvtools_tabvswitch'])`.

## Code Examples

### Real RVTools column names (4.x — captured from `20260430_1400_allvCenters.xlsx` this session)

**vNetwork** (VM→portgroup mapping): `VM | Powerstate | Template | NIC label | Adapter | Network | Switch | Connected | Mac Address | Type | IPv4 Address | IPv6 Address | … | Datacenter | Cluster | Host | …`
Key columns for D-11: `VM`, `Network` (portgroup name), `Switch` (vSwitch/dvSwitch name), `Adapter`, `Connected`, `Cluster`, `Host`.

**vSwitch** (standard switches): `Host | Datacenter | Cluster | Switch | # Ports | Free Ports | Promiscuous Mode | … | MTU | …`
Key: `Host`, `Cluster`, `Switch`, `# Ports`, `Free Ports`, `MTU`.

**vPort** (std-switch portgroups): `Host | Datacenter | Cluster | Port Group | Switch | VLAN | …`
Key: `Host`, `Switch`, `Port Group`, `VLAN`.

**dvSwitch** (distributed switches): `Switch | Datacenter | Name | Vendor | Version | Host members | Max Ports | # Ports | # VMs | … | Max MTU | …`
Key: `Switch`/`Name`, `Version`, `Host members`, `# Ports`, `# VMs`, `Max MTU`.

**dvPort** (distributed portgroups): `Port | Switch | Type | # Ports | VLAN | Speed | Active Uplink | Standby Uplink | …`
Key: `Port`, `Switch`, `VLAN`, `Active Uplink`, `Standby Uplink`.

**vDatastore** (already parsed; note extra columns available for detail views): adds `# VMs total`, `# VMs`, `In Use MiB`, `Free %`, `# Hosts`, `Cluster name`, `Cluster capacity MiB`. The shipped adapter already reads name/capacity/free/provisioned/naa/type/hosts/clusterName — `In Use MiB` and `# VMs` are NOT yet parsed but are present and useful for the Datastore detail drill (D-06).

**vInfo.Path** (the relink key — column index 71, header `Path`): `[SITEL12_SILVER_08] kdc3chkpntsm101/kdc3chkpntsm101.vmx`. Bracket token = owning datastore name.

**vPartition** has `Free %` natively (e.g. `55`); but `Capacity MiB`/`Consumed MiB` are already parsed — compute used% from those (no schema change).

### Empirical relink result (the validation target)

```
File: 20260430_1400_allvCenters.xlsx
  vDatastore rows = 170 ; blank Cluster name = 75 (72 VMFS, 2 NFS, 1 vsan)
  vInfo rows = 1447 ; distinct clusters = 18
  Relink via vInfo.Path: 25 / 67 distinct blank-cluster datastores resolved
    (116 VM rows matched; 34/1447 vInfo rows have no parseable Path → skipped)
  Shared-LUN (resolves to >1 cluster): 1 — "Y-TEMPLATES" → {CL_11,CL_PREPROD,CL_12,CL_13,CL_14}
  Unrelinkable (no VM references them): 42 — stay estate-only, em-dash, NOT fabricated
  NAA(Address) dedupe: 165 distinct, 0 NAA→multiple-name collisions, 1/67 blank ds has empty NAA
```
(Counts differ slightly between "75 rows" and "67/75 distinct names" because some blank-cluster datastore names repeat across rows; dedupe on `naa ?? name` collapses them — the existing Moderate-11 rule, unchanged.)

### ECharts treemap option shape (D-08 consumption lens)

```ts
// Source: ctx7 /apache/echarts-doc treemap.md (verified this session) — built by a
// pure selector off memoized EstateView.storage, passed to the shipped <Chart>.
const option: EChartsOption = {
  series: [{
    type: 'treemap',                 // requires TreemapChart added to Chart.tsx echarts.use([])
    data: [{ name: 'CL_12', value: 184320, children: [
              { name: 'SITEL12_SILVER_08', value: 92160 } ] }],
    label: { show: true },           // node description text
    upperLabel: { show: true },      // parent-level label band (cluster → datastore drill)
    breadcrumb: { show: true },
    // colorMappingBy/visualMin/visualMax left default — Midnight Executive theme
    // supplies the palette; NO verdict color (factual, D-04 spirit).
  }],
}
// stacked-bar (capacity lens) reuses the already-registered BarChart:
//   series: [{type:'bar', stack:'cap', name:'used'}, {type:'bar', stack:'cap', name:'free'}]
```

### Adding a ViewToggle segment (the shipped P5/P6/P7/P8 precedent)

```tsx
// Source: src/components/ViewToggle.tsx + git history (one commit per segment)
export type AppView =
  'dashboard'|'inventory'|'hosts'|'planning'|'eos'|'trends'|'storage'|'network'
const VIEWS = ['dashboard','inventory','hosts','planning','eos','trends','storage','network'] as const
// + add nav.storage / nav.network keys to i18n/locales/{en,fr}/inventory.json (ViewToggle uses
//   the 'inventory' namespace for nav.* — verified line 28 of ViewToggle.tsx)
// + add the two branches in App.tsx's activeView chain (verified App.tsx lines 40-52)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vDatastore.Hosts` host-name join for blank-cluster attribution (Pitfall-6/A3) | `vInfo.Path` `[datastore]` token → cluster | This phase (D-09) | The original join was inert (Hosts = count); STR-04 finally closeable |
| Datastore table = `perDatastore` only | + per-cluster/esx/vm storage-by-X projections | This phase (D-07) | Storage view needs new pure projections, same single-pass pattern |
| ECharts registry: bar/pie/gauge/heatmap/line | + treemap | This phase (D-08) | One-line `echarts.use([...])` addition in `Chart.tsx`; re-check bundle gate |

**Deprecated/outdated:**
- The `splitHosts`/`hostClusterMap` path in `perDatastore.ts` (Pitfall-6 attempt) is **correct but inert on real data** per the binding memory. P9's `vInfo.Path` relink supersedes it as the effective attribution path. Do not delete the old code (it is safe and never mis-attributes); add the new path alongside and ensure no double-attribution (a datastore resolved by `vInfo.Path` should not also be counted via the inert `Hosts` path — it won't be, since `Hosts` is numeric and `splitHosts` yields nothing, but assert this).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | RVTools 3.10/3.11/4.0 emit the same `vSwitch`/`vNetwork`/`dvSwitch` column names as the 4.x file inspected (only 4.4-class files were on this machine) | Code Examples | MEDIUM — alias arrays mitigate; add 3.x aliases defensively. Validate if a 3.x export becomes available |
| A2 | `vInfo.Path` is present in 3.x exports too (verified present in both 4.x files on this machine) | Pattern 5 | MEDIUM — if absent in 3.x, relink degrades to em-dash for those files (acceptable factual fallback, not a crash) |
| A3 | LU/logical-unit threshold maps to per-datastore used% (RVTools has no separate "logical unit" sheet; `vDatastore` is the LU surface) | User Constraints D-03 | LOW — planner documents the chosen LU semantic + default in PLAN per D-03 |
| A4 | The shared-LUN "shared across N clusters" line (D-10) excluded from single-cluster rollups is the preferred minimal-inference choice | Pattern 5 | LOW — empirically only 1/67 datastores is shared; planner confirms approach + validates on a real multi-cluster file |

## Open Questions

1. **3.x network-sheet column drift**
   - What we know: 4.x column names captured exactly; `findSheet` handles `RVTools_tab*` prefixes.
   - What's unclear: exact `vSwitch`/`dvSwitch` headers in RVTools 3.10/3.11 (no 3.x export on this machine).
   - Recommendation: Build alias arrays (longest-first, FR/DE) and add a `findColumn`-absent → empty-string fallback per field (the shipped convention); flag any 3.x file for a follow-up validation.

2. **LU threshold semantic (D-03 Claude's discretion)**
   - What we know: RVTools has no dedicated logical-unit sheet; `vDatastore` (with NAA `Address`) is the LU-equivalent surface.
   - What's unclear: whether "LU" should flag on datastore used% or a distinct metric.
   - Recommendation: Define LU = NAA-keyed datastore; LU threshold = a second datastore-used% line (default ~85 %, planner documents in PLAN per D-03). No new data needed.

3. **Datastore detail "VMs on it" source**
   - What we know: `vInfo.Path` maps VM→datastore (the relink key); `vDatastore."# VMs"` gives a count.
   - Recommendation: Use the `vInfo.Path` map (already built for the relink) to list VMs per datastore in the Datastore detail drill — single source, no new join.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Real RVTools workbook (full sheet set) | vSAN-relink + network real-file validation | ✓ | `~/Library/CloudStorage/OneDrive-Home/20260430_1400_allvCenters.xlsx` (27 sheets, 75 blank-cluster ds) | — |
| Real RVTools workbook (trimmed, no network) | D-11 factual-degrade validation | ✓ | `~/Downloads/RVTools_export_all_2026-01-07_10.23.35.xlsx` (8 sheets, no network) | — |
| `xlsx` (SheetJS, CDN tarball) | parser | ✓ | 0.20.3 (node_modules) | — |
| Vitest + jsdom | unit/component tests | ✓ | 4.1.2 | Browser Mode for real ECharts SVG geometry if needed |
| ECharts treemap | D-08 | ✓ | echarts ^6.0.0 (treemap in `echarts/charts`) | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None — both the full and the trimmed real workbooks are present for the two mandated validation cases.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.2` + `@testing-library/react` `^16.3.2` (jsdom default) |
| Config file | (vitest config in `vite.config.ts` / `tsconfig.test.json`) |
| Quick run command | `npm run test:run` (CI mode; RTK: `rtk vitest`) |
| Full suite command | `npm run test:run && npm run test:coverage` (engines/ gated ≥75 %) |

### Phase Requirements → Test Map (planner derives final REQ-IDs)
| Group | Behavior | Test Type | Automated Command | File Exists? |
|-------|----------|-----------|-------------------|-------------|
| Parser ext | MiB canary still 102400 (no regression) | unit | `npm run test:run -- canary` | ✅ shipped (`canary.test.ts`) |
| Parser ext | vNetwork/vSwitch/dvSwitch absent → warning + `[]`, no throw | unit | `npm run test:run -- rvtools` | ❌ Wave 0 (extend `adapters/rvtools.test.ts`) |
| Parser ext | vNetwork/vSwitch/dvSwitch present → adapted rows | unit | `npm run test:run -- rvtools` | ❌ Wave 0 |
| VSR relink | blank-cluster ds resolves via `vInfo.Path` (synthetic) | unit | `npm run test:run -- vsanRelink` | ❌ Wave 0 (`vsanRelink.test.ts`) |
| VSR relink | **real-file: ≥1 blank ds resolves on `20260430_1400_allvCenters.xlsx`** | integration | a new real-file test reading the named workbook, asserting relink count > 0 (≈25 distinct, 116 rows) | ❌ Wave 0 (the STR-04 regression guard the memory demands) |
| VSR shared-LUN | `Y-TEMPLATES`-class ds surfaced as "shared across N", excluded from single-cluster rollup | unit + real-file | `npm run test:run -- vsanRelink` | ❌ Wave 0 |
| Storage-by-X | two-lens projection sums match estate total (no double-count) | unit | `npm run test:run -- storageByX` | ❌ Wave 0 |
| Threshold flags | fs partition ≥90 % used flagged; datastore >85 % flagged; defaults restored on clearAll | unit | `npm run test:run -- thresholdFlags` | ❌ Wave 0 |
| Thresholds slice | REPLACE-never-mutate; no localStorage write | unit | `npm run test:run -- snapshotStore` | ✅ extend (`snapshotStore.test.ts`) |
| UI | ViewToggle has 8 segments incl storage/network; arrow-key wrap | component | `npm run test:run -- ViewToggle` | ✅ extend |
| UI | Datastore/VM/ESX detail drill renders + back; factual, no editorial verb | component | `npm run test:run -- StorageView` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run -- <changed-area>` (RTK: `rtk vitest`)
- **Per wave merge:** `npm run test:run` (full) + `npm run typecheck` + `npx @biomejs/biome check .`
- **Phase gate:** full suite green + the **real-file relink test green on `20260430_1400_allvCenters.xlsx`** + manual real-file check of both workbooks (full + trimmed) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/engines/aggregation/vsanRelink.test.ts` — synthetic + **real-file** relink (the STR-04 guard)
- [ ] `src/engines/aggregation/storageByX.test.ts` — two-lens, no double-count
- [ ] `src/engines/aggregation/thresholdFlags.test.ts` — default + edited thresholds
- [ ] `src/engines/aggregation/network.test.ts` — vswitch/dvswitch/portgroup rollups
- [ ] Extend `src/engines/parser/adapters/rvtools.test.ts` — network sheets present + absent
- [ ] Extend `src/store/snapshotStore.test.ts` — thresholds slice
- [ ] Component tests for StorageView/NetworkView/detail drills
- [ ] A real-file integration fixture path: read `~/Library/CloudStorage/OneDrive-Home/20260430_1400_allvCenters.xlsx` (gate that skips gracefully in CI if the file is absent, asserts when present — the canary.test.ts `readFileSync` pattern, but pointed at the real file via an env-guarded `it`)

> The canary fixture + `canary.test.ts` must remain green and unchanged (MiB regression guard). New fixtures/tests are additive.

## Project Constraints (from CLAUDE.md)

- **Engines pure:** no React/DOM/Zustand/Zod in `engines/**` (Zod only at parser boundary). New `vsanRelink.ts`/`storageByX.ts`/`thresholdFlags.ts`/`network.ts` are pure functions, Vitest-gated ≥75 %.
- **Single `useMemo`:** `useEstateView` is the only memo; all P9 projections compose in `buildEstateView`. A 2nd memo fails the grep gate.
- **Inputs-only store:** thresholds slice mirrors `plannedRatios` (REPLACE-never-mutate, no persist, no localStorage). No `vatlas-thresholds` key (only `vatlas-theme`/`vatlas-lang` are allowed).
- **Branded units:** `MiB`/`GiB` etc.; never raw `* 1.048576` (RVTools "MB" is MiB, ADR-0010). Threshold math is ratio-based (`consumedMib/capacityMib`) — unit-safe.
- **i18n EN/FR parity:** new `storage`/`network`/`alerts` namespaces, keys in BOTH `en/` and `fr/`; no pre-formatted numbers in strings; no editorial verbs (`recommend`/`should`/`poor`/`good`/traffic-light). ViewToggle nav.* keys go in the `inventory` namespace (verified).
- **Toggles:** reuse the `<fieldset role="group">` + `aria-pressed` idiom for the storage-lens toggle — don't reinvent.
- **DataTable gotcha:** new column ids need `inventory:col.<id>` in both locale files; `<thead>` must use the same `flex w-full`/`flex-1` layout as the virtualized `<tbody>`.
- **Lint:** run `npx @biomejs/biome check .` directly (NOT `npm run lint` — RTK intercepts and prints a bogus ESLint error; the linter is Biome).
- **Privacy guard throws:** no non-same-origin network calls anywhere (the guard throws synchronously by design). P9 is fully client-side; no fetch.
- **Grep-gate / security-hook gotcha:** a doc-comment containing a literal forbidden token (e.g. spelling out a banned verb or a clock constructor) trips the gate. Phrase absence comments without the literal token.
- **Commit prefix:** `<type>(NN-NN): …` (phase-plan id), e.g. `feat(09-02): …`.
- After `/gsd-execute-phase`, manually flip ROADMAP `[ ]→[x]` and the Progress-table row, and update REQUIREMENTS Traceability (the derived P9 IDs).

## Security Domain

> `security_enforcement` not explicitly disabled — included. P9 is client-side, no auth/session/network; the relevant ASVS surface is input validation of the new parsed sheets.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface (client-only) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No server/access control |
| V5 Input Validation | **yes** | Zod schemas at the parser boundary for every new row type (`V{Network,Switch,DvSwitch,DvPort}RowSchema`); `readString`/`readNumber` coercion already defensive; invalid rows dropped + reported, never thrown unchecked |
| V6 Cryptography | no | No crypto in this phase |

### Known Threat Patterns for {client-side RVTools parser + ECharts SVG}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/oversized `.xlsx` (zip-bomb, ReDoS) | DoS | `xlsx@0.20.3` (CVE-fixed tarball, never npm 0.18.5); parser already in a Web Worker (UI not blocked); `readNumber` regex is bounded |
| Untrusted cell content injected into ECharts labels (treemap node names from datastore names) | Tampering/XSS | ECharts SVG renderer escapes text content; do NOT use `formatter` with raw HTML; pass datastore/portgroup names as plain `name`/`value` data (the shipped `<Chart>` pattern) |
| Untrusted cell content in CSV export (spreadsheet formula injection — a leading `=` `+` `-` `@` in a datastore/portgroup name) | Tampering | The P3 CSV path uses raw accessor values; the planner must confirm the shipped CSV idiom already neutralizes formula-trigger lead characters for the new columns — reuse the existing escaping, do not re-implement |
| `vInfo.Path` parsed via regex `/^\[([^\]]+)\]/` | DoS (ReDoS) | The regex is linear (anchored, negated char class, no backtracking) — safe; documented here so the planner does not "improve" it into a backtracking pattern |

## Sources

### Primary (HIGH confidence)
- **Real RVTools workbooks inspected this session** (authoritative ground truth):
  - `~/Library/CloudStorage/OneDrive-Home/20260430_1400_allvCenters.xlsx` — 27 sheets, exact headers for vNetwork/vSwitch/vPort/dvSwitch/dvPort/vDisk/vPartition/vDatastore/vInfo; 75 blank-cluster datastores; relink validated (25/67 resolve, 1 shared-LUN, 42 unrelinkable).
  - `~/Downloads/RVTools_export_all_2026-01-07_10.23.35.xlsx` — 8 sheets, NO network sheets (the factual-degrade case), `RVTools_tab*` naming.
- Shipped source (verified by reading): `src/engines/parser/adapters/rvtools.ts`, `columnMap.ts`, `schemas.ts`, `src/engines/aggregation/estateView.ts`, `perDatastore.ts`, `guestData.ts`, `src/store/snapshotStore.ts`, `src/hooks/useEstateView.ts`, `src/components/{ViewToggle,Chart}.tsx`, `src/components/cluster/ClusterDetail.tsx`, `src/components/dashboard/AccountingModeToggle.tsx`, `src/components/inventory/{DatastoreTable,columns/datastoreColumns}.tsx`, `src/types/{snapshot,estate}.ts`, `src/engines/parser/canary.test.ts`, `src/App.tsx`.
- `ctx7 /apache/echarts-doc` treemap.md — treemap series data structure, `visualMin`/`visualMax`, `label`/`upperLabel` (ECharts v6 API confirmed stable).
- `.planning/` docs: 09-CONTEXT.md, 05-CONTEXT.md, REQUIREMENTS.md, ANALYTICS-CORE-REPLAN.md, the `rvtools-vdatastore-hosts-is-count` memory.

### Secondary (MEDIUM confidence)
- git history (`git log -- src/components/ViewToggle.tsx`) — confirms one-commit-per-segment precedent (P5/P6/P7/P8).

### Tertiary (LOW confidence)
- RVTools 3.10/3.11/4.0 network-sheet column names (no 3.x export available on this machine) — assumed similar to 4.x; mitigated by alias arrays (A1/A2).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; every reuse verified in shipped source; ECharts treemap verified via Context7.
- Parser/relink data model: HIGH — empirically validated against the two real workbooks; the `vInfo.Path` correction is the load-bearing finding.
- Architecture/patterns: HIGH — every pattern has a shipped precedent read this session.
- 3.x column drift: LOW — no 3.x sample; alias-array mitigation documented.

**Research date:** 2026-05-17
**Valid until:** 2026-06-16 (30 days — stable; the only volatility is RVTools-version column drift, mitigated by aliases)
