# Phase 9: Storage / Network / Detailed Views + Threshold Alerting - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 22 new/modified files across parser, engines, store, hook, components, i18n
**Analogs found:** 22 / 22 (every P9 piece has a shipped precedent — RESEARCH confirmed "zero new architectural mechanisms")

> **Filename discrepancies confirmed (planner MUST use the real paths):**
>
> - CONTEXT/code_context says `src/store/datasetStore.ts` -> **actual shipped file is `src/store/snapshotStore.ts`** (`useSnapshotStore`). [VERIFIED: read]
> - CONTEXT references `src/engines/snapshotMerge` for the merge — actual file is **`src/engines/snapshotMerge/mergeSnapshotsToEstate.ts`** (directory, not a flat module); the merged-row type is `MergedEstate` (NOT `Snapshot`). `buildEstateView` consumes `MergedEstate`, not raw `Snapshot`. [VERIFIED: read]
> - CONTEXT/RESEARCH say "extend `src/types/{snapshot,vinfo,vhost}.ts`" — `VInfoRow` lives in **`src/types/vinfo.ts`** (re-exported via `@/types`); `Snapshot`/`VDatastoreRow`/`VPartitionRow`/`ParseError` live in **`src/types/snapshot.ts`**. New `V{Network,Switch,DvSwitch,DvPort}Row` interfaces are new files or additions to `snapshot.ts` (planner decides; `snapshot.ts` is the precedent home for non-vinfo/vhost row types).
> - RESEARCH "`vInfo.Path`" relink key -> new field is `path: string` on **`VInfoRow`** (`src/types/vinfo.ts` + `VInfoRowSchema` in `schemas.ts` + `adaptRvtoolsVInfo` in `adapters/rvtools.ts` + every `VInfoRow` test literal). Default `''`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engines/parser/adapters/rvtools.ts` (EXTEND) | parser/adapter | transform | self — `adaptRvtoolsVDatastore`/`adaptRvtoolsVPartition` + `adaptRvtools` OPTIONAL-sheet block | exact |
| `src/engines/parser/schemas.ts` (EXTEND) | model/validation | transform | self — `VDatastoreRowSchema` / `VPartitionRowSchema` | exact |
| `src/types/snapshot.ts` (EXTEND) | model | — | self — `VDatastoreRow` / `VPartitionRow` interfaces; `Snapshot` array fields | exact |
| `src/types/vinfo.ts` (EXTEND) | model | — | self — `VInfoRow` (add `path: string`) | exact |
| `src/engines/aggregation/vsanRelink.ts` (NEW) | engine | transform | `perDatastore.ts` (`datastoreCountByCluster` Map-accumulate join) | role+flow match |
| `src/engines/aggregation/storageByX.ts` (NEW) | engine | transform | `perDatastore.ts` / `perEsx.ts` (Map-accumulate rollup) | role+flow match |
| `src/engines/aggregation/thresholdFlags.ts` (NEW) | engine | transform | `guestData.ts` / `osFamily.ts` (pure projection helper) | role match |
| `src/engines/aggregation/network.ts` (NEW) | engine | transform | `perDatastore.ts` (Map-accumulate rollup) | role+flow match |
| `src/engines/aggregation/estateView.ts` (EXTEND) | engine/composition | transform | self — the established `const x = pureCall(...)` + extend return + `EMPTY_*` frozen | exact |
| `src/engines/aggregation/index.ts` (EXTEND) | barrel | — | self — `export { perDatastore } from './perDatastore'` | exact |
| `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts` (EXTEND) | engine | transform | self — `outVdatastore`/`outVpartition` flatten loop + `MergedEstate` shape | exact |
| `src/store/snapshotStore.ts` (EXTEND) | store | event-driven | self — `plannedRatios` slice + `setPlannedRatios` + selectors + `clearAll` | exact |
| `src/hooks/useEstateView.ts` (EXTEND) | hook | request-response | self — `selectPlannedRatios` read + `opts` thread + memo dep | exact |
| `src/components/ViewToggle.tsx` (EXTEND) | component/nav | event-driven | self — `AppView` union + `VIEWS` array (P5/P6/P7/P8 one-segment-per-commit) | exact |
| `src/components/Chart.tsx` (EXTEND) | component | — | self — `echarts.use([...])` registry (one-line `TreemapChart` add) | exact |
| `src/components/storage/StorageView.tsx` (NEW) | component/view-shell | request-response | `GlobalDashboard.tsx` / `HostsView.tsx` (single `useEstateView` consumer + lifted drill state) | role match |
| `src/components/storage/StorageLensToggle.tsx` (NEW) | component/toggle | event-driven | `AccountingModeToggle.tsx` | exact |
| `src/components/storage/DatastoreDetail.tsx` (NEW) | component/detail-drill | request-response | `cluster/ClusterDetail.tsx` | exact |
| `src/components/storage/VmDetail.tsx` (NEW) | component/detail-drill | request-response | `cluster/ClusterDetail.tsx` | exact |
| `src/components/storage/ThresholdConfig.tsx` (NEW) | component/config | event-driven | `planning/PlannedRatiosControl.tsx` | exact |
| `src/components/network/NetworkView.tsx` (NEW) | component/view-shell | request-response | `HostsView.tsx` + `inventory/DatastoreTable.tsx` | role match |
| `src/components/hosts/HostsView.tsx` (EXTEND) + ESX-detail | component/detail-drill | request-response | `cluster/ClusterDetail.tsx` (the drill shape) + `GlobalDashboard` drill wiring | exact |
| `src/components/inventory/columns/*.ts` (NEW col defs) | config | — | `inventory/columns/datastoreColumns.ts` + `DatastoreTable.tsx` | exact |
| `src/App.tsx` (EXTEND) | view router | event-driven | self — `activeView ===` chain | exact |
| `src/i18n/index.ts` (EXTEND) + `locales/{en,fr}/{storage,network,alerts}.json` (NEW) | config/i18n | — | self — `NAMESPACES` + `resources` registration | exact |

---

## Pattern Assignments

### `src/engines/parser/adapters/rvtools.ts` (EXTEND — parser/adapter, transform)

**Analog:** self (`adaptRvtoolsVDatastore` lines 240-257; OPTIONAL-sheet block lines 353-389).

**Column-alias-map pattern** (the `VINFO_COLS`/`VDATASTORE_COLS` convention, lines 49-137): longest/exact spelling FIRST, MiB-suffixed before MB, FR/DE variants appended. New `VNETWORK_COLS`/`VSWITCH_COLS`/`VDVSWITCH_COLS`/`VDVPORT_COLS` follow this exact shape. Real 4.x headers are enumerated in 09-RESEARCH section Code Examples (vNetwork: `VM`/`Network`/`Switch`/`Adapter`/`Connected`/`Cluster`/`Host`; vSwitch: `Host`/`Cluster`/`Switch`/`# Ports`/`Free Ports`/`MTU`; dvSwitch: `Switch`/`Name`/`Version`/`Host members`/`# Ports`/`# VMs`/`Max MTU`; dvPort: `Port`/`Switch`/`VLAN`/`Active Uplink`/`Standby Uplink`).

**Adapter-function pattern** (lines 240-257): `const cols = mapColumns(sheet.headers, V*_COLS)` then `sheet.rows.map((row): RowType => ({ field: readString(readCol(row, cols.field)), num: mib(Math.max(0, readNumber(readCol(row, cols.num)))) })).filter((r) => !isInternalRow(r.key))`. New `adaptRvtoolsVNetwork`/`VSwitch`/`DvSwitch`/`DvPort` copy this shape verbatim. Numeric port/VLAN counts use `Math.max(0, Math.trunc(readNumber(...)))`; never brand network counts as MiB.

**`vInfo.Path` addition** (extend `VINFO_COLS` lines 49-78 and `adaptRvtoolsVInfo` lines 178-216): add `path: ['path']` to `VINFO_COLS`; add `path: readString(readCol(row, cols.path))` to the returned `VInfoRow` literal (RVTools header is exactly `Path`, col index 71; default `''` so existing consumers are unaffected — the P5 `Powerstate`/`Template` precedent at lines 57-63/194-203).

**OPTIONAL-sheet factual-degrade pattern** (lines 353-369 — the load-bearing P9 reuse):

```ts
const dsSheet = findSheet(workbook, ['vdatastore', 'rvtools_tabvdatastore'])
if (!dsSheet) {
  warnings.push({
    sheet: 'vDatastore',
    kind: 'missing-sheet',
    message: 'optional sheet vDatastore absent — datastore views will be empty',
  })
}
// return: vdatastore: dsSheet ? adaptRvtoolsVDatastore(dsSheet) : []   // absent => [] + warning, NEVER throw
```

The four new network sheets are OPTIONAL — copy this `findSheet(...)` -> `if (!sheet) warnings.push({kind:'missing-sheet'})` -> `sheet ? adapt(sheet) : []` block verbatim for each (D-11; the Downloads 8-sheet workbook has zero network sheets and must not throw). REQUIRED-sheet `parseError(...)` (lines 27-41, 336-342) is NOT the pattern for network sheets — only `vInfo`/`vHost` throw.

**`adaptRvtools` return type** (lines 323-332): extend the return object type union with `vnetwork: VNetworkRow[]` etc. — same shape as `vdatastore`/`vpartition`.

---

### `src/engines/parser/schemas.ts` (EXTEND — model/validation, transform)

**Analog:** self (`VDatastoreRowSchema` lines 81-93, `VPartitionRowSchema` lines 95-101).

**Schema pattern** (lines 81-101): `z.ZodType<RowType>` annotation (drift stops compilation), hand-rolled `MibSchema` brand transform (NOT `.brand<>()`), empty-string-allowed `z.string().trim()` for optional text fields:

```ts
export const VDatastoreRowSchema: z.ZodType<VDatastoreRow> = z.object({
  name: z.string().trim().min(1),
  capacityMib: MibSchema,
  clusterName: z.string().trim(),   // empty allowed — do NOT .min(1) optional text
})
```

New `VNetworkRowSchema`/`VSwitchRowSchema`/`VDvSwitchRowSchema`/`VDvPortRowSchema` copy this exactly; numeric counts use a non-negative `z.number()` (NOT `MibSchema`). **`VInfoRowSchema` change** (lines 45-63): add `path: z.string().trim()` (empty allowed) — this is the P5-class blast-radius change (ripples to every `VInfoRow` test literal; default `''`).

---

### `src/types/vinfo.ts` + `src/types/snapshot.ts` (EXTEND — model)

**Analog:** self (`VInfoRow` vinfo.ts lines 16-53; `VDatastoreRow` snapshot.ts lines 70-90; `Snapshot` lines 30-67).

- `VInfoRow` (vinfo.ts): add `path: string` with doc-comment `RVTools vInfo Path — [datastore] vm/vm.vmx. Empty when absent.`
- New `V{Network,Switch,DvSwitch,DvPort}Row` interfaces: model on `VDatastoreRow` (snapshot.ts lines 70-90) — plain string/number/branded fields, doc-comment per field naming the RVTools source column, "Empty string when absent" convention.
- `Snapshot` (snapshot.ts lines 49-53): add `vnetwork: VNetworkRow[]` / `vswitch` / `dvswitch` / `dvport` arrays beside `vdatastore`/`vpartition`.

---

### `src/engines/aggregation/vsanRelink.ts` (NEW — engine, transform)

**Analog:** `src/engines/aggregation/perDatastore.ts` (`datastoreCountByCluster` lines 51-79 — the Map-accumulate join + `naa ?? name` dedupe).

**Join + dedupe pattern to copy** (perDatastore.ts lines 21, 51-79): `dedupeKey = row.naa ?? row.name` (line 21 — preserve verbatim; one blank ds has empty NAA so the name fallback is load-bearing). Build `Map<string, Set<string>>` accumulate exactly like `keysByCluster` (lines 55-77).

**The relink-specific join** (empirically derived, 09-RESEARCH Pattern 5 — `vInfo.Path` is the key, NOT `vDisk."Disk Path"`):

```ts
const BRACKET = /^\[([^\]]+)\]/                         // anchored, linear — do NOT rewrite into a backtracking pattern (ReDoS)
const dsToClusters = new Map<string, Set<string>>()
for (const vm of merged.vinfo) {
  const m = BRACKET.exec(vm.path ?? '')                 // vInfo.Path, e.g. "[SITEL12_SILVER_08] vm/vm.vmx"
  if (!m) continue                                       // ~2% unparseable — skip, factual
  const ds = m[1].trim(), cl = vm.cluster.trim()
  if (!cl) continue
  ;(dsToClusters.get(ds) ?? dsToClusters.set(ds, new Set()).get(ds)!).add(cl)
}
// size>1 => shared-LUN (empirically 1/67 "Y-TEMPLATES"->5 clusters): surface as
// "shared across N clusters", EXCLUDE from single-cluster rollups (D-10, no guess).
// Unrelinkable (no VM references it, 42/67): stays estate-only, em-dash sentinel.
```

**Anti-pattern (RESEARCH section State of the Art):** do NOT delete `perDatastore.ts`'s `splitHosts`/`hostClusterMap` Pitfall-6 path (lines 28-32, 67-74) — it is correct-but-inert; add the `vInfo.Path` path alongside and assert no double-attribution. **Never re-sum shared-LUN capacity** — `perDatastore` already takes capacity from the FIRST key-group row (lines 91-109); the relink attributes IDENTITY only, never re-sums.

Pure module (no React/Zustand/Zod), Vitest-gated >=75% — same constraint as every `engines/aggregation/*`.

---

### `src/engines/aggregation/storageByX.ts` / `network.ts` (NEW — engine, transform)

**Analog:** `perDatastore.ts` (lines 81-112) + `perEsx.ts` — Map-accumulate rollup, branded-unit math via `mib()`.

**Rollup pattern** (perDatastore.ts lines 81-112): group into `Map<key, rows[]>`, reduce into a typed aggregate array, brand sums with `mib(...)`. `storageByX` produces the two-lens projection (consumption: provisioned-vs-in-use incl `.vswp`+snapshots — `vInfo.inUseMib` already includes these per `estate.ts` line 517; capacity: capacity-vs-used-vs-free from `DatastoreAggregate`). Sums must reconcile to the estate total with no double-count (the Moderate-11 first-row-capacity rule, perDatastore.ts lines 94-97). `network.ts` rolls up vswitch/dvswitch/portgroup/uplink the same Map-accumulate way.

---

### `src/engines/aggregation/thresholdFlags.ts` (NEW — engine, transform)

**Analog:** `guestData.ts` (pure aggregate helper consumed by `estateView.ts`).

Pure projection: `(vpartition, datastores, thresholds) -> { fsFlagged, dsFlagged, luFlagged, counts }`. Filesystem-used signal is `consumedMib / capacityMib` from `VPartitionRow` (already parsed, snapshot.ts lines 93-99 — RESEARCH section Runtime State Inventory: do NOT add a `freePct` column, compute it, smaller blast radius). LU semantic (RESEARCH Open Q2 / A3): NAA-keyed datastore used% — a second datastore-used% line, LU default chosen by planner in PLAN (D-03). Branded-unit-safe (ratio math). **D-04: no verdict, no editorial verb, no traffic-light** — return counts + a boolean flag per row only; the doc-comment must not spell forbidden tokens literally (CLAUDE.md grep-gate gotcha).

---

### `src/engines/aggregation/estateView.ts` (EXTEND — engine/composition, transform)

**Analog:** self — the established single-pass extension shape (lines 86-305).

**Extension pattern** (the verified shape — RESEARCH Pattern 2): add pure calls in the existing single pass beside the `perDatastore`/`buildEosProjection`/`buildTrendSeries` calls (lines 112, 272, 284), thread new `opts` fields, extend the return literal (lines 286-305):

```ts
const vsan = relinkBlankClusterDatastores(merged.vinfo, merged.vdatastore)   // NEW pure call
const storage = storageByX(merged, mode, vsan)                                // NEW pure call
const network = networkRollup(merged)                                         // NEW pure call
const flags = computeThresholdFlags(merged.vpartition, datastores, opts?.thresholds) // NEW
return { /* ...all existing fields..., */ storage, vsan, network, flags }      // extend return
```

**`opts` bag pattern** (lines 72-85): add `thresholds?: { fsUsedPct; dsUsedPct; luUsedPct }` beside `plannedRatios?` with an `opts?.thresholds ?? DEFAULT` defaulting (mirror line 87-88 `stretchedClusters ?? new Set()`).
**`EMPTY_VIEW` pattern** (lines 307-372): add frozen empty equivalents for every new field — copy the `EMPTY_INSIGHTS`/`EMPTY_EOS` `Object.freeze({...})` shape (lines 307-347) and add them to the frozen `EMPTY_VIEW` literal (lines 354-372). **No 2nd `useMemo` anywhere** (grep-gated CI failure).
`EstateView` interface (`src/types/estate.ts` lines 448-498): add `storage`/`vsan`/`network`/`flags` fields with the `T | null` / always-present doc-comment idiom (lines 462-497 are the precedent comments — "Produced inside the single `buildEstateView` pass — no second `useMemo`").

---

### `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts` (EXTEND — engine, transform)

**Analog:** self (lines 9-25, 120-134).

`MergedEstate` interface (lines 9-17) gains `vnetwork`/`vswitch`/`dvswitch`/`dvport` arrays; `EMPTY_MERGED` (lines 19-25) gains `[]` for each; the flatten loop (lines 120-125) gains `for (const x of snap.vnetwork) outVnetwork.push(x)` per array; return literal (lines 127-133) extended. `vInfo.path` rides along automatically (it is a `VInfoRow` field; the rewrite-or-passthrough at lines 99-107 spreads `{...v}` so `path` survives).

---

### `src/store/snapshotStore.ts` (EXTEND — store, event-driven)

**Analog:** self — the `plannedRatios` slice (the EXACT D-02 precedent).

**Slice pattern** (state field line 59, init line 87, action line 137, reset line 181, selectors lines 209-213):

```ts
// interface (line 59):  plannedRatios: { cpu: number; ram: number }
//                        setPlannedRatios: (r: { cpu: number; ram: number }) => void
// init (line 87):       plannedRatios: { cpu: 4, ram: 1 },
// action (line 137) — REPLACE never mutate (Zustand Object.is); no persist, no localStorage:
//                        setPlannedRatios: (r) => set({ plannedRatios: { ...r } }),
// clearAll (line 181):  plannedRatios: { cpu: 4, ram: 1 },
// selectors (209-213) — stable refs, never construct here:
//                        selectPlannedRatios = (s) => s.plannedRatios
//                        selectSetPlannedRatios = (s) => s.setPlannedRatios
```

Add `thresholds: { fsUsedPct: 90; dsUsedPct: 85; luUsedPct: /* PLAN picks */ }` + `setThresholds` mirroring this exactly. **`clearAll` (lines 174-182) MUST reset `thresholds` to defaults** (D-02 refresh=defaults-restored). **`releaseRawRows` (lines 157-172)** clears raw arrays — if any new network array is added to `Snapshot`, add `vnetwork: []` etc. there too (RESEARCH section Runtime State Inventory blast radius). NO new `localStorage` key (only `vatlas-theme`/`vatlas-lang` allowed; PAR-05 comment lines 21-24).

---

### `src/hooks/useEstateView.ts` (EXTEND — hook, request-response)

**Analog:** self — the `planned` slice threading (the single sanctioned memo).

**Pattern** (lines 43-60): store read via selector (line 47) -> thread into `buildEstateView` `opts` (line 58) -> add to the memo dep array (line 60):

```ts
const planned = useSnapshotStore(selectPlannedRatios)                    // line 47
return useMemo(() => {
  return buildEstateView(mergeSnapshotsToEstate(selected), selected, mode, today, {
    stretchedClusters, scenario,
    plannedRatios: { cpuRatio: planned.cpu, ramRatio: planned.ram },     // line 58
  })
}, [snapshots, selectedIds, stretchedClusters, scenario, mode, planned.cpu, planned.ram]) // line 60
```

Add `const thresholds = useSnapshotStore(selectThresholds)`, pass `thresholds` in the `opts` object, add `thresholds` (or its scalar fields) to the dep array. This is the ONLY memo — no second `useMemo`.

---

### `src/components/ViewToggle.tsx` (EXTEND — component/nav, event-driven)

**Analog:** self (lines 3-5 — the P5/P6/P7/P8 one-segment-per-commit precedent).

```ts
export type AppView = 'dashboard'|'inventory'|'hosts'|'planning'|'eos'|'trends'   // line 3 — add 'storage'|'network'
const VIEWS = ['dashboard','inventory','hosts','planning','eos','trends'] as const // line 5 — append 'storage','network'
```

Add `'storage'` then `'network'` to BOTH the union (line 3) and the `VIEWS` array (line 5), in order. NO new component — the `<fieldset role="group">` + `<legend sr-only>` + `map(button aria-pressed)` + Arrow-wraparound + the literal `biome-ignore`/`role="group"` (lines 48-55, grep-gated) are reused unchanged. Labels: ViewToggle reads `t('nav.<view>')` from the **`inventory`** namespace (lines 28, 70) -> add `nav.storage`/`nav.network` to `locales/{en,fr}/inventory.json` (NOT a new namespace). Active segment is gold `bg-accent-500 text-surface-900` (line 65) — UI-SPEC section Color reserved-list rule, unchanged.

---

### `src/components/Chart.tsx` (EXTEND — component)

**Analog:** self (lines 1, 29-42 — the tree-shaken registry).

One-line add: import `TreemapChart` from `echarts/charts` (line 1) and add it to the `echarts.use([...])` array (lines 29-42, beside `BarChart`/`HeatmapChart`). NO `<Chart>` API change — the universal `option` prop (lines 49-66) already covers treemap. Stacked-bar reuses the already-registered `BarChart` (stacking is `option` config). **Run `npm run check:bundle-size` after** (<=300 KB gz echarts chunk — RESEARCH section Runtime State Inventory). XSS: pass datastore/portgroup names as plain `name`/`value` data, never a raw-HTML `formatter`.

---

### `src/components/storage/StorageLensToggle.tsx` + `ThresholdConfig.tsx` (NEW — toggles/config)

**Analog (lens toggle):** `src/components/dashboard/AccountingModeToggle.tsx` (entire file, 83 lines).
Copy the structure verbatim — change the union to `'consumption' | 'capacity'`, the `MODES` array, the i18n namespace to `storage`. Keep the literal `biome-ignore lint/a11y/noRedundantRoles` + `role="group"` (lines 53-55 — CI grep gate asserts the literal). Keep `move()`/`onKeyDown` Arrow-wraparound (lines 36-50). Active segment `bg-primary-600 text-white` (line 71) — NOT accent (accent reserved, UI-SPEC section Color).

**Analog (threshold config):** `src/components/planning/PlannedRatiosControl.tsx` (entire file, 160 lines).
Copy the `<section className="panel flex flex-col gap-4">` + `<h2 text-xl font-semibold>` shell (lines 85-88), the `safeNum` on-commit sanitizer (lines 51-54 — out-of-range/non-finite -> last valid, NO error state), the bounds-as-single-source pattern (`CPU_MIN`/`CPU_MAX` lines 44-49 shared by `<input min/max/step>` AND `safeNum`), the native `<input type="number">` class verbatim (lines 103/119: `h-9 w-20 rounded border ... font-mono tabular-nums focus-visible:ring-2 ring-primary-500` + `dark:` twins), the optional preset `<fieldset role="group">` group (lines 123-148), and the `text-[12px] font-normal text-slate-500 dark:text-slate-400` factual echo line (lines 151-153). State source = the new Zustand `thresholds` slice via `useSnapshotStore(selectThresholds)` / `selectSetThresholds` (mirror lines 80-81). Three inputs: filesystem used %, datastore used %, LU used %. i18n namespace `alerts`.

---

### `src/components/storage/DatastoreDetail.tsx` / `VmDetail.tsx` + ESX detail (NEW — detail-drill)

**Analog:** `src/components/cluster/ClusterDetail.tsx` (entire file, 94 lines — the P5 precedent).

**Props + screen-fit shell pattern** (verbatim): `export interface DatastoreDetailProps { detail: DatastoreDetail; onBack: () => void }`; `<main className="flex-1 overflow-hidden p-8">` (line 37 — NO internal scroll, 16:9, 1 PPTX slide); `<div className="flex h-full flex-col gap-4">` (line 38); header `<h2 className="break-words text-2xl font-semibold ...">{title}</h2>` + `<button onClick={onBack}>(left-arrow) {t('detail.back')}</button>` (lines 39-50, verbatim classes); `<div className="grid flex-1 grid-cols-1 gap-x-10 gap-y-0 md:grid-cols-2 lg:grid-cols-3">` (line 52).

**`Row` sub-component** (lines 27-34, copy verbatim):

```tsx
const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 dark:border-surface-800">
    <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
    <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</span>
  </div>
)
```

**Em-dash sentinel** (lines 24, 71): `const na = t('na')`; render `na` for any value not derivable (e.g. unrelinkable blank-cluster datastore cluster identity) — NEVER fabricated. Numbers via `fmt*` helpers from `@/utils/format` (lines 3, 54-83), locale from `i18n.language`. i18n namespace `storage` (datastore/vm) — RESEARCH Pattern 1. **ESX detail** AUGMENTS `src/components/hosts/HostsView.tsx` (does NOT duplicate `ClusterDetail`) — same `{ detail, onBack }` props shape, drill state lifted into `HostsView` (the `GlobalDashboard` precedent below).

---

### `src/components/storage/StorageView.tsx` / `network/NetworkView.tsx` (NEW — view-shell)

**Analog:** `src/components/dashboard/GlobalDashboard.tsx` (lines 55-129) + `src/components/hosts/HostsView.tsx` (single-memo consumer).

**Single-`useEstateView`-consumer + lifted-drill pattern** (GlobalDashboard lines 58-98):

```tsx
const [mode, setMode] = useState<AccountingMode>('active')        // lifted UI state, NOT a memo
const view = useEstateView(mode)                                  // the ONE memo consumer
const [selectedCluster, setSelectedCluster] = useState<string | null>(null)  // drill state HERE, not App.tsx
const detail = selectedCluster ? view.clusterDetail.get(selectedCluster) : undefined
if (detail) return <ClusterDetail detail={detail} onBack={() => setSelectedCluster(null)} /> // drill replaces body
```

`StorageView` owns `useState` for the storage-by-X scope (Cluster/ESX/VM/Datastore), the lens (`'consumption'|'capacity'`), and the drilled datastore/VM id — exactly how `GlobalDashboard` owns `mode` + `selectedCluster`. Children get `view.storage`/`view.flags` as plain props (no child `useMemo`). `NetworkView` mirrors `HostsView` + the table reuse below. Inline `<ErrorBoundary FallbackComponent={DashboardError}>` per-region (lines 26-37, 92-98) — copy `DashboardError` (message-only, never `error.cause`/`stack`). Optional-sheet degrade: render the factual `network:empty.unavailable` line in caption style `text-xs text-slate-500 dark:text-slate-400` (UI-SPEC LC-3) — no icon, no crash.

---

### Storage/Network tables + column defs (NEW — config)

**Analog:** `src/components/inventory/DatastoreTable.tsx` (42 lines) + `columns/datastoreColumns.ts` (99 lines).

**Wrapper pattern** (DatastoreTable lines 30-41): thin — pass `EstateView.*` straight through, compose `<DataTable data={...} columns={...} headerFor={(id) => t('col.'+id)} objectKind="..." defaultColumnVisibility={...} />`. **Column-def pattern** (datastoreColumns lines 23-82): `{ accessorKey, id, header: 'inventory.col.<id>' (doc only), cell: (ctx) => fmt*(ctx.getValue<number>()) }` + a `defaultVisible` const (lines 91-99).
**Pitfall 3 (CLAUDE.md gotcha — VERIFIED in DataTable.tsx lines 61-64, 82):** `DataTable` resolves the visible `<thead>` header via `useTranslation('inventory') -> t('col.<id>')` — the `header` string in the column def is **documentation only**, and `headerFor` is **CSV-only**. Every new column `id` REQUIRES an `inventory:col.<id>` key in BOTH `locales/en/inventory.json` AND `locales/fr/inventory.json` or the header renders the raw key. `<thead>`/`<tbody>` already share the `flex w-full` + per-cell `flex-1` layout (DataTable lines 172-239) — reused, no action.

---

### `src/App.tsx` (EXTEND — view router) + i18n (EXTEND)

**Analog (App):** self (lines 40-52 — the `activeView ===` chain). Add `: activeView === 'storage' ? <StorageView /> : activeView === 'network' ? <NetworkView />` branches before the `<GlobalDashboard />` fallback. Drill state stays inside the view shell (NOT App.tsx) per the GlobalDashboard precedent.

**Analog (i18n):** self (`src/i18n/index.ts` lines 5-82). Adding a namespace = (1) import `en{Storage,Network,Alerts}`/`fr*` JSON (lines 5-26 pattern), (2) add `'storage','network','alerts'` to the `NAMESPACES` const array (lines 40-52), (3) add them to BOTH `resources.en` and `resources.fr` (lines 55-82). `nav.storage`/`nav.network` go into the EXISTING `inventory.json` (NOT a new namespace — ViewToggle reads `nav.*` from `inventory`). EN/FR parity mandatory, no pre-formatted numbers in strings, no editorial verbs (CLAUDE.md conventions; UI-SPEC section Copywriting Contract is the EN string source of truth).

---

## Shared Patterns

### Pure-engine purity + >=75% coverage

**Source:** every `src/engines/aggregation/*.ts`; `estateView.ts` header comment lines 25-47.
**Apply to:** `vsanRelink.ts`, `storageByX.ts`, `thresholdFlags.ts`, `network.ts`.
No React/DOM/Zustand/Zod in engines (Zod only at the parser boundary `schemas.ts`). Vitest-gated >=75% (`npm run test:coverage`). Functions are pure of clock/randomness — any reference time is injected via the `useEstateView` boundary (`estateView.ts` lines 67-71, 272-277).

### Single `useMemo` invariant (grep-gated)

**Source:** `src/hooks/useEstateView.ts` (the ONLY memo); `estateView.ts` lines 188-198 comment.
**Apply to:** all new engines + all new components.
Every P9 projection composes inside `buildEstateView`'s single pass and is returned on `EstateView`. A 2nd `useMemo` anywhere in non-test `src/` fails CI. Components consume `useEstateView` output as plain props; new view shells call `useEstateView` exactly once (the `GlobalDashboard`/`HostsView` precedent).

### Inputs-only store, REPLACE-never-mutate, no persistence

**Source:** `src/store/snapshotStore.ts` lines 21-29 (PAR-05 comment), 135-137 (`setPlannedRatios`).
**Apply to:** the new `thresholds` slice.
`set({ thresholds: { ...t } })` — fresh object so Zustand `Object.is` fires; no `localStorage`/`sessionStorage`/IndexedDB/persist middleware; `clearAll` resets to defaults (refresh = defaults restored, D-02). Selectors return stable refs, never construct.

### Segmented-control idiom (fieldset + aria-pressed + literal role="group")

**Source:** `AccountingModeToggle.tsx` lines 52-82; `ViewToggle.tsx` lines 47-75; `PlannedRatiosControl.tsx` lines 123-148.
**Apply to:** ViewToggle extension, StorageLensToggle, ThresholdConfig preset group.
`<fieldset>` with the literal `biome-ignore lint/a11y/noRedundantRoles` comment + `role="group"` (CI grep gate asserts the literal — do not remove), `<legend className="sr-only">`, `map(button aria-pressed)`, Arrow Left/Right/Up/Down wraparound, `focus-visible:ring-2 ring-primary-500`. Active treatment: `bg-primary-600 text-white` for lens/preset toggles; `bg-accent-500 text-surface-900` ONLY for the top-level ViewToggle segment (accent reserved-list, UI-SPEC section Color).

### Detail-drill = lifted in-app view-state (P5, no router, no 2nd memo)

**Source:** `GlobalDashboard.tsx` lines 64, 91-98; `ClusterDetail.tsx` (the screen).
**Apply to:** Datastore detail, VM detail, ESX detail.
Drill selection is a `useState<string | null>` in the OWNING view shell (StorageView / HostsView), NOT App.tsx, NOT a router. `if (detail) return <Detail detail={...} onBack={() => setSel(null)} />` replaces the shell body. Screen is one-screen-fit / export-ready (`overflow-hidden p-8`, fixed grid) so Phase 10 snapshots it as exactly one PPTX slide.

### Factual-only, em-dash sentinel, no editorial verb (D-04)

**Source:** `ClusterDetail.tsx` lines 24, 71 (`na = t('na')`); `PlannedRatiosControl.tsx` lines 151-157 (echo line); CLAUDE.md grep-gate gotcha.
**Apply to:** thresholdFlags, ThresholdConfig, all three detail drills, Storage/Network views.
Counts + neutral marker only (UI-SPEC LC-6: `bg-accent-500/15` row tint + `border-l-2 border-accent-500` + count-badge pill; NO red/amber/green, NO icon, NO verdict text). Not-derivable -> em-dash. Numbers injected via `fmt*` (no pre-formatted numbers in i18n strings), EN/FR parity. Doc-comments must NOT spell forbidden tokens literally (`recommend`/`should`/`poor`/`good`/`critical`/`warning`) — the security-hook/grep-gate gotcha.

### Parser regression gate (D-11 / P5 D-07 lesson)

**Source:** `src/engines/parser/canary.test.ts` (MiB canary, must stay green unchanged); `adaptRvtools` OPTIONAL-sheet block.
**Apply to:** the parser extension.
MiB canary fixture + `canary.test.ts` MUST remain green and UNCHANGED (the MiB-regression guard). New fixtures/tests are additive. The `VInfoRow.path` addition ripples to `VInfoRowSchema` + every `VInfoRow` object literal in `*.test.ts` (default `''`) — the exact P5 `Powerstate`/`Template` precedent. Real-file validation gate: an env-guarded `it` reading `~/Library/CloudStorage/OneDrive-Home/20260430_1400_allvCenters.xlsx` asserting relink count > 0 (~25 distinct / 116 rows) — the `canary.test.ts` `readFileSync` pattern pointed at the real file (RESEARCH section Validation Architecture; the STR-04 regression guard the binding memory demands; skips gracefully in CI if absent).

---

## No Analog Found

None. Every P9 file maps to a shipped precedent (09-RESEARCH "P9 introduces zero new libraries and zero new architectural mechanisms"). The only library-registry touch is the one-line `TreemapChart` addition to the already-installed `echarts@^6.0.0` in the single sanctioned `Chart.tsx` site.

---

## Metadata

**Analog search scope:** `src/engines/parser/{adapters,}/`, `src/engines/aggregation/`, `src/engines/snapshotMerge/`, `src/store/`, `src/hooks/`, `src/components/{ViewToggle,Chart}.tsx`, `src/components/{dashboard,cluster,hosts,inventory,planning}/`, `src/types/`, `src/i18n/`, `src/App.tsx`
**Files read for extraction:** 19 shipped source files (read in full or targeted; no re-reads)
**Pattern extraction date:** 2026-05-17
