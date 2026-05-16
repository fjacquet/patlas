# Phase 4: Multi-vCenter, Stretched, Allocation & DR Simulation — Research

**Researched:** 2026-05-16
**Domain:** Multi-workbook estate merge + identity keying, stretched-cluster per-site reservation math, allocation-ratio sliders (URL-hash), DR simulation (3 modes) — the analytics core, the single most correctness-sensitive phase of vatlas.
**Confidence:** HIGH (engine architecture + reuse paths are sibling-derived and shipped P1–P3; the merge logic is new but the real multi-vCenter workbook was inspected directly, not assumed)

## Summary

Phase 4 turns vatlas from a single-snapshot viewer into the analytics atlas. Four capabilities ship together over the existing pure-engine spine: (1) **multi-vCenter merge** — N RVTools workbooks (and, per a real-data discovery, *also* N vCenters inside one RVTools 4.x workbook) collapse into one logical estate keyed on `(viSdkUuid, clusterName)` for clusters and `vmBiosUuid` (the vCenter-assigned `VM UUID`, never SMBIOS) for VMs; (2) the **Étendu/Stretched pill** with per-site reservation math (not flat 50 %) and a `confidence` indicator derived from the *actual* `vHost.vSAN Fault Domain Name` column found in the real file; (3) **CPU/RAM allocation sliders** with named presets, URL-hash-only persistence; (4) **DR simulation** in 3 modes with an explicit assumptions panel and a `caveats[]` array. Every later phase reads the merged estate.

The architecture is locked by PROJECT.md and the shipped P1–P3 codebase: engines are pure functions (no React/Zustand/Zod; Zod parser-boundary only), `useEstateView` is the project's ONLY `useMemo`, the store holds inputs only, no `localStorage` of dataset rows. The dependency bar is decided and non-negotiable: **no external math/stats library** — Phase-4 math is elementary integer/ratio arithmetic, hand-rolled in `src/engines/`, Vitest-gated ≥75 %, consistent with Phases 1–3.

The single biggest correctness risk in v1 lives here: wrong DR numbers feed budget conversations. The mitigation is structural — the DR engine returns `confidence` + `caveats[]` on every result, the UI surfaces an explicit assumptions panel, and the stretched-cluster reservation is computed per-site (not a universal 50 %) because the real data proves both symmetric (the live `CL_VXB1K_CORE` is a clean 4+4) and metadata-absent (103/111 hosts have NO fault-domain tag) cases coexist.

**Primary recommendation:** Decompose into 4 plans in dependency order — (1) `snapshotMerge` engine + identity keys + collision-suffix + `vMetaData` 4.x parser fix + MVC snapshot-list labels; (2) stretched per-site reservation math + `confidence` + pill UI + the `vDatastore.Hosts → vHost.cluster` datastore-attribution fix; (3) allocation sliders + URL-hash codec; (4) DR sim engine (3 modes) + assumptions panel + caveats UI. Merge → stretched → DR is a hard chain (DR subtracts the stretched reservation); allocation is parallel-ish after merge.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| N-workbook → 1 estate merge | `engines/snapshotMerge/` (pure) | `store` (selection inputs) | Pure transform `Snapshot[] → mergedRows`; store only holds the snapshot Map + active selection (already shipped) |
| Cluster-collision visual suffix | `engines/snapshotMerge/` (pure) | UI (renders suffixed name) | Suffix is a data transform on `cluster`, not a render concern (vsizer `resolveClusterCollisions` pattern) |
| `(viSdkUuid, clusterName)` / `vmBiosUuid` keying | `engines/snapshotMerge/` (pure) | parser (carries `viSdkUuid`/`vmBiosUuid` — already done P1) | Identity is a merge concern; parser already surfaces the columns |
| Stretched per-site reservation | `engines/aggregation/aggregateClusters.ts` (pure, extend) | UI (pill toggle is an input) | Math owner is aggregation (ported vsizer ADR-0007); pill is a `stretchedClusters` Set input |
| Stretched `confidence` derivation | `engines/aggregation/` (pure) | parser (must surface `vSAN Fault Domain Name`) | Confidence is derived from parsed fault-domain presence — needs a new parsed column |
| Allocation ratio recompute | `engines/aggregation/` (pure, via mode/ratio params) | `useEstateView` (threads ratios) | Ratios are scalar inputs threaded like the existing `AccountingMode` param |
| URL-hash persistence | UI hook (`window.location.hash`) | — | Browser location is the only sanctioned persistence (NOT localStorage) |
| DR simulation | `engines/drSim/` (pure, NEW) | `useEstateView` + store scenario slice | DR = aggregation re-run on a host subset; scenario is an inputs-only store slice |
| Assumptions panel + caveats | `engines/drSim/` produces `caveats[]`; UI renders panel | i18n (FR+EN strings) | Engine emits the structured caveats; UI is a pure presenter |

## User Constraints

> No CONTEXT.md exists for this phase (`workflow.skip_discuss: true`, `discuss_mode: discuss`). Constraints below are extracted from the objective brief, the DEPENDENCY CONSTRAINT block, PROJECT.md, and the shipped P1–P3 conventions. The planner MUST honor these with the same authority as locked decisions.

### Locked Decisions (binding — do not reopen)

- **No external math/stats library.** `tslovers/maths.ts` evaluated and REJECTED (abandoned, jQuery+CLI transitive deps, fails bundle/privacy/supply-chain gates). Phase-4 math is elementary arithmetic — hand-rolled in pure `src/engines/` functions, Vitest-gated ≥75 %, consistent with Phases 1–3. Do NOT propose `mathjs`/`decimal.js`/`d3-array`/`simple-statistics`/etc. `simple-statistics` is a Phase-6-ONLY flagged candidate (out of scope here). [VERIFIED: objective brief DEPENDENCY CONSTRAINT + memory `feedback_dependency_bar.md`]
- **JS-double precision boundary noted as a known limit only.** JS doubles are exact for integers ≤ 2^53; MiB-scale integer sums are safe (a 2^53-MiB estate is ~9 PiB). Note the 2^53 boundary as a documented limit, do not add a bignum library. [VERIFIED: objective brief]
- **Engines are pure functions.** No React/Zustand/Zod inside `engines/`. Zod lives only at the parser boundary (01-04). No domain classes. [VERIFIED: PROJECT.md line 52 + 01-04-SUMMARY + ARCHITECTURE.md §1]
- **`useEstateView` is the project's ONLY `useMemo`.** Phase 4 must add NO second `useMemo`. The store already holds N snapshots; merge runs *inside* the existing single memo, keyed on `(selected snapshot identities, stretched set, scenario, ratios, mode)`. [VERIFIED: src/hooks/useEstateView.ts + 02-02-SUMMARY + grep gates in 03-01/03-03-SUMMARY]
- **Store holds inputs only.** No cached aggregates. Scenario/stretched are inputs-only store slices (Sets, replaced not mutated). [VERIFIED: src/store/snapshotStore.ts + ARCHITECTURE.md §5]
- **No `localStorage` of dataset rows or scenario/slider state.** Allocation ratios persist in the **URL hash ONLY** (ALC-03). DR scenario + stretched flags live in the in-memory store. Only `vatlas-theme` + `vatlas-lang` localStorage keys are permitted. [VERIFIED: PROJECT.md line 53 + REQUIREMENTS ALC-03 + CLAUDE.md "no localStorage of dataset rows"]
- **No editorial recommendations.** DR/stretched output carries factual numbers + verdicts only. No "you should" / "recommend" / "poor" / "good". i18n string lint enforces the denylist. [VERIFIED: PROJECT.md line 39 + FEATURES.md D12]
- **No network.** The runtime fetch/XHR/WS/Beacon guard THROWS on any non-same-origin request (Phase 1). Phase 4 adds zero network calls. [VERIFIED: CLAUDE.md Gotchas + Phase-1 PRV-01]
- **ECharts SVG renderer, `<Chart>` wrapper only.** Any new Phase-4 chart goes through the shipped `src/components/Chart.tsx` single ECharts import site. [VERIFIED: PROJECT.md line 56 + CLAUDE.md Architecture]
- **Commit prefix `<type>(NN-NN): …`**; branded units (`MiB`/`GHz`/`Cores`/…) never raw arithmetic on the brand without unwrap/rewrap; i18n keys land in BOTH `en/` and `fr/`; semgrep the generated code. [VERIFIED: CLAUDE.md Conventions]

### Claude's Discretion

- Exact `snapshotMerge` function signature + module file layout (within `engines/snapshotMerge/`).
- Exact per-site reservation formula shape (the *principle* is locked: per-site, not flat 50 %; `max(siteCap)/totalCap`).
- `confidence` tier thresholds (high/medium/low) — derive from fault-domain presence; exact rule is yours.
- URL-hash encoding scheme (recommend a compact `#alloc=cpu:8,ram:1.25` style; yours to finalize).
- DR `caveats[]` schema shape + the exact assumptions-panel copy (must be factual; ADR-style).
- Plan decomposition count/order (the recommended 4-plan split is a strong default; planner may override).
- Whether the `vDatastore.Hosts → vHost.cluster` datastore-attribution fix is in Phase-4 scope (RECOMMENDATION below: YES, fold into the stretched/DR plan — cheap, correctness-improving, named input).

### Deferred Ideas (OUT OF SCOPE for Phase 4)

- DR scenario presets ("lose largest cluster" etc.) — v1.x / D4 (FEATURES.md).
- Snapshot side-by-side diff — v2 / D7.
- `simple-statistics` percentile work — Phase 6 only.
- Multi-file `.zip` bundle ingestion — out of scope per PROJECT.md.
- Trends timeline / sparklines — Phase 6 (consumes Phase-4 stable keys).
- HA admission-control *hard enforcement* in DR — surfaced as a caveat only; hard modeling is a future enhancement (Moderate-10).
- Anti-affinity *hard enforcement* — soft surfacing only if `vRP`/`Cluster rule(s)` expose it; not a v1 placement engine.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MVC-01 | N workbooks → one estate | `snapshotMerge` engine; vsizer `resolveClusterCollisions` port; **also handles N vCenters in ONE workbook** (real-data discovery §Pitfall-1) |
| MVC-02 | Visual suffix on colliding cluster names (NEVER silent merge) | Generalize vsizer `resolveClusterCollisions` to key on `(viSdkUuid, clusterName)`; suffix `"<cluster> (<vCenterLabel>)"` |
| MVC-03 | Keyed on `(VI SDK UUID, vm BIOS UUID)`; cross-vCenter vMotion dedupes | Parser already carries `viSdkUuid`/`vmBiosUuid`; **`vmBiosUuid` = RVTools `VM UUID` (vCenter-assigned), NOT SMBIOS** (§Pitfall-2, verified) |
| MVC-04 | Per-snapshot vCenter label + RVTools version in snapshot list | `Snapshot.vCenterLabel`/`rvtoolsVersion` exist; **needs the RVTools 4.x columnar `vMetaData` parser fix** (§Pitfall-3) |
| STR-01 | Étendu/Stretched pill | `stretchedClusters` Set input → ported `aggregateClusters` DR math (already dormant in code); pill = aria-pressed idiom |
| STR-02 | Per-site CPU+RAM reservation (NOT flat 50 %) for asymmetric (6+4) | Extend `aggregateClusters` with per-site reservation; `vHost.vSAN Fault Domain Name` is the site key (verified present) |
| STR-03 | Confidence high/medium/low from site/fault-domain metadata presence | `vSAN Fault Domain Name` populated 8/111 in real file → drives confidence; absence ⇒ "assumed symmetric" medium/low |
| STR-04 | Low-confidence warning chip | UI chip bound to `ClusterAggregate.stretchedConfidence === 'low'` |
| ALC-01 | CPU/RAM sliders + presets (1:1, 4:1, 8:1, VDI 10:1) | New allocation UI; presets are a small enum; recompute via `useEstateView` ratio params |
| ALC-02 | Defaults CPU 4:1, RAM 1:1 | FEATURES.md allocation table (HIGH confidence, VMware vCAT/Broadcom sourced) |
| ALC-03 | URL-hash-only persistence (NO localStorage) | `window.location.hash` codec hook; NO Zustand persist middleware |
| ALC-04 | Consolidation vs physical cores (not hyperthreads) | Already correct: `ClusterAggregate.vcpuPerPcpu` uses `usablePhysicalCores`; `VHostRow` structurally has no threads field (Moderate-4 type-prevented — confirmed 02-02) |
| DRS-01 | Host-loss mode | `drSim` removes selected hosts; re-run aggregation on survivors |
| DRS-02 | Cluster-loss mode | `drSim` removes selected clusters' hosts; evacuee = their VM vCPU/vRAM sum |
| DRS-03 | vCenter-loss mode | `drSim` removes all hosts of a `viSdkUuid`; needs merged estate (depends on MVC) |
| DRS-04 | Explicit assumptions panel (does/doesn't model HA adm. ctrl, anti-affinity, restart priority) | Static factual copy + the parsed `vCluster.AdmissionControlEnabled`/`Failover Level` surfaced as context (verified present) |
| DRS-05 | Confidence + caveats[] on every result | `DrSimResult.confidence` + `caveats: string[]`; reservation-vs-capacity check (Moderate-10) |
| DRS-06 | Before/after numbers, evacuee totals, per-survivor verdict | `drSim` returns before/after `GlobalSummary` + per-cluster verdict (`absorbs`/`tight`/`overflows`) |

## Standard Stack

### Core (all already shipped P1–P3 — Phase 4 adds ZERO new runtime deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | `^19.2.6` | UI runtime | Shipped; pill/sliders/panels are plain components |
| Zustand | `^5.0.13` | Inputs-only store | Shipped `snapshotStore`; add scenario/stretched slices (Sets) |
| TypeScript | `~5.9.3` strict | Branded units | `noUncheckedIndexedAccess` + branded `MiB`/`GHz`/`Cores` shipped |
| Vitest | `^4.1.2` | ≥75 % engine gate | Shipped; the 4+4 / 6+4 / 8+0 / 2+2 stretched matrix + collision/vMotion fixtures land here |
| ECharts (`echarts-for-react`) | `^6` / `^3.0.6` | Optional DR before/after bar | Only if a chart is added; via shipped `<Chart>` SVG wrapper |
| `@biomejs/biome` | `^2.4.15` | Lint/format | Shipped; run `npx @biomejs/biome check .` NOT `npm run lint` (RTK intercept) |

**No new dependencies.** Phase-4 math is hand-rolled pure arithmetic (locked decision). [VERIFIED: package.json review via STACK.md + DEPENDENCY CONSTRAINT]

### Supporting (existing modules to extend, not new deps)

| Module | Action | Phase-4 Use |
|--------|--------|-------------|
| `src/engines/parser/adapters/rvtools.ts` | Extend | Add `vDatastore.Hosts`/`# Hosts` parse; surface `vHost.vSAN Fault Domain Name` |
| `src/engines/parser/captureDate.ts` | Fix | RVTools 4.x columnar `vMetaData` (`RVTools version` column, not Property/Value) |
| `src/engines/aggregation/aggregateClusters.ts` | Extend | Per-site reservation + `confidence` (the dormant 50 % math is already ported) |
| vsizer `engines/parser/resolveClusterCollisions.ts` | Port + generalize | Key on `viSdkUuid` not filename; suffix on `vCenterLabel` |
| `src/hooks/useEstateView.ts` | Extend signature | Thread `selectedSnapshots[]`, `stretched`, `scenario`, `ratios` (still ONE memo) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled per-site reservation | `simple-statistics` / `d3-array` | REJECTED by locked decision — math is `max()`/`sum()`/division, library is pure overhead + supply-chain risk |
| URL hash | `localStorage` / Zustand persist | FORBIDDEN — ALC-03 + privacy invariant; hash is the only sanctioned share-state surface |
| `vmBiosUuid` = SMBIOS UUID | RVTools `SMBIOS UUID` column | WRONG — SMBIOS is not unique (clone/template collisions); RVTools 4.3.1+ `VM UUID` column is the vCenter-assigned unique key (§Pitfall-2) |
| Separate `useMemo` for merge | New hook with its own memo | FORBIDDEN — single-useMemo invariant; merge runs inside `useEstateView` |

## Architecture Patterns

### System Architecture Diagram

```
N RVTools .xlsx files (or 1 file with N vCenters — RVTools 4.x)
        │  parser.worker.ts (shipped P1; SheetJS isolated, dense:true)
        ▼
Snapshot[]  (immutable; viSdkUuid + vmBiosUuid carried; in store Map)
        │
        │  user inputs (store, inputs-only):
        │   • selected snapshot ids (estate selection)
        │   • stretchedClusters: Set<clusterKey>
        │   • scenario: { failedHosts, failedClusters, failedVCenters }
        │   • allocation ratios (from URL hash → store mirror or hook)
        ▼
useEstateView(mode, ratios)   ◀── the PROJECT'S ONLY useMemo
        │  memo key = (selected snapshot identities, stretched, scenario,
        │              ratios, mode)
        │
        ├─► snapshotMerge.mergeSnapshotsToEstate(selected[])
        │     • dedupe VMs by vmBiosUuid (cross-vCenter vMotion)
        │     • key clusters (viSdkUuid, clusterName)
        │     • collision → "<cluster> (<vCenterLabel>)" suffix
        │     • returns { vinfo, vhost, vdatastore, vcenters[] }
        │
        ├─► aggregateClusters({ ...merged, stretchedClusters,
        │                       allocRatios })
        │     • per-site reservation (vSAN Fault Domain → siteCap)
        │     • confidence: high|medium|low (fault-domain presence)
        │     • vcpuPerPcpu against physical cores (shipped, ALC-04)
        │
        ├─► aggregateGlobals(clusters)
        │
        └─► drSim.runScenario(merged, scenario, stretchedFlags,
                              allocRatios)
              • remove failed host/cluster/vCenter rows
              • re-run aggregateClusters on survivors
              • evacuee totals, before/after, per-survivor verdict
              • confidence + caveats[]
        ▼
EstateView { globals, clusters, hosts, datastores, vmRows,
             vCenters[], drSim, accountingMode, allocRatios, trends:null }
        │
        ▼  components (pure presenters, plain props, no useMemo)
Dashboard · Inventory · StretchedPill · AllocationSliders · DrSimPanel
```

File-to-implementation mapping is in Component Responsibilities (ARCHITECTURE.md §3) — the diagram shows data flow, not files.

### Recommended Project Structure (net-new files only)

```
src/engines/
├── snapshotMerge/
│   ├── mergeSnapshotsToEstate.ts   # Snapshot[] → merged rows + collision suffix + vMotion dedupe
│   ├── vCenterIndex.ts             # Map<viSdkUuid, {server,label,clusters,vmCount}>
│   └── *.test.ts                   # colliding-name + vMotioned-VM dedupe fixtures
├── aggregation/
│   └── aggregateClusters.ts        # EXTEND: per-site reservation + confidence (file exists)
└── drSim/
    ├── runScenario.ts              # (merged, scenario, stretched, ratios) → DrSimResult
    ├── allocate.ts                 # ratio application + verdict (absorbs/tight/overflows)
    └── *.test.ts                   # 4+4 / 6+4 / 8+0 / 2+2 matrix + reservation-vs-capacity
src/store/
├── scenarioStore.ts                # OR slice: failedHosts/Clusters/VCenters Sets (inputs-only)
└── stretchedStore.ts               # OR slice: stretched cluster-key Set
src/hooks/
└── useAllocationHash.ts            # URL-hash codec (read on mount, write on change) — NOT a useMemo
src/components/
├── stretched/StretchedPill.tsx     # per-cluster aria-pressed toggle + low-confidence chip
├── allocation/AllocationSliders.tsx# CPU/RAM sliders + preset buttons
└── dr/DrSimPanel.tsx               # mode select + before/after + assumptions panel + caveats
```

### Pattern 1: Generalized cluster-collision resolution (MVC-02)

**What:** Port vsizer `resolveClusterCollisions.ts` but key on `viSdkUuid` instead of filename; suffix with `vCenterLabel`.
**When:** Two clusters share a name across distinct `viSdkUuid` values (whether across files OR within one RVTools 4.x workbook).
**Example:**

```typescript
// Source: vsizer/src/engines/parser/resolveClusterCollisions.ts (port + generalize)
// Build Map<clusterName, Set<viSdkUuid>>. size > 1 ⇒ colliding.
// Colliding ⇒ rewrite cluster on BOTH vinfo + vhost rows:
//   `${cluster} (${vCenterLabelFor(viSdkUuid)})`
// Non-colliding ⇒ pass-through reference (never mutate input).
```

### Pattern 2: VM dedupe key — `VM UUID`, never SMBIOS (MVC-03)

**What:** Dedupe VMs across vCenters/snapshots on `vmBiosUuid` (= RVTools `VM UUID`, the vCenter-assigned 128-bit UUID), with a secondary tiebreak.
**When:** A VM vMotioned across vCenters appears in two snapshots/vCenter blocks.
**Example:**

```typescript
// Source: parser already maps vmBiosUuid ← 'vm uuid'/'bios uuid'/'uuid' (rvtools.ts:60)
// RVTools 4.3.1+ fills the `UUID`/`VM UUID` column with the UNIQUE
// vCenter-assigned value (NOT SMBIOS — SMBIOS dups across clones/templates).
// Dedupe: keep first occurrence by vmBiosUuid; if blank, fall back to
// (viSdkUuid, vmName, cluster). Secondary key vmInstanceUuid is ABSENT in
// RVTools 4.7 (column does not exist — verified) — do NOT rely on it as
// the primary path; treat as optional enrichment only.
```

### Pattern 3: Per-site stretched reservation + confidence (STR-02/03)

**What:** Replace the flat `0.5 × capacity` with `max(siteA, siteB) / total`; derive `confidence` from `vSAN Fault Domain Name` presence.
**When:** A cluster is in the `stretchedClusters` Set.
**Example:**

```typescript
// Source: extend src/engines/aggregation/aggregateClusters.ts (50% math ported, dormant)
// Group cluster hosts by vHost.vSAN Fault Domain Name.
//  • ≥2 distinct fault domains, all hosts tagged → confidence 'high';
//    reservedFraction = maxSiteCapacity / totalCapacity
//    (symmetric 4+4 → 0.5; asymmetric 6+4 → 0.6 — CORRECT, not 0.5)
//  • fault domains absent/partial → confidence 'medium' (assumed
//    symmetric, reservedFraction = 0.5) or 'low' (asymmetric host
//    count but no site data — cannot prove the split)
// Apply reservedFraction to GHz, RAM (MiB), AND usablePhysicalCores
// identically (the existing cpuDrFactor/ramDrFactor shape generalizes:
// factor = 1 / (1 - reservedFraction)).
```

### Pattern 4: Allocation ratios threaded like AccountingMode (ALC-01/04)

**What:** Pass `{ cpuRatio, ramRatio }` into `aggregateClusters`/`useEstateView` as scalar params, exactly like the shipped `mode` param.
**When:** Always; defaults CPU 4:1, RAM 1:1.
**Example:**

```typescript
// vcpuPerPcpu already = vcpuAllocated / usablePhysicalCores (physical
// cores — ALC-04 satisfied, Moderate-4 type-prevented). The ALLOCATION
// slider does NOT change vcpuPerPcpu; it changes the *headroom verdict*:
// "can N physical cores at ratio R host the allocated vCPU?" →
// capacityVcpu = usablePhysicalCores × cpuRatio; headroom = capacity −
// allocated. Same shape for RAM. Pure arithmetic, no library.
```

### Pattern 5: URL-hash codec (ALC-03) — NOT a useMemo

**What:** A small hook reads `window.location.hash` on mount, writes on slider change via `history.replaceState`. Mirrors into the inputs-only store or returns the value directly.
**When:** Allocation ratios only (scenario/stretched stay in-memory store).
**Example:**

```typescript
// useAllocationHash(): parse `#alloc=cpu:8,ram:1.25` → {cpu,ram}
// (clamp to slider bounds, fall back to {4,1} on parse failure).
// On change: history.replaceState(null,'',`#alloc=cpu:${c},ram:${r}`).
// This is event-driven state sync, NOT a render memo — does not count
// against the single-useMemo invariant.
```

### Anti-Patterns to Avoid

- **Silent merge on cluster name.** NEVER. Two clusters named `CL_WRK_PFLEX` under different `viSdkUuid` are different clusters — suffix, never combine (Critical-4).
- **Keying VMs on SMBIOS UUID or `vm-####` MoRef.** SMBIOS dups across clones; MoRef is per-vCenter. Use the vCenter-assigned `VM UUID` (Critical-4 / verified RVTools 4.3.1 changelog).
- **Flat 50 % for all stretched clusters.** Correct only for symmetric + active/active. Asymmetric 6+4 reserves 60 % on the big site (Critical-3).
- **Collapsing fault-domain absence to "symmetric, confident".** Absence ⇒ `medium`/`low` confidence + warning chip, never silent `high` (Critical-3 / STR-03/04).
- **Second `useMemo`.** Merge/DR/stretched all run inside `useEstateView`. Adding `useMemo` anywhere else breaks the invariant + the grep gate.
- **`localStorage`/`sessionStorage`/Zustand-persist for ratios or scenario.** ALC-03 + privacy invariant. URL hash for ratios; in-memory store for scenario.
- **Editorial verbs in DR/stretched output or i18n.** "recommend/should/poor/good" are denylisted. Verdict is `absorbs|tight|overflows` (factual enum).
- **Treating the real `allvCenters.xlsx` as 3 separate files.** It is ONE workbook with 3 vCenters (3 `vMetaData` rows). The merge engine must split by `viSdkUuid` *within* a snapshot too — not only across snapshots (§Pitfall-1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cluster-collision suffixing | New collision algorithm | Port vsizer `resolveClusterCollisions.ts` (generalize key) | Battle-tested; same algorithm, only the key changes (filename→viSdkUuid) |
| Cluster aggregation + DR reservation | New cluster math | Extend shipped `aggregateClusters.ts` (50 % math already ported + tested, dormant) | 02-02 ported it intact with a regression test specifically for Phase 4 |
| Branded unit arithmetic | New number wrappers | `src/engines/units` (`mib`/`ghz`/`cores` + converters) | Shipped, gated; prevents MB-is-MiB + MHz-vs-GHz bugs by type |
| XLSX parsing for new columns | New parser | Extend `adapters/rvtools.ts` column maps (`mapColumns`) | Alias-dictionary pattern shipped; just add `Hosts`/`vSAN Fault Domain Name` |
| Pill/slider/segmented control a11y | New toggle component | Reuse the `ThemeToggle`/`AccountingModeToggle` `<fieldset role="group">` + `aria-pressed` idiom | CLAUDE.md mandates reuse; shipped + a11y-verified P2/P3 |
| Per-VM/host/datastore display rows | New projections | Existing `EstateView.vmRows`/`hosts`/`datastores` | Shipped P2/P3; Phase 4 consumes, doesn't re-derive |

**Key insight:** Phase 4 is mostly *extension and composition* of shipped pure engines, not greenfield. The genuinely new code is the `snapshotMerge` module and the `drSim` module — both small pure functions over already-validated rows. The math (max, sum, division, ratio) is grade-school arithmetic; a library would be pure liability against the locked dependency bar.

## Runtime State Inventory

> Phase 4 is code/config-only (new pure engines + UI + store slices). No rename/refactor of existing stored identifiers. The only "state" touched is in-memory (Zustand) + URL hash.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB/datastore; snapshots are in-memory `Map` (privacy invariant). | None — verified by `src/store/snapshotStore.ts` (module-scope `new Map()`, no persist middleware) |
| Live service config | None — 100 % client-side, no external services. | None — verified by PRV-01 fetch guard (Phase 1) |
| OS-registered state | None — browser app, no OS registration. | None |
| Secrets/env vars | None — no secrets; allocation ratios live in URL hash (shareable, non-secret by design). | None |
| Build artifacts | None — new TS files; no package rename/egg-info. The shipped bundle gates (echarts ≤300 KiB gz, @tanstack ≤60 KiB gz) must stay green; Phase 4 adds no chart/table deps so no new chunk. | Run `node scripts/check-bundle-size.mjs` in plan verify (existing gate, no new artifact) |

## Common Pitfalls

### Pitfall 1: The real multi-vCenter file is ONE workbook with N vCenters (not N files)

**What goes wrong:** The merge engine is designed only for `Snapshot[]` (one vCenter per file). The real `~/Library/CloudStorage/OneDrive-Home/20260430_1400_allvCenters.xlsx` is a **single RVTools 4.7 workbook containing 3 vCenters** — `vMetaData` has **3 rows** (one per `Server`: `spvspherevc11/13/14.ad.net.fr.ch`), and `vInfo`/`vHost`/`vCluster` rows carry 3 distinct `VI SDK UUID` values (`dcfb0dd2…` 1345 VMs, `f0cb2dc9…` 40 VMs, `4415e891…` 62 VMs). RVTools 4.x natively exports multiple vCenters into one workbook.
**Why it happens:** The brief and ARCHITECTURE.md frame merge as "N files → 1 estate"; the parser produces one `Snapshot` per file. A 3-vCenter file becomes ONE `Snapshot` whose rows span 3 `viSdkUuid` values.
**How to avoid:** `mergeSnapshotsToEstate` and `aggregateClusters` must group/key by `viSdkUuid` carried on the *rows*, NOT by `Snapshot` identity. The vCenter index is built from row `viSdkUuid`, not from one-snapshot-one-vCenter. The cluster collision check operates on `(viSdkUuid, clusterName)` regardless of which snapshot the rows came from.
**Warning signs:** Estate vCenter count = number of files instead of distinct `viSdkUuid`; cluster aggregates merge `CL_11` from vc11 with a same-named cluster from vc14 (no collision in *this* file — 0/18 — but a synthetic fixture must prove it).
**Source:** [VERIFIED: direct inspection of the real workbook, 2026-05-16]

### Pitfall 2: `vmInstanceUuid` does not exist in RVTools 4.7; key on `VM UUID` not SMBIOS

**What goes wrong:** The brief's secondary key `vmInstanceUuid` and the adapter alias (`'vm instance uuid'`/`'instance uuid'`) match NO column in RVTools 4.7 — `vInfo` has `SMBIOS UUID` and `VM UUID` only (no `VM Instance UUID`). Keying VMs on SMBIOS UUID double-counts cloned/templated VMs (SMBIOS is not unique); keying on the per-vCenter MoRef (`VM ID` = `vm-2408033`) fails across vCenters.
**Why it happens:** RVTools changed UUID semantics in 4.3.1 — the `UUID`/`VM UUID` column is now the **vCenter-assigned unique 128-bit UUID** (previously it held the non-unique SMBIOS value). The current adapter maps `vmBiosUuid ← ['vm uuid','bios uuid','uuid']` which correctly resolves to `VM UUID` in 4.7. Good — but the *name* `vmBiosUuid` is misleading and `vmInstanceUuid` is dead.
**How to avoid:** Dedupe on `vmBiosUuid` (which is RVTools `VM UUID`, the vCenter-unique key). Treat `vmInstanceUuid` as optional/absent — do NOT make it a required secondary path. Fallback when `VM UUID` is blank: `(viSdkUuid, vmName, cluster)`. In the real file: 1446/1447 distinct `VM UUID`, exactly 1 duplicate pair (a real cross-vCenter clone or vMotion — the dedupe target).
**Warning signs:** Estate VM total > sum of per-vCenter totals; 31 templates double-counted; the 1 dup pair not collapsed.
**Source:** [VERIFIED: real workbook inspection + RVTools 4.3.1 changelog via web search — virtual-allan.com / RVTools docs]

### Pitfall 3: RVTools 4.x `vMetaData` is columnar, not Property/Value — MVC-04 version is wrong

**What goes wrong:** The shipped `captureDate.ts`/`adaptRvtoolsVMetaData` read `vMetaData` as a `Property`/`Value` 2-column sheet. RVTools 4.7's `vMetaData` is **columnar**: headers `["RVTools major version","RVTools version","xlsx creation datetime","Server"]` with one row per vCenter. The version sniffer therefore falls back to marker-column sniffing and reports `"3.11+"` for a 4.7 file (01-04-SUMMARY explicitly logged this gap). MVC-04 ("per-snapshot RVTools version in snapshot list") will show the wrong version.
**Why it happens:** Phase-1 fixtures had no explicit `vMetaData.RVTools Version` cell; the real 4.7 schema was not available then.
**How to avoid:** Extend the `vMetaData` parser to detect the columnar 4.x shape (presence of an `RVTools version` *column*) and read `RVTools version` (e.g. `4.7.1.4`) + `xlsx creation datetime` + `Server` per row. Keep the legacy Property/Value path for older exports. This also gives a precise per-vCenter `Server` label for `vCenterLabel` and `xlsx creation datetime` for `capturedAt` (better than filename ISO). **Fold this into the merge plan (Plan 1)** — it is a prerequisite for correct MVC-04 and clean vCenter labelling.
**Warning signs:** Snapshot list shows "RVTools 3.11+" for a 4.7 workbook; `capturedAt` from filename when a precise `xlsx creation datetime` exists.
**Source:** [VERIFIED: real workbook `vMetaData` dump + 01-04-SUMMARY "A7 gap" note]

### Pitfall 4: Stretched-cluster 50 % is conditional — the real data proves both extremes

**What goes wrong:** Applying a universal 50 % reservation. The real file has exactly ONE genuinely stretched cluster: `CL_VXB1K_CORE` — 8 hosts, fault domains `Secondary`×4 + `UNI`×4 — a **symmetric 4+4** where 50 % IS correct. But only **8 of 111 hosts** carry any `vSAN Fault Domain Name`; the other 18 clusters have NO site metadata. An asymmetric 6+4 (the STR-02 acceptance case) is NOT in the real file and must be a synthetic fixture; for it, the correct reservation is `6/(6+4) = 0.6`, not 0.5.
**Why it happens:** The naive model "stretched ⇒ reserve half" is the symmetric simplification (vsizer ADR-0007). Real estates mostly lack fault-domain tags.
**How to avoid:** Per-site reservation = `maxSiteCapacity / totalCapacity` grouped by `vSAN Fault Domain Name`. `confidence`: `high` when ≥2 fault domains cover all cluster hosts; `medium` when stretched but no/partial site data (assume symmetric, 0.5); `low` when host count is odd/asymmetric AND no site data (cannot prove the split — STR-04 chip). Test matrix MUST include 4+4 (→0.5, high), 6+4 (→0.6, high if tagged / low if untagged), 8+0 (non-stretched failback), 2+2 (minimum).
**Warning signs:** DR says "survivor OK" for a 6+4 stretched losing the 6-host site; tests only cover even host counts; a `low`-confidence cluster shows no warning chip.
**Source:** [VERIFIED: real workbook fault-domain analysis + PITFALLS.md Critical-3 + Broadcom HA admission-control docs (cited PITFALLS)]

### Pitfall 5: DR sim trust — wrong numbers are the project's #1 risk

**What goes wrong:** DR sim says "survivors absorb the load" while real vSphere HA admission control would refuse to power on half the VMs (it doesn't model HA reservations, memory reservations vs configured, anti-affinity, restart priority, stretched split-brain).
**Why it happens:** Pure capacity arithmetic ignores policy. Operators base budget decisions on the number.
**How to avoid:** Every `DrSimResult` carries `confidence` + `caveats: string[]`. The UI shows an explicit assumptions panel listing what IS and ISN'T modeled (factual, no "should"). Surface the *parsed* `vCluster.AdmissionControlEnabled` + `Failover Level` (both present in the real file: `CL_11` Failover=1/admCtl=True, `CL_12` Failover=2) as factual context — do NOT enforce, just disclose mismatch as a caveat. Reservation-vs-capacity check: if survivor memory *reservation* (not configured) > 80 % survivor RAM, emit a caveat. Powered-off VMs respected via the shipped 3 accounting modes (real file: 1373 on / 74 off / 31 templates).
**Warning signs:** No assumptions panel beside the verdict; verdict is editorial ("you should add hosts") instead of `overflows`; caveats array empty on a stretched/asymmetric scenario.
**Source:** [VERIFIED: PITFALLS.md Moderate-10 + real `vCluster` HA-field inspection; CITED: Broadcom vSphere HA Admission Control techdocs via PITFALLS sources]

### Pitfall 6: `vDatastore.Cluster name` is 44 % blank — the named Hosts→cluster fix

**What goes wrong:** Per-cluster datastore attribution uses `vDatastore.Cluster name` (shipped 58b4361). In the real file that column is **blank for 75/170 datastores** (vSAN/host-local/NFS not cluster-attributed). Those datastores vanish from per-cluster storage views, under-counting stretched/DR storage capacity.
**Why it happens:** RVTools only fills `Cluster name` for VMFS datastores shared at cluster scope; vSAN and host-local datastores have it blank but DO populate `Hosts` (170/170) and `# Hosts`.
**How to avoid (RECOMMENDED — fold into Plan 2):** Parse `vDatastore.Hosts` (a host-name list) + `# Hosts`. When `Cluster name` is blank, attribute the datastore to the cluster(s) of its `Hosts` via the `vHost.hostName → vHost.cluster` map. This is a pure join, no new dep, materially improves stretched/DR storage accuracy. Scope decision: **YES, in Phase 4** — it is a named Phase-4 input (memory `project_datastore_cluster_attribution.md`), cheap, and DR storage correctness depends on it.
**Warning signs:** Estate datastore capacity per cluster sums to less than global; vSAN datastores show no owning cluster; a stretched vSAN cluster shows zero local storage.
**Source:** [VERIFIED: real workbook `vDatastore` inspection (95 pop / 75 blank `Cluster name`, 170 pop `Hosts`) + memory `project_datastore_cluster_attribution.md`]

## Code Examples

### Building the vCenter index from rows (handles N-vCenters-in-1-file)

```typescript
// Source: derived from src/store/snapshotStore.ts shape + real-data §Pitfall-1
// Pure: group selected snapshots' rows by row.viSdkUuid (NOT snapshot id).
interface VCenterEntry { viSdkUuid: string; server: string; label: string; vmCount: number }
// For each selected Snapshot, for each vinfo row → bucket by viSdkUuid;
// label = vMetaData.Server for that uuid (4.x columnar fix) ?? viSdkServer
//         ?? snapshot.vCenterLabel.
```

### Per-site reservation (extends the shipped dormant 50 % math)

```typescript
// Source: extend src/engines/aggregation/aggregateClusters.ts:59-76
// Existing dormant code:  drReservedGhz = isStretched ? 0.5 * physicalGhz : 0
// Generalized:
//   const f = reservedFraction(clusterHosts) // 0.5 symmetric, 0.6 for 6+4
//   const drReservedGhz  = isStretched ? f * physicalGhz : 0
//   const drReservedRam  = isStretched ? f * physicalRamMib : 0
//   const usableCores    = isStretched ? (1-f) * physicalCores : physicalCores
//   const cpuDrFactor    = isStretched && physicalGhz>0 ? 1/(1-f) : 1
// reservedFraction groups hosts by vSAN Fault Domain Name; returns
// maxSiteCap/totalCap (cap = Σ physicalGhz per fault domain) or 0.5 when
// fault domains absent (confidence then 'medium'/'low').
```

### Allocation headroom verdict (pure, no library)

```typescript
// Source: FEATURES.md allocation defaults (CPU 4:1, RAM 1:1) + Pattern 4
// capacityVcpu = usablePhysicalCores * cpuRatio   // ratio default 4
// capacityRamMib = physicalRamMib * ramRatio      // ratio default 1
// verdict =
//   allocated <= 0.8*capacity ? 'absorbs'
//   : allocated <= capacity    ? 'tight'
//   :                            'overflows'
// Branded: unwrap (x as number), compute, rewrap via cores()/mib().
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RVTools `UUID`/`VM UUID` = SMBIOS UUID (non-unique) | `VM UUID` = vCenter-assigned unique 128-bit UUID | RVTools 4.3.1 | MVC-03 dedupe MUST use `VM UUID`; SMBIOS would double-count clones |
| One vCenter per RVTools workbook | RVTools 4.x exports N vCenters into one workbook | RVTools 4.x | Merge must key by row `viSdkUuid`, not Snapshot identity |
| `vMetaData` as Property/Value sheet | `vMetaData` columnar (one row/vCenter, `RVTools version` col) | RVTools 4.x | Parser fix needed for correct MVC-04 version + per-vCenter label/timestamp |
| Flat 50 % stretched reservation (vsizer ADR-0007) | Per-site `max/total` + confidence | Phase 4 (this) | Asymmetric clusters correct; absence-of-metadata surfaced as low confidence |

**Deprecated/outdated:**

- `vmInstanceUuid` as a reliable secondary VM key — the `VM Instance UUID` column does not exist in RVTools 4.7. Treat as optional enrichment, not a required path.
- Marker-column RVTools-version sniffing as the *primary* version source — the columnar `vMetaData` is authoritative when present.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The asymmetric 6+4 stretched case (STR-02 acceptance) must be a SYNTHETIC fixture — no asymmetric stretched cluster exists in the real file (only the symmetric 4+4 `CL_VXB1K_CORE`). | Pitfall 4 | Low — synthetic fixtures are already the project norm (10k inventory fixture); planner just must build a 6+4 fixture, not expect real data |
| A2 | `vmBiosUuid` (parser field) resolves to RVTools `VM UUID` (vCenter-unique) in 4.7 via the existing alias list — confirmed by the real-file dump showing `VM UUID` populated & 1446/1447 distinct. The field NAME is misleading but the mapping is correct. | Pitfall 2 | Low — verified by inspection; risk is only cosmetic (name) unless an older export lacks `VM UUID` and only has `SMBIOS UUID` (then alias `'uuid'` could mis-resolve — planner should add a fixture for a pre-4.3.1 export if one is obtainable) |
| A3 | The `vDatastore.Hosts → vHost.cluster` attribution fix is in Phase-4 scope. | Pitfall 6 | Medium — if the planner/user descopes it, stretched/DR storage stays under-counted for vSAN; flag in Plan 2 for explicit user confirmation |
| A4 | Per-site reservation formula = `maxSiteCapacity / totalCapacity` (capacity = Σ physical GHz per fault domain; RAM analogous). | Pattern 3 | Medium — this is the standard interpretation (PITFALLS Critical-3, Broadcom-sourced) but the exact capacity basis (GHz vs cores vs RAM, or the max of all three) is a modelling choice the planner should pin in an ADR |
| A5 | DR `confidence` enum = `high|medium|low` mirroring the stretched confidence; `caveats` is `string[]` of i18n keys (not free text, to keep FR/EN parity + no editorial verbs). | Pitfall 5 | Low — consistent with shipped readiness/confidence patterns; exact schema is Claude's discretion per brief |
| A6 | RVTools 4.x columnar `vMetaData` parser fix belongs in Plan 1 (merge) as a prerequisite for MVC-04. | Pitfall 3 | Low — it is a parser extension; could alternatively be a standalone micro-plan, but coupling to merge is natural |

**If this table is empty:** it is not — all 6 are modelling/scope assumptions the planner (and a discuss pass, if run) should confirm. None are compliance/security claims.

## Open Questions

1. **Is the asymmetric-stretched (6+4) acceptance proven only by synthetic fixture?**
   - What we know: real file has only a symmetric 4+4 stretched cluster; STR-02 explicitly names "6+4".
   - What's unclear: nothing technically — just that the planner must author a synthetic 6+4 fixture (with fault-domain tags) AND a 6+4-without-tags fixture (low confidence).
   - Recommendation: Plan 2 builds both fixtures; the 4+4 path is additionally validated against the real `CL_VXB1K_CORE`.

2. **Capacity basis for `max/total` per-site reservation — GHz, cores, RAM, or worst-of?**
   - What we know: vsizer applied the fraction identically to GHz/RAM/cores; per-site asymmetry could differ per resource (e.g. 6 big hosts vs 4 small).
   - What's unclear: whether to compute one fraction (from a chosen basis) or per-resource fractions.
   - Recommendation: Pin in an ADR. Default: per-resource fraction (GHz fraction for GHz, RAM-MiB fraction for RAM, core fraction for cores) — most accurate, still trivial arithmetic. Surface as a documented assumption in the assumptions panel.

3. **Where does the allocation ratio live for the engine — store mirror or hook return threaded into `useEstateView`?**
   - What we know: ratios must NOT be in localStorage; URL hash is the persistence; `useEstateView` is the only memo.
   - What's unclear: whether to mirror the parsed hash into the inputs-only store (consistent with scenario/stretched) or pass it as a `useEstateView(mode, ratios)` argument from a hook.
   - Recommendation: Pass as an argument (like `mode` today) and have `useAllocationHash` own the hash↔state sync; keeps the store free of UI-derived URL state. Either is acceptable; planner decides.

4. **Does Phase 4 surface a chart (DR before/after bar) or numbers-only?**
   - What we know: VIZ infra (ECharts SVG `<Chart>`) is shipped; UI-SPEC for Phase 4 not yet written.
   - Recommendation: Defer the chart decision to the Phase-4 UI-SPEC; the engine output (before/after `GlobalSummary`) supports either. Numbers-first is sufficient for DRS-06.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Real multi-vCenter workbook | Merge validation (mandatory per `feedback_real_file_uat`) | ✓ | RVTools 4.7.1.4, 3.4 MB, 3 vCenters, 1447 vInfo | — (synthetic 6+4 fixture also required for STR-02) |
| `xlsx` (SheetJS 0.20.3 tarball) | Parser (shipped) | ✓ | 0.20.3 | — |
| Node + Vitest 4 | Engine tests | ✓ | shipped | — |
| `~/Library/CloudStorage/OneDrive-Home/` access | Local UAT only (not CI) | ✓ (dev box) | — | CI uses committed canary fixtures (gitignored real files unavailable in CI — expected, per 01-04-SUMMARY) |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Asymmetric-stretched real data is absent → synthetic 6+4 fixture (fallback is the project norm).

## Security Domain

> `security_enforcement` not explicitly set in config → treated as enabled. Phase 4 adds pure compute + UI + URL-hash state; no auth/crypto/network. The dominant "security" property here is the privacy invariant.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface (client-only, no accounts — anti-feature A2) |
| V3 Session Management | no | No sessions; refresh = data gone |
| V4 Access Control | no | No multi-user / no server |
| V5 Input Validation | yes | Zod at the parser boundary (shipped P1); URL-hash codec MUST validate/clamp `#alloc=` input (untrusted: a shared link could carry a malformed/oversized hash → parse defensively, clamp to slider bounds, fall back to defaults — never `eval`/`JSON.parse` of attacker-controlled hash without bounds) |
| V6 Cryptography | no | No crypto (no secrets; ratios are non-secret shareable state) |
| V12 Files/Resources | yes | XLSX parse stays in the shipped Web Worker; new column reads are pure cell access (no path/formula evaluation) |
| V14 Configuration | yes | CSP `connect-src 'self'` + runtime fetch guard (shipped P1) — Phase 4 must add NO network call; bundle gates stay green |

### Known Threat Patterns for client-side XLSX analytics

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious URL hash (`#alloc=`) → ReDoS / huge-number / injection | Tampering / DoS | Strict regex with bounded quantifiers; numeric clamp to slider min/max; default-on-parse-failure; no `eval`/dynamic code (semgrep gate) |
| Privacy leak via a new dep phoning home | Information Disclosure | Phase 4 adds ZERO deps (locked); `check:supply-chain` + fetch guard re-verified in plan gates |
| Estate-row data into an error message / console | Information Disclosure | Region `ErrorBoundary` reads only `error.message`/`error.name` (shipped idiom); Biome `noConsole` error in non-test |
| XSS via suffixed cluster name / vCenter label rendered in pill/panel | Tampering | React text children auto-escape (shipped P3 idiom); no raw-HTML sink for merged labels |
| DoS: merging many large snapshots in the single memo | DoS | Pure JS merge is tens of ms for ~10k VMs (02-02 benchmark); memo keyed on stable Set identities; Critical-5 snapshot-retention policy (Phase 6 concern, noted) |

## Sources

### Primary (HIGH confidence)

- Direct inspection of `~/Library/CloudStorage/OneDrive-Home/20260430_1400_allvCenters.xlsx` via project SheetJS (sheets, headers, vCenter UUIDs, fault domains, HA fields, vMetaData, datastore Hosts/Cluster-name population, VM-UUID dedup) — 2026-05-16
- Shipped codebase: `src/types/{estate,snapshot,vinfo,vhost}.ts`, `src/engines/aggregation/{aggregateClusters,estateView}.ts`, `src/engines/parser/adapters/{rvtools,columnMap}.ts`, `src/engines/parser/captureDate.ts`, `src/hooks/useEstateView.ts`, `src/store/snapshotStore.ts`, `src/engines/units/*`
- Phase summaries: `01-04-SUMMARY.md` (parser/identity carry + A7 RVTools-version gap), `02-02-SUMMARY.md` (aggregation port + dormant stretched math + single-useMemo), `03-01/03-03-SUMMARY.md` (toggle idiom, bundle gates, grep gates)
- vsizer `src/engines/parser/resolveClusterCollisions.ts` (collision algorithm to port/generalize)
- PROJECT.md, REQUIREMENTS.md, ROADMAP.md (Phase-4 goal/requirements/success criteria/pitfalls)
- `.planning/research/{ARCHITECTURE,PITFALLS,FEATURES,SUMMARY}.md` (Critical-3/4, Moderate-10, allocation defaults, DR methodology, merge semantics)
- CLAUDE.md (binding conventions, gotchas, RTK)

### Secondary (MEDIUM confidence)

- WebSearch (verified against RVTools docs): RVTools 4.3.1 UUID-semantics change (`VM UUID` = vCenter-unique, was SMBIOS); RVTools 4.x multi-vCenter single-workbook export — corroborated by virtual-allan.com, jamesdelaney.co.uk, RVTools 4.4.1 documentation

### Tertiary (LOW confidence)

- None relied upon. All Phase-4 correctness claims trace to direct file inspection, shipped code, or HIGH-confidence sibling research.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new deps; everything is shipped P1–P3, version-pinned
- Architecture (merge/stretched/DR/allocation engine shapes): HIGH — sibling-derived + the dormant stretched math is already ported and tested for exactly this phase
- Real-data correctness (identity keys, fault domains, vMetaData, datastore attribution): HIGH — direct inspection of the actual multi-vCenter workbook, not assumed
- Pitfalls: HIGH — every pitfall is grounded in either the real file or shipped-code review
- Per-site reservation exact formula + DR caveat schema: MEDIUM — standard interpretation, but the capacity-basis and caveat-schema details are flagged as ADR decisions (Assumptions A4/A5, Open Questions 2/3)

**Research date:** 2026-05-16
**Valid until:** ~2026-06-15 (30 days — stable: RVTools schema + vsizer engines + locked dependency bar do not move; re-verify only if a new RVTools generation appears in fixtures)
