# Phase 4: Multi-vCenter, Stretched, Allocation & DR Simulation - Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 27 (new + modified)
**Analogs found:** 24 / 27 (3 NEW-with-strong-skeleton, 0 truly unprecedented)

> THE headline capability is **MULTIPLE separate RVTools .xlsx files merged into ONE logical estate** (MVC-01). Phase 1 already ingests N files into the append-only `Map<id,Snapshot>` store (`snapshotStore.ts:25-44`, `useSnapshotUpload.ts` sequential loop). Phase 4's `snapshotMerge` flattens the **selected** snapshots' rows and keys by ROW `(viSdkUuid, vmBiosUuid)`. This handles BOTH the primary path (N separately-dropped files) AND the real-file finding (one workbook embedding N vCenters). The planner MUST treat multi-FILE merge as the primary path and primary test; single-workbook-multi-vCenter as an additional case riding the same row-keyed code.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engines/parser/adapters/rvtools.ts` (MOD: `adaptRvtoolsVMetaData` columnar 4.x + `VMETADATA_COLS` + `VDATASTORE_COLS.hosts` + `VHOST_COLS.faultDomain`) | parser | transform | self (existing adapters in same file) | exact (self-extend) |
| `src/engines/parser/captureDate.ts` (MOD: `inferRvtoolsVersion`/label/date read columnar `vMetaData`) | parser | transform | self (`metaValue` in same file) | exact (self-extend) |
| `src/types/snapshot.ts` (MOD: `VDatastoreRow.hosts`, `VMetaDataRow` per-vCenter rows) | type | — | self | exact (self-extend) |
| `src/types/vhost.ts` (MOD: `VHostRow.faultDomain`) | type | — | self | exact (self-extend) |
| `src/engines/parser/parser.worker.ts` (MOD: surface per-vCenter vMetaData list) | infra | request-response | self | exact (self-extend) |
| `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts` | engine | transform / batch | vsizer `resolveClusterCollisions.ts` + `perDatastore.ts` (dedupe-by-key shape) | NEW (strong port skeleton) |
| `src/engines/snapshotMerge/vCenterIndex.ts` | engine | transform | `perDatastore.ts` `datastoreCountByCluster` (Map-accumulate) | role-match |
| `src/engines/snapshotMerge/index.ts` | infra | — | `engines/aggregation/index.ts` (barrel) | exact |
| `src/engines/snapshotMerge/*.test.ts` | test | — | `aggregateClusters.test.ts` + `perDatastore` tests | role-match |
| `src/engines/aggregation/aggregateClusters.ts` (MOD: per-site reservation + confidence) | engine | transform | self (dormant 50% math, lines 59-76) | exact (self-extend) |
| `src/engines/aggregation/perDatastore.ts` (MOD: Hosts→cluster join in `datastoreCountByCluster`) | engine | transform | self (`datastoreCountByCluster` lines 33-44) | exact (self-extend) |
| `src/engines/aggregation/estateView.ts` (MOD: consume merged rows + stretched/ratios/scenario) | engine | transform | self (`buildEstateView`) | exact (self-extend) |
| `src/engines/aggregation/globals.ts` (MOD: `stretchedConfidence` rollup if surfaced) | engine | transform | self | exact (self-extend) |
| `src/types/estate.ts` (MOD: `ClusterAggregate.stretchedConfidence`/site fields, `EstateView.drSim`/`allocRatios`, `DrSimResult`) | type | — | self | exact (self-extend) |
| `src/engines/drSim/runScenario.ts` | engine | transform / batch | `estateView.ts` `buildEstateView` (re-run aggregation on a subset) | NEW (composition of shipped engines) |
| `src/engines/drSim/allocate.ts` | engine | transform | `aggregateClusters.ts` verdict-style derivation | NEW (pure arithmetic) |
| `src/engines/drSim/index.ts` | infra | — | `engines/aggregation/index.ts` | exact |
| `src/engines/drSim/*.test.ts` | test | — | `aggregateClusters.test.ts` | role-match |
| `src/hooks/useEstateView.ts` (MOD: thread selected[]/stretched/scenario/ratios, ONE memo) | hook | request-response | self (the single `useMemo`, lines 17-20) | exact (self-extend) |
| `src/store/snapshotStore.ts` (MOD: `selectedSnapshotIds` + `stretchedClusters` + `scenario` slices) | store | event-driven | self (existing inputs-only slices + Set-replace idiom) | exact (self-extend) |
| `src/hooks/useAllocationHash.ts` | hook | event-driven | `src/hooks/useTheme.ts` (localStorage-sync hook) inverted to hash | role-match |
| `src/components/stretched/StretchedPill.tsx` | component | request-response | `AccountingModeToggle.tsx` (aria-pressed segmented idiom) | role-match (idiom-exact) |
| `src/components/allocation/AllocationSliders.tsx` | component | request-response | `AccountingModeToggle.tsx` (presets) + native `<input type=range>` | role-match |
| `src/components/dr/DrSimPanel.tsx` | component | request-response | `CpuReadyPanel.tsx` + `GlobalDashboard.tsx` (panel + selector) | role-match |
| `src/components/dashboard/ClusterColumn.tsx` (MOD: pill + site rows + confidence chip in footer) | component | request-response | self (footer region reserved line 122) | exact (self-extend) |
| `src/components/dashboard/GlobalDashboard.tsx` (MOD: allocation toolbar + DrSimPanel + lifted state) | component | request-response | self (lifted `useState` mode line 50, single `useEstateView` caller) | exact (self-extend) |
| `src/components/SnapshotCard.tsx` (MOD: MVC-04 N-vCenters + RVTools version meta line) | component | request-response | self (meta line lines 39-51) | exact (self-extend) |
| `src/i18n/index.ts` + `locales/{en,fr}/{mvc,str,alloc,dr}.json` | i18n | — | self (`NAMESPACES` line 26 + existing `dashboard.json`) | exact (self-extend) |

---

## Pattern Assignments

### `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts` (engine, transform/batch) — NEW, primary capability

**Analogs:** `/Users/fjacquet/Projects/vsizer/src/engines/parser/resolveClusterCollisions.ts` (collision algorithm to port + generalize) AND `/Users/fjacquet/Projects/rvtui/src/engines/aggregation/perDatastore.ts` (dedupe-by-key Map-accumulate shape).

**Collision algorithm to port + generalize** — vsizer `resolveClusterCollisions.ts:41-74`:
```typescript
export const resolveClusterCollisions = (
  perFile: FileScopedRows[],
): { vinfo: VInfoRow[]; vhost: VHostRow[] } => {
  const filesPerCluster = new Map<string, Set<string>>()
  for (const file of perFile) {
    const localClusters = new Set<string>()
    for (const h of file.vhost) localClusters.add(h.cluster)
    for (const cluster of localClusters) {
      const set = filesPerCluster.get(cluster) ?? new Set<string>()
      set.add(file.filename)
      filesPerCluster.set(cluster, set)
    }
  }
  const isColliding = (cluster: string): boolean => (filesPerCluster.get(cluster)?.size ?? 0) > 1
  // ...rewrite BOTH vhost+vinfo rows for colliding clusters; pass-through refs otherwise
  for (const h of file.vhost) {
    outVhost.push(isColliding(h.cluster) ? { ...h, cluster: `${h.cluster}${suffix}` } : h)
  }
}
```

**Required deviation (the core Phase-4 algorithm change — CRITICAL):**
- Key the collision map on **row `viSdkUuid`**, NOT `file.filename`. `Map<clusterName, Set<viSdkUuid>>`; `size > 1` ⇒ colliding. This makes the SAME algorithm work for (a) N separately-dropped files [primary] AND (b) one workbook with N vCenters [real-file finding] — because rows from a 3-vCenter workbook carry 3 distinct `viSdkUuid` and the merge groups by row identity, not Snapshot identity (RESEARCH Pitfall 1, Anti-Pattern "Treating the real allvCenters.xlsx as 3 separate files").
- Suffix = `"${cluster} (${vCenterLabelFor(viSdkUuid)})"` not `(${filename})`. Label resolved via `vCenterIndex` (vMetaData `Server` per `viSdkUuid` from the columnar parser fix, falling back to `viSdkServer` then `snapshot.vCenterLabel`).
- Add VM dedupe (vsizer has none): keep first occurrence by `vmBiosUuid` (= RVTools `VM UUID`, NOT SMBIOS — `rvtools.ts:60` `vmBiosUuid: ['vm uuid','bios uuid','uuid']`). Blank → fallback key `(viSdkUuid, vmName, cluster)`. `vmInstanceUuid` is ABSENT in RVTools 4.7 — do NOT make it a required path (RESEARCH Pitfall 2).
- Input is selected `Snapshot[]` (each `snapshot.vinfo`/`vhost`/`vdatastore` already carries `viSdkUuid` per `VInfoRow` — `vinfo.ts`), output `{ vinfo, vhost, vdatastore, vcenters: VCenterEntry[] }`. Never mutate input — fresh row copies for rewritten, pass-through references otherwise (vsizer rule, preserved).
- Pure: no React/Zustand/Zod (PROJECT.md line 52). The `{ ...h, cluster }` immutable-rewrite + `Map<key,Set>` accumulate are the load-bearing patterns to copy verbatim.

**Dedupe-by-key shape to copy** — `perDatastore.ts:21-44` (`dedupeKey` + `datastoreCountByCluster` Map-accumulate, first-occurrence-wins). The `naa ?? name` first-row-wins idiom is exactly the VM-dedupe shape (`vmBiosUuid ?? fallbackKey`, keep first).

---

### `src/engines/snapshotMerge/vCenterIndex.ts` (engine, transform) — NEW

**Analog:** `perDatastore.ts:33-44` `datastoreCountByCluster` (build `Map<key, accumulator>` from rows, one pass).

```typescript
// perDatastore.ts:33-44 — the Map-accumulate idiom to copy
export const datastoreCountByCluster = (vdatastore: VDatastoreRow[]): Map<string, number> => {
  const keysByCluster = new Map<string, Set<string>>()
  for (const row of vdatastore) {
    if (row.clusterName === '') continue
    const set = keysByCluster.get(row.clusterName) ?? new Set<string>()
    set.add(dedupeKey(row)); keysByCluster.set(row.clusterName, set)
  }
  // ...
}
```

**Required deviation:** Group selected snapshots' `vinfo` rows by **`row.viSdkUuid`** (NOT snapshot id). Produce `Map<viSdkUuid, { viSdkUuid; server; label; clusters: Set<string>; vmCount }>`. `label = vMetaData.Server` for that uuid (columnar fix) `?? row.viSdkServer ?? snapshot.vCenterLabel`. Estate vCenter count = distinct `viSdkUuid`, never file count (RESEARCH Pitfall 1 warning sign).

---

### `src/engines/aggregation/aggregateClusters.ts` (engine, transform) — MOD, activates dormant math

**Analog:** SELF — the ported-intact-but-dormant stretched math, `aggregateClusters.ts:59-76`:
```typescript
const drReservedGhz = isStretched ? 0.5 * physicalGhz : 0
const availableGhz = physicalGhz - consumedGhz - drReservedGhz
const drReservedRamMib = isStretched ? 0.5 * physicalRamMib : 0
const availableRamMib = physicalRamMib - consumedRamMib - drReservedRamMib
const usablePhysicalCores = isStretched ? 0.5 * physicalCores : physicalCores
const cpuDrFactor = isStretched && physicalGhz > 0 ? physicalGhz / (physicalGhz - drReservedGhz) : 1
const ramDrFactor = isStretched && physicalRamMib > 0 ? physicalRamMib / (physicalRamMib - drReservedRamMib) : 1
```
This is the exact shape RESEARCH Code-Example "Per-site reservation" generalizes. 02-02-SUMMARY confirms a direct regression test already exercises this branch — extend that test, do not rewrite.

**Required deviation (RESEARCH Pattern 3 + Pitfall 4):**
- Replace the literal `0.5` with `f = reservedFraction(clusterHosts)` where `f = maxSiteCapacity / totalCapacity`, hosts grouped by **`VHostRow.faultDomain`** (new parsed `vSAN Fault Domain Name` column). Symmetric 4+4 → 0.5; asymmetric 6+4 → 0.6.
- Compute `f` per resource basis (GHz fraction for GHz, RAM-MiB for RAM, cores for cores) — RESEARCH Open-Question 2 default; pin in an ADR.
- Derive `stretchedConfidence: 'high'|'medium'|'low'` from fault-domain presence: ≥2 distinct domains covering all hosts → `high` (use `maxSiteCap/totalCap`); absent/partial → `medium` (assume 0.5); odd/asymmetric host count with NO site data → `low` (cannot prove split — drives STR-04 chip). NEVER collapse absence to `high` (Anti-Pattern).
- `aggregateHostsPerCluster` (`perCluster.ts:40-79`) currently discards per-host fault domain — it returns cluster-level sums only. Either thread fault-domain grouping into `perCluster.ts` OR pass raw `vhost` rows alongside into the reservation helper. Keep the `groupByCluster` Map-accumulate shape (`perCluster.ts:21-30`).
- Branded units: `x as number` → arithmetic → re-wrap via `ghzOf`/`mib`/`coresOf` (the established retrofit, used throughout this file).

**Type extension** (`estate.ts:158-161` — the dormant block):
```typescript
  // ── Stretched-cluster DR (dormant in Phase 2) ──
  stretched: boolean
  drReservedGhz: GHz
```
Add `stretchedConfidence: 'high'|'medium'|'low'`, per-site capacity figures (`siteACapacityGhz`, `siteBCapacityGhz`, RAM analogues), `reservedFraction: number`. Em-dash sentinel when a site cannot be determined (UI-SPEC §STR-02).

---

### `src/engines/aggregation/perDatastore.ts` (engine, transform) — MOD, Hosts→cluster join (Pitfall 6, A3 — flag for user)

**Analog:** SELF — `datastoreCountByCluster` (lines 33-44, shown above).

**Required deviation:** When `row.clusterName === ''`, instead of `continue`, attribute the datastore to the cluster(s) of its `Hosts` via a `vHost.hostName → vHost.cluster` map (pure join). Requires the new `VDatastoreRow.hosts` parsed column. Keep NAA dedupe within each attributed cluster (`dedupeKey`, Moderate-11 — a shared LUN counts once per cluster). `datastoreCountByCluster` signature gains a `hostClusterMap` param; `estateView.ts:38-39` passes it. RESEARCH A3: flag in the stretched plan for explicit user confirmation (descope risk: vSAN/DR storage under-counted).

---

### `src/engines/drSim/runScenario.ts` (engine, transform/batch) — NEW

**Analog:** `estateView.ts:33-92` `buildEstateView` — DR = aggregation re-run on a host subset.

```typescript
// estateView.ts:40-52 — the compose pattern to copy
const clusters = aggregateClusters({ vinfo: snapshot.vinfo, vhost: snapshot.vhost, mode, stretchedClusters, datastoreCountByCluster: dsByCluster })
const globals = aggregateGlobals(clusters, datastoreCount, totalStorageMib)
```

**Required deviation:** Signature `runScenario(merged, scenario, stretchedFlags, allocRatios) → DrSimResult`. Steps: (1) remove failed host/cluster/vCenter rows from `merged.vhost`/`vinfo` (filter, never mutate); (2) re-run `aggregateClusters` + `aggregateGlobals` on survivors (reuse shipped engines — Don't Hand-Roll); (3) compute evacuee totals (Σ failed-side vCPU/vRAM), before/after `GlobalSummary`, per-survivor verdict via `allocate.ts`; (4) emit `confidence` + `caveats: string[]` (i18n keys, never free text — RESEARCH A5, no editorial verbs PROJECT.md line 39). Pure; no second `useMemo` (runs inside `useEstateView`). vCenter-loss mode removes all rows of a `viSdkUuid` — depends on the merged estate (DRS-03).

**Type:** add `DrSimResult` + `EstateView.drSim: DrSimResult | null` to `estate.ts` (forward-compat shape mirrors the existing `trends: TimelinePoint[] | null` idiom, `estate.ts:318-319`).

---

### `src/engines/drSim/allocate.ts` (engine, transform) — NEW

**Analog:** `aggregateClusters.ts` derivation style (pure scalar arithmetic, branded unwrap/rewrap).

**Pattern (RESEARCH Code-Example "Allocation headroom verdict"):**
```typescript
// capacityVcpu = usablePhysicalCores * cpuRatio  (default 4)
// capacityRamMib = physicalRamMib * ramRatio     (default 1)
// verdict = allocated <= 0.8*capacity ? 'absorbs' : allocated <= capacity ? 'tight' : 'overflows'
```
**Required deviation:** Factual enum `'absorbs'|'tight'|'overflows'` (no color, no "good/poor" — UI-SPEC §Color, PROJECT.md). Branded: `(x as number)` compute, rewrap `cores()`/`mib()`. Default ratios CPU 4:1 / RAM 1:1 (ALC-02). The slider changes the headroom verdict ONLY, not `vcpuPerPcpu` (already physical-core-based, `aggregateClusters.ts:68`).

---

### `src/hooks/useEstateView.ts` (hook, request-response) — MOD, the single-useMemo contract change [SPECIAL ATTENTION]

**Analog:** SELF — the entire file IS the pattern (`useEstateView.ts:17-20`):
```typescript
export function useEstateView(mode: AccountingMode): EstateView {
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  return useMemo(() => (snapshot ? buildEstateView(snapshot, mode) : EMPTY_VIEW), [snapshot, mode])
}
```

**Required deviation (NO second `useMemo` — locked, grep-gated; 02-02-SUMMARY issue note):**
- New signature `useEstateView(mode, ratios)` (or read ratios from a store mirror). Select `selectedSnapshots` (the active selection of the `Map<id,Snapshot>` — store slice below) instead of the single `selectActiveSnapshot`. Default selection = all snapshots (multi-FILE merge is the primary path; a single snapshot is the degenerate case that still works).
- Inside the SAME `useMemo`: call `mergeSnapshotsToEstate(selected)` → `buildEstateView(merged, mode, { stretchedClusters, scenario, allocRatios })` → `runScenario(...)`. The memo dependency array becomes `[selected-snapshot-identities, stretched, scenario, ratios, mode]`. Selected identities must be a referentially-stable Set (store replaces, never mutates — `snapshotStore.ts:40-44` `new Map(...)` idiom).
- `buildEstateView` signature change is the partner edit: it currently takes one `Snapshot` (`estateView.ts:33`); it must take the merged row bundle. `EMPTY_VIEW` (`estateView.ts:99-109`) frozen-constant idiom stays for the no-snapshot path.
- Allocation hash sync is event-driven (`useAllocationHash`), explicitly NOT a render memo — does not count against the invariant (RESEARCH Pattern 5).

---

### `src/store/snapshotStore.ts` (store, event-driven) — MOD, inputs-only slices

**Analog:** SELF — the existing inputs-only Set-replace idiom (`snapshotStore.ts:39-44`):
```typescript
addSnapshot: (s) => set((state) => {
  const next = new Map(state.snapshots); next.set(s.id, s)
  return { snapshots: next, activeSnapshotId: state.activeSnapshotId ?? s.id }
}),
```

**Required deviation:** Add inputs-only slices: `selectedSnapshotIds: Set<string>` (estate selection — default all; the merge consumes this), `stretchedClusters: Set<string>` (cluster keys), `scenario: { failedHosts: Set<string>; failedClusters: Set<string>; failedVCenters: Set<string> }`. Every mutation REPLACES the Set/Map (never mutates in place — Zustand `Object.is`, documented `snapshotStore.ts:20-22`). NO persist middleware, NO localStorage (PROJECT.md line 53 / ALC-03). Add matching pure selectors next to `selectActiveSnapshot` (`snapshotStore.ts:89-90`). Allocation ratios do NOT live here (URL hash only).

---

### `src/hooks/useAllocationHash.ts` (hook, event-driven) — NEW

**Analog:** `src/hooks/useTheme.ts` (a localStorage-sync hook — invert to `window.location.hash`). [Read `useTheme.ts` during planning; it is the project's only state-sync hook precedent and the `vatlas-theme` localStorage idiom referenced in CLAUDE.md.]

**Pattern (RESEARCH Pattern 5 + Security V5):** parse `#alloc=cpu:8,ram:1.25` with a **bounded regex** (no `eval`/`JSON.parse` of attacker hash — STRIDE Tampering/DoS), clamp to slider bounds, fall back to `{cpu:4,ram:1}` on any parse failure. On change: `history.replaceState(null,'',`#alloc=cpu:${c},ram:${r}`)`. Returns `[ratios, setRatios]`; threaded into `useEstateView` like `mode` (RESEARCH Open-Question 3 recommendation). Event-driven, NOT a `useMemo`.

---

### `src/components/stretched/StretchedPill.tsx` (component, request-response) — NEW

**Analog:** `AccountingModeToggle.tsx:52-82` — the EXACT segmented `<fieldset role="group"> + <legend className="sr-only"> + map(button aria-pressed)` idiom (DRY-locked, CLAUDE.md mandate, Don't-Hand-Roll).

```tsx
// AccountingModeToggle.tsx:65-78 — copy this button skeleton verbatim
<button type="button" onClick={() => onChange(mode)}
  className={`flex h-10 items-center rounded px-3 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
    active ? 'bg-primary-600 text-white'
           : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
  aria-pressed={active}>{optLabel}</button>
```
Also reuse `ThemeToggle.tsx:6-68` inline-SVG `stroke="currentColor"` glyph pattern for the low-confidence info chip.

**Required deviation:** 2-state (pressed = cluster in `stretchedClusters` Set). Controlled (`value`/`onChange` lifted, like `AccountingModeToggle`). Navy-fill active treatment (`bg-primary-600 text-white`), focus ring `ring-2 ring-primary-500`. i18n label `str.pill.label` "Étendu / Stretched", sr-only group label `str.pill.group`. Confidence tag = Caption-size neutral text (NO traffic light — UI-SPEC §Color). Low-confidence chip = neutral grey `bg-surface-100 text-slate-600 dark:bg-surface-700 dark:text-slate-300` + inline info SVG, shown only when `stretchedConfidence === 'low'`. Per-site rows reuse `ClusterColumn.tsx:17-24` `Row` (label left 16/600, value right mono `tabular-nums`).

---

### `src/components/allocation/AllocationSliders.tsx` (component, request-response) — NEW

**Analog:** `AccountingModeToggle.tsx` (preset segmented group) + native `<input type="range">`.

**Required deviation:** Two native `<input type="range">` (CPU 1–16, RAM 0.5–4) — keyboard by construction; `aria-label`+`aria-valuetext` via `fmtRatio` (`format.ts:92-99` `"X.X : 1"`). Thumb/fill `primary-600`. Preset buttons **1:1 / 4:1 / 8:1 / VDI 10:1** = one mutually-exclusive group reusing the `AccountingModeToggle` aria-pressed idiom (active navy-fill; moving a slider off a preset clears active — factual, no error). Default echo Caption line via `fmtRatio`. State from `useAllocationHash` (URL-hash only). Single instance, Dashboard-toolbar region (UI-SPEC §Layout). i18n `alloc.*`.

---

### `src/components/dr/DrSimPanel.tsx` (component, request-response) — NEW

**Analogs:** `CpuReadyPanel.tsx` (a `.panel` consuming `globals`/`clusters` props) + `AccountingModeToggle.tsx` (3-option mode selector) + `GlobalDashboard.tsx:19-30` `DashboardError` (region `error.message`-only fallback) + `ColumnPicker.tsx` (Phase-3 checkbox multi-select for fail-selection).

**Required deviation:** Full-width `.panel` appended to Dashboard after `CpuReadyPanel` with `2xl` (48px) break (UI-SPEC §Layout). 3-option DR-mode segmented control = `AccountingModeToggle` idiom verbatim (Host/Cluster/vCenter loss, navy-fill, Arrow-key `onKeyDown` copied from `AccountingModeToggle.tsx:42-50`). Fail-selection = checkbox multi-select reusing the Phase-3 `ColumnPicker.tsx` pattern; selected = `line-through` + `text-slate-400 dark:text-slate-500` + neutral grey "simulated failed" chip (NO red, NO confirm dialog — reversible input, UI-SPEC §Interaction). Before/After = two side-by-side stat blocks reusing `ClusterColumn` `Row`; evacuee total = the single gold `--color-accent-500` figure (closed-list accent use). Verdict words `absorbs/tight/overflows` neutral Body text. Assumptions panel = static factual i18n (`dr.assumptions.*`, no editorial verbs). Caveats = `<ul>` from engine `caveats[]` i18n keys; empty array → omit list (no filler). Pure presenter, plain props from `useEstateView().drSim`; no `useMemo`.

---

### `src/components/dashboard/ClusterColumn.tsx` (component) — MOD

**Analog:** SELF — the reserved footer band, `ClusterColumn.tsx:122`:
```tsx
{/* Phase-6 per-cluster sparkline lands here (trends is null Phase 2). */}
```
**Required deviation:** Above that reserved band, render `<StretchedPill>` + per-site `Row`s + confidence tag + (conditional) low-confidence chip. Column stays `min-w-[200px]` (UI-SPEC §Spacing — pill+chip must fit, no widening). Suffixed colliding cluster name renders verbatim in the existing `<h3>{cluster.cluster}</h3>` (`ClusterColumn.tsx:49-51`) — text child, XSS-safe (MVC-02 is a data transform, no new component).

---

### `src/components/dashboard/GlobalDashboard.tsx` (component) — MOD [attach point]

**Analog:** SELF — lifted `useState` + single `useEstateView` caller (`GlobalDashboard.tsx:48-87`):
```tsx
const [mode, setMode] = useState<AccountingMode>('active')
const view = useEstateView(mode)
// ...<AccountingModeToggle value={mode} onChange={setMode} />
//    <PerClusterColumns ... /> <CpuReadyPanel ... />
```
**Required deviation:** Add lifted `useState` for ratios source / DR scenario UI selection (component-state, NOT memo — same pattern as `mode`, A3-sanctioned). Insert `<AllocationSliders>` toolbar directly below the existing toolbar row (`GlobalDashboard.tsx:72-78`). Append `<DrSimPanel>` after `<CpuReadyPanel>` (`:82`) with the `2xl` break. Stays the SINGLE `useEstateView` caller; children get derived props. Reuse the `DashboardError` ErrorBoundary (`:19-30`, `error.message` only — Critical-2).

---

### `src/components/SnapshotCard.tsx` (component) — MOD (MVC-04)

**Analog:** SELF — the meta line, `SnapshotCard.tsx:39-51`:
```tsx
<p className="mt-1 text-slate-500 dark:text-slate-400">
  <span>{t('snapshots.card.rvtoolsVersion')}: {snapshot.rvtoolsVersion}</span>
</p>
```
**Required deviation:** Below the existing capture-date line, add a Caption meta line: `{{count}} vCenters` + the per-`viSdkUuid` `Server` labels stacked + parsed `RVTools version` (now correct via the columnar `vMetaData` fix). A 3-vCenter workbook = ONE card listing "3 vCenters" — the card must convey N-vCenters-from-one-snapshot, never imply 1 file = 1 vCenter (UI-SPEC §Layout MVC-04). i18n `mvc.snapshot.*`. Needs `Snapshot` to carry per-vCenter vMetaData (parser + type change below).

---

### Parser fixes — `rvtools.ts` / `captureDate.ts` / types (parser, transform) — MOD [SPECIAL ATTENTION: columnar vMetaData]

**Analog:** SELF — `adaptRvtoolsVMetaData` (`rvtools.ts:235-247`) + `VMETADATA_COLS` (`:118-121`) + `metaValue`/`inferRvtoolsVersion` (`captureDate.ts:17-91`).

Current (Property/Value only — BROKEN for RVTools 4.x columnar, RESEARCH Pitfall 3):
```typescript
const VMETADATA_COLS = { property: ['property','name','key'], value: ['value','val'] } as const
export const adaptRvtoolsVMetaData = (sheet: ParsedSheet): VMetaDataRow => {
  for (const row of sheet.rows) {
    const prop = readString(readCol(row, cols.property)).toLowerCase()
    if (prop.includes('rvtools') && prop.includes('version')) rvtoolsVersion = value
  }
}
```
```typescript
// captureDate.ts:80-90 — falls back to marker sniffing → reports "3.11+" for a 4.7 file
export const inferRvtoolsVersion = (sheets) => {
  const version = metaValue(sheets, p => p.includes('rvtools') && p.includes('version'))
  if (version != null) return version
  if (headers.includes('creation date')) return '3.11+'   // wrong for 4.7
}
```

**Required deviation:**
- Detect columnar 4.x shape: presence of an **`RVTools version` column** (headers `["RVTools major version","RVTools version","xlsx creation datetime","Server"]`, one row per vCenter). Read `RVTools version` (e.g. `4.7.1.4`) + `xlsx creation datetime` + `Server` PER ROW. Keep the legacy Property/Value path for older exports (alias-dictionary `mapColumns` pattern, `rvtools.ts:147-148` style).
- `VMetaDataRow` (`snapshot.ts:60-64`) becomes a list of `{ viSdkServer/Server, rvtoolsVersion, exportedTimestamp }` (one per vCenter) — feeds `vCenterIndex` labels + per-vCenter `capturedAt`. Mirror the change in `captureDate.ts` `metaValue`/`inferRvtoolsVersion`/`inferVCenterLabel` and `parser.worker.ts:23-25` so the worker surfaces the per-vCenter list.
- Add `VDATASTORE_COLS.hosts: ['hosts']` + `['# hosts']` and `VDatastoreRow.hosts: string` (host-name list) for Pitfall-6 attribution. Add `VHOST_COLS.faultDomain: ['vsan fault domain name','fault domain name']` + `VHostRow.faultDomain: string` for STR-02/03 (exact-normalized alias, longest spelling first — the `rvtools.ts:104-106` convention). `vmBiosUuid` alias list is ALREADY correct (`rvtools.ts:60`) — do NOT change it.

---

### i18n — `src/i18n/index.ts` + 8 locale files (i18n) — MOD

**Analog:** SELF — `i18n/index.ts:26` `NAMESPACES` array + the existing `locales/{en,fr}/dashboard.json` structure.
```typescript
export const NAMESPACES = ['common', 'upload', 'dashboard', 'inventory'] as const
```
**Required deviation:** Add `'mvc','str','alloc','dr'` to `NAMESPACES`, import + register in `resources` (both `en` and `fr` — `:29-42`). Create `locales/en/{mvc,str,alloc,dr}.json` + `locales/fr/...`. Keys per UI-SPEC §i18n list (`str.pill.label`, `alloc.preset.*`, `dr.verdict.absorbs|tight|overflows`, `dr.caveats.<key>` …). `{{placeholder}}` interpolation only, NO pre-formatted numbers, NO editorial verbs (CI FR↔EN key-diff gate + denylist apply). FR confidence values `élevée/moyenne/faible`; verdicts `absorbe/juste/dépassé`.

---

## Shared Patterns

### Segmented aria-pressed control (DRY-locked, applies to: StretchedPill, AllocationSliders presets, DrSimPanel mode selector)
**Source:** `/Users/fjacquet/Projects/rvtui/src/components/dashboard/AccountingModeToggle.tsx:52-82` (+ `ThemeToggle.tsx:80-107` for the uncontrolled variant).
- `<fieldset role="group" aria-label> + <legend className="sr-only"> + MODES.map(button aria-pressed)`. Active = `bg-primary-600 text-white`; inactive = `text-slate-500 hover:text-slate-700 dark:...`. Focus ring `focus-visible:ring-2 focus-visible:ring-primary-500`. Arrow-key `onKeyDown` (`AccountingModeToggle.tsx:42-50`) for the mode/preset groups. The `biome-ignore lint/a11y/noRedundantRoles` + literal `role="group"` is asserted by a CI grep gate — keep it.
**Never** build a bespoke toggle (CLAUDE.md, RESEARCH Don't-Hand-Roll).

### Branded-unit arithmetic retrofit (applies to: aggregateClusters mod, drSim, allocate)
**Source:** `aggregateClusters.ts:53-76`, `perCluster.ts:46-54` (`x as number` → compute → `ghzOf()`/`mib()`/`coresOf()`).
Never do raw arithmetic on a brand without unwrap/rewrap (CLAUDE.md). `@/engines/units` already ships `mib/ghz/cores/sockets/mhz` + converters — Don't-Hand-Roll new wrappers.

### Inputs-only store, Set/Map replaced never mutated (applies to: stretched/scenario/selection slices)
**Source:** `snapshotStore.ts:20-22` (doc) + `:39-58` (`new Map(state.snapshots)` replace). No persist middleware, no localStorage of dataset/scenario/slider state (only `vatlas-theme`/`vatlas-lang` permitted — `i18n/index.ts:59`). Allocation ratios → URL hash only.

### Pure-engine + frozen-empty-constant + barrel (applies to: snapshotMerge, drSim)
**Source:** `estateView.ts:99-109` `EMPTY_VIEW = Object.freeze({...})` + `globals.ts` `emptySummary` + `engines/aggregation/index.ts` barrel. No React/Zustand/Zod in `engines/` (PROJECT.md line 52). New engines export through their own `index.ts` barrel mirroring `aggregation/index.ts`.

### Region error fallback — `error.message` only (applies to: DrSimPanel, any new region)
**Source:** `GlobalDashboard.tsx:19-30` `DashboardError` + `FallbackError.tsx`. Read ONLY `error.message`/`error.name` — never the error object/`cause`/`stack` (leaks VM/host names — Critical-2). Region states replace only the affected Phase-4 region; sidebar/header/Phase-2 dashboard stay interactive.

### Locale formatting (applies to: all new numeric UI)
**Source:** `src/utils/format.ts` — `fmtInt/fmtGhzValue/fmtPercent/fmtRatio/fmtMemMb`, em-dash `—` sentinel for absent/indeterminate (never `0`/`N/A`). Unwrap brand at call site (`fmtGhzValue(x.physicalGhz as number, loc)`, `ClusterColumn.tsx:75`). i18n strings carry placeholders only — numbers formatted in the component (UI-SPEC §Number Formatting).

---

## No Analog Found

No file is truly unprecedented. The three NEW engine modules each have a strong skeleton analog:

| File | Role | Data Flow | Skeleton Source (planner uses this, not RESEARCH-only) |
|------|------|-----------|--------------------------------------------------------|
| `snapshotMerge/mergeSnapshotsToEstate.ts` | engine | transform | vsizer `resolveClusterCollisions.ts:41-74` (port + generalize key filename→viSdkUuid) + `perDatastore.ts:21-44` (dedupe-by-key) |
| `drSim/runScenario.ts` | engine | transform | `estateView.ts:33-92` (compose `aggregateClusters`+`aggregateGlobals` on a row subset) |
| `drSim/allocate.ts` | engine | transform | `aggregateClusters.ts:59-76` derivation style + RESEARCH headroom-verdict example |

`useAllocationHash.ts` inverts the project's only state-sync hook (`src/hooks/useTheme.ts`, localStorage) to `window.location.hash` — planner should read `useTheme.ts` for the sync skeleton (not loaded here; it is small and the localStorage idiom is the inversion target).

---

## Metadata

**Analog search scope:** `/Users/fjacquet/Projects/rvtui/src/{engines,hooks,store,components,types,i18n,utils}`, `/Users/fjacquet/Projects/vsizer/src/engines/parser`, `.planning/{PROJECT.md,phases/02,phases/04}`
**Files scanned:** ~35 (full read of 24 shipped files + 2 RESEARCH/UI-SPEC + vsizer collision source)
**Pattern extraction date:** 2026-05-16
