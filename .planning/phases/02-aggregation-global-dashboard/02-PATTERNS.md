# Phase 2: Aggregation & Global Dashboard - Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 38 new/modified (engines 10, hook 2, types 1, chart infra 3, dashboard UI 9, i18n 3, app 1, tests embedded + 1 integration)
**Analogs found:** 36 / 38 (2 net-new with no direct analog: `osFamily.ts`, `perDatastore.ts` — partial-match guidance given)

**Two analog sources:**

- **vatlas `src/`** (`/Users/fjacquet/Projects/rvtui/src/`) — PREFERRED for store/hook/component/i18n/type/test/script patterns. It already follows every project convention (branded units, `@/` alias, dark-pair classes, i18n namespace shape, inputs-only store).
- **vsizer `src/`** (`/Users/fjacquet/Projects/vsizer/src/`) — the PORT SOURCE for aggregation math only. Bare `number`; retrofit to branded units against vatlas Phase-1 row types.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engines/aggregation/ghz.ts` | engine | transform | vsizer `engines/aggregation/ghz.ts` + vatlas `engines/units/converters.ts` | exact (port + DRY-collapse) |
| `src/engines/aggregation/perCluster.ts` | engine | batch (group+reduce) | vsizer `engines/aggregation/perCluster.ts` | exact (port + brand retrofit) |
| `src/engines/aggregation/vinfoMerge.ts` | engine | batch (group+reduce) | vsizer `engines/aggregation/vinfoMerge.ts` | exact + 1 logic add (mode param) |
| `src/engines/aggregation/aggregateClusters.ts` | engine | transform (join) | vsizer `engines/aggregation/aggregateClusters.ts` | exact (port verbatim) |
| `src/engines/aggregation/globals.ts` | engine | batch (reduce) | vsizer `engines/aggregation/globals.ts` | exact (port + 2 sums) |
| `src/engines/aggregation/contention.ts` | engine (constants) | — | vsizer `engines/aggregation/contention.ts` | exact (port verbatim) |
| `src/engines/aggregation/osFamily.ts` | engine | transform (classify) | RESEARCH §Code Examples + vatlas `engines/units/converters.ts` (purity shape) | partial (new; pattern given) |
| `src/engines/aggregation/perDatastore.ts` | engine | batch (group/dedupe) | vsizer `perCluster.ts` `groupByCluster` shape | partial (new; pattern given) |
| `src/engines/aggregation/perEsx.ts` | engine | batch (group+reduce) | vsizer `perCluster.ts` + `vinfoMerge.ts` `readinessStats` | role-match (new; compose existing) |
| `src/engines/aggregation/estateView.ts` | engine | transform (assembler) | vsizer `engines/aggregation/index.ts` (barrel) + own composition | role-match (new assembler) |
| `src/engines/aggregation/index.ts` | engine (barrel) | — | vsizer `engines/aggregation/index.ts` | exact |
| `src/types/estate.ts` | type | — | vsizer `types/cluster.ts` + `types/global.ts`; vatlas `types/vhost.ts` (brand-import header) | exact (port types + brand retrofit) |
| `src/hooks/useEstateView.ts` | hook | request-response | vatlas `components/SnapshotListSidebar.tsx` (the `useMemo`-off-store idiom) + RESEARCH Pattern 3 | exact (idiom shipped) |
| `src/hooks/useEstateView.test.ts` | test | — | vatlas `store/snapshotStore.test.ts` + `__tests__/e2e-smoke.test.tsx` (`renderHook`/store-seed) | role-match |
| `src/components/Chart.tsx` | chart (component) | — | RESEARCH Pattern 2 (no vatlas analog yet) + vatlas `components/FallbackError.tsx` (memo/component shape) | partial (new infra) |
| `src/theme/echartsTheme.ts` | chart (config) | — | vatlas `src/index.css` `@theme` tokens (the token source of truth) | role-match (token map) |
| `scripts/check-bundle-size.mjs` | script (CI gate) | — | vatlas `scripts/check-supply-chain.mjs` | exact (same probe shape) |
| `src/components/dashboard/GlobalDashboard.tsx` | component | request-response | vatlas `App.tsx` (state-branch layout) + `SnapshotListSidebar.tsx` | exact (idiom shipped) |
| `src/components/dashboard/GlobalSummaryCard.tsx` | component | request-response | vatlas `components/SnapshotCard.tsx` (`.panel` stat block + i18n) | exact |
| `src/components/dashboard/PerClusterColumns.tsx` | component | request-response | vatlas `SnapshotListSidebar.tsx` (list→card map) | exact |
| `src/components/dashboard/ClusterColumn.tsx` | component | request-response | vatlas `components/SnapshotCard.tsx` | exact |
| `src/components/dashboard/OsBreakdownDonut.tsx` | component (chart host) | request-response | new `Chart.tsx` consumer; vatlas `SnapshotCard.tsx` (panel wrapper) | role-match |
| `src/components/dashboard/CpuReadyPanel.tsx` | component | request-response | vatlas `SnapshotCard.tsx` (panel + conditional render) | exact |
| `src/components/dashboard/AccountingModeToggle.tsx` | component | event-driven | vatlas `components/ThemeToggle.tsx` (segmented `aria-pressed`) | exact |
| `src/components/dashboard/UtilizationGauge.tsx` | component (chart host) | request-response | new `Chart.tsx` consumer | role-match |
| `src/i18n/locales/en/dashboard.json` | i18n | — | vatlas `i18n/locales/en/common.json` | exact |
| `src/i18n/locales/fr/dashboard.json` | i18n | — | vatlas `i18n/locales/fr/common.json` | exact |
| `src/i18n/index.ts` (MODIFY) | i18n (registry) | — | vatlas `i18n/index.ts` (self — extend namespace list) | exact |
| `src/App.tsx` (MODIFY) | component (wiring) | — | vatlas `App.tsx` (self — swap `<main>` placeholder) | exact |
| `src/__tests__/dashboard-smoke.test.tsx` | test | — | vatlas `__tests__/e2e-smoke.test.tsx` | exact |
| `package.json` (MODIFY) | infra (manifest) | — | self (add echarts deps + `check:bundle-size` script) | exact |
| engine `*.test.ts` (×8) | test | — | vsizer `engines/aggregation/*.test.ts` + vatlas `engines/units/converters.test.ts` | exact (port + brand fixtures) |

---

## Pattern Assignments

### `src/engines/aggregation/ghz.ts` (engine, transform) — PORT + DRY-COLLAPSE

**Analog:** vsizer `/Users/fjacquet/Projects/vsizer/src/engines/aggregation/ghz.ts` (lines 11-24) + vatlas `src/engines/units/converters.ts` line 23.

**The DRY trap (Pitfall 7 — DO THIS):** vsizer `ghz.ts:11` declares its own `mhzToGhz`. vatlas already owns it at `src/engines/units/converters.ts:23` (`mhzToGhz = (n: MHz): GHz => ghz(n / MHZ_PER_GHZ)`). **Do NOT port vsizer's `mhzToGhz`** — import from `@/engines/units`. Keep ONLY the composite helpers.

**Brand-retrofit (the one worked example — apply this mechanically everywhere):**

vsizer source (bare number):

```typescript
export const physicalGhz = (speedMhz: number, cores: number): number => (speedMhz * cores) / 1000
export const consumedGhz = (speedMhz: number, cores: number, cpuRatio: number): number =>
  physicalGhz(speedMhz, cores) * cpuRatio
```

vatlas retrofit (signature carries brands, unwrap once internally, re-brand the output via the `units` constructor — RESEARCH port-map row `ghz.ts`):

```typescript
import { type Cores, type GHz, ghz, type MHz } from '@/engines/units'

/** Total physical GHz a host advertises: nominal speed × physical cores. */
export const physicalGhz = (speedMhz: MHz, cores: Cores): GHz =>
  ghz(((speedMhz as number) * (cores as number)) / 1000)

/** GHz consumed: physical capacity scaled by 0..1 mean CPU utilization. */
export const consumedGhz = (speedMhz: MHz, cores: Cores, cpuRatio: number): GHz =>
  ghz((physicalGhz(speedMhz, cores) as number) * cpuRatio)
```

**Rule of the retrofit:** brand on the boundary (params + return), `x as number` for arithmetic, re-wrap with `mib()`/`ghz()`/`cores()` on the way out. `cpuRatio`/`ramRatio` stay bare `number` (they are 0..1 floats — `VHostRow.cpuRatio` line 25 is unbranded by design).

**Test analog:** vsizer `ghz.test.ts` (lines 11-32) — port and add the `62.4 GHz` canary in the vatlas style from `src/engines/units/converters.test.ts:42-50` (`2 sockets * 12 cores * mhzToGhz(mhz(2600)) === 62.4` — wrap inputs with `mhz()`/`cores()`).

---

### `src/engines/aggregation/perCluster.ts` (engine, batch) — PORT + MECHANICAL RETROFIT

**Analog:** vsizer `perCluster.ts` (read in full — `groupByCluster` lines 41-50, `sum`/`mean` 52-53, `aggregateHostsPerCluster` 63-102).

**Port verbatim:** `groupByCluster` (drop empty-cluster rows), `sum`/`mean` helpers, the capacity-weighted ratio logic (ADR-0011, lines 82-83), the `physicalRamMb === 0 ? mean(rams) : consumedRamMb / physicalRamMb` fallback.

**Required deviations:**

1. `h.memoryMb` → `h.memoryMib` (vatlas `VHostRow` line 23 renamed it; `perCluster.ts:71,76` is the only field-name change).
2. `physicalGhzOf`/`consumedGhzOf` now return `GHz` brands — unwrap with `as number` inside `sum(...)` calls (lines 69-70).
3. `Math.max(...cpus)`/`Math.min(...cpus)` (lines 94-95) on `cpuRatio`/`ramRatio` arrays are bare-number — keep as-is (these are small per-cluster host arrays, not VM-scale; the V8 spread-limit concern is VM-only).
4. `ClusterHostStats` interface (lines 12-39) moves to `src/types/estate.ts` with `MiB`/`GHz` brands on `physicalGhz`/`consumedGhz`/`availableGhz`/`physicalRamMb`/`consumedRamMb` fields.

---

### `src/engines/aggregation/vinfoMerge.ts` (engine, batch) — PORT + ACCOUNTING-MODE PARAM (Critical-6)

**Analog:** vsizer `vinfoMerge.ts` (read in full).

**Port verbatim:** `readinessStats` (lines 80-105 — the reduce-not-spread max loop is the V8-65535-limit fix, ADR-0012; keep the `v != null && Number.isFinite(v)` narrowing exactly), `topReadinessVmsByCluster` (143-171), the `sumActiveMem` shape.

**The one genuine logic change (Critical-6) — `groupByCluster` lines 44-54:**

vsizer (unconditional powered-off filter):

```typescript
const groupByCluster = (rows: VInfoRow[]): Map<string, VInfoRow[]> => {
  for (const row of rows) {
    if (!row.poweredOn) continue   // ← unconditional
```

vatlas (mode-driven, RESEARCH §Three Accounting Modes):

```typescript
import type { AccountingMode } from '@/types/estate'
const groupByCluster = (rows: VInfoRow[], mode: AccountingMode): Map<string, VInfoRow[]> => {
  for (const row of rows) {
    if (mode !== 'configured' && !row.poweredOn) continue   // Configured = all VMs
```

Thread `mode` through `aggregateVmsPerCluster(vinfo, mode)`. **`readinessStats` is ALWAYS powered-on-only regardless of mode** (a powered-off VM has no CPU Ready — RESEARCH is explicit; do NOT make readiness mode-conditional).

**Required deviations:**

- vsizer `ClusterVmStats` has `vramAllocatedMb` + `activeMemMb`; vatlas `VInfoRow` (line 23) has `vramMib: MiB` and NO `activeMemMb` field. Rename `vramAllocatedMb` → `vramAllocatedMib: MiB`; **drop `activeMemMb`/`sumActiveMem`** (vatlas Phase-1 `VInfoRow` does not parse active memory — confirm against `src/types/vinfo.ts`; it is absent, so the `activeMemMb` chain is dead code here).
- `v.vcpu`/`v.vramMib` are branded — `reduce` accumulators unwrap (`acc + (v.vcpu as number)`), re-brand the sum (`cores(...)`, `mib(...)`).

---

### `src/engines/aggregation/aggregateClusters.ts` (engine, transform/join) — PORT VERBATIM

**Analog:** vsizer `aggregateClusters.ts` (read in full — lines 30-112).

**Port verbatim incl. dormant stretched math:** the `stretchedClusters?: ReadonlySet<string>` param (line 37), the `0.5 × physicalGhz` DR reservation, `cpuDrFactor`/`ramDrFactor`, `usablePhysicalCores`, `vcpuPerPcpu = vcpuAllocated / usablePhysicalCores`, `computeMhzPerVcpu`, the `.sort((a,b) => a.cluster.localeCompare(b.cluster))` stable-order tail.

**Phase-2 deviations:**

1. Callers pass `stretchedClusters = new Set()` (RESEARCH Deferred Ideas — math present but dormant; do NOT delete it).
2. `vmStatsByCluster` build (line 41) must thread the accounting `mode` into `aggregateVmsPerCluster(vinfo, mode)`.
3. Drop `activeMemMb` references (lines 80, 97) — see `vinfoMerge.ts` deviation (vatlas `VInfoRow` lacks it).
4. `ClusterAggregate` import (line 1) resolves to `src/types/estate.ts` (not vsizer `../../types`); brand the GHz/MiB fields there.

---

### `src/engines/aggregation/globals.ts` (engine, batch) — PORT VERBATIM + 2 SUMS

**Analog:** vsizer `globals.ts` (read in full — `emptySummary` 5-28, `aggregateGlobals` 50-121).

**Port verbatim:** every sum, the capacity-weighted DR-aware `meanCpuRatio`/`meanRamRatio` (lines 90-93), the `reportingReadiness` null-not-zero contract (lines 80-84), the `emptySummary` frozen-constant pattern (this is also the `EMPTY_VIEW` model RESEARCH Pattern 3 wants for `useEstateView`).

**Phase-2 deviations (DSH-02):**

- Add `datastoreCount: number` + `totalStorageMib: MiB` to `GlobalSummary` and to `emptySummary` (`0`/`mib(0)`), sourced from `perDatastore` output. RESEARCH port-map row `globals.ts`.
- Drop `activeMemMb` (lines 23, 70-74) — vatlas `VInfoRow` lacks the source field.

---

### `src/engines/aggregation/contention.ts` (engine constants) — PORT VERBATIM

**Analog:** vsizer `contention.ts` (lines 27-42). Copy `CONTENTION_THRESHOLDS = { warning: 5, serious: 10 } as const` and `TOP_N_DEFAULT = 10` verbatim. Zero retrofit. Drop the PPTX-specific doc lines from the comment (no PPTX in Phase 2; ADR-0003 status-not-verdict note stays).

---

### `src/engines/aggregation/osFamily.ts` (engine, classify) — NEW (no analog; pattern below)

**Pattern source:** RESEARCH §Code Examples (verbatim-ready) + purity shape of vatlas `src/engines/units/converters.ts:15` ("Pure functions. No I/O. No mutation. No exceptions.").

```typescript
// src/engines/aggregation/osFamily.ts — pure, no deps, Zod-free
export type OsFamily = 'windows' | 'linux' | 'other'

export function classifyOsFamily(osConfig: string, osTools: string): OsFamily {
  const s = (osConfig || osTools).toLowerCase()
  if (/windows|microsoft/.test(s)) return 'windows'
  if (/linux|rhel|red hat|centos|ubuntu|debian|suse|sles|oracle|rocky|alma|photon|coreos/.test(s)) return 'linux'
  return 'other'
}
```

Inputs are `VInfoRow.osConfig`/`osTools` (vatlas `src/types/vinfo.ts:29,31` — both plain `string`, no brand). `other` is a real visible bucket — never drop it (UI-SPEC donut "Other/unknown is a real, visible bucket"). NOT the Phase-5 EOS normalizer — 3-way only.

---

### `src/engines/aggregation/perDatastore.ts` (engine, group/dedupe) — NEW (Moderate-11)

**Pattern source:** vsizer `perCluster.ts:41-50` `groupByCluster` Map-accumulate idiom (reuse the *shape*, key on `naa ?? name`).

**Inputs:** vatlas `VDatastoreRow` (`src/types/snapshot.ts:36-45`): `name`, `capacityMib: MiB`, `freeMib: MiB`, `provisionedMib: MiB`, `naa: string | null`, `type: string`.

**`DatastoreAggregate` shape** → into `src/types/estate.ts` (RESEARCH §perDatastore gives the full interface). Critical rule: group by `naa ?? name`; within a group take `capacityMib`/`freeMib` from the **first** row (shared LUN has identical capacity per cluster view — NEVER sum capacity, Pitfall 5); `usedMib = capacity - free`; surface `sharedDuplicateCount` (group size). Brand arithmetic: unwrap → compute → `mib(...)`. The Moderate-11 `provisioned ≤ capacity × 10` sanity check is a `// TODO(diagnostics, Phase 3+)` only — do NOT build a panel (YAGNI).

---

### `src/engines/aggregation/perEsx.ts` (engine, batch) — NEW (compose existing, DRY)

**Pattern source:** vsizer `perCluster.ts` (host grouping) + `vinfoMerge.ts:80-105` `readinessStats`.

**DRY mandate (RESEARCH §perEsx):** `perEsx` must call the SAME `readinessStats` helper `vinfoMerge` uses — **export `readinessStats` from `vinfoMerge.ts`** (or a shared spot) and import it; do NOT copy-paste the reduce loop. Group `VHostRow` by `hostName`, attach VMs via `VInfoRow.host === hostName` (vatlas `src/types/vinfo.ts:17` — `host` is populated Phase-1). `vmCount`/`vcpuAllocated` honor the same `mode` param. `EsxAggregate` shape (branded `Sockets`/`Cores`/`MHz`/`GHz`/`MiB`) → `src/types/estate.ts` (RESEARCH §perEsx gives the interface). `cores` is physical cores — `VHostRow` structurally has no threads field (Moderate-4 prevented by the type system).

---

### `src/engines/aggregation/estateView.ts` (engine, assembler) — NEW

**Pattern source:** vsizer `engines/aggregation/index.ts` composition + the `emptySummary` frozen-constant idiom from vsizer `globals.ts:5-28`.

Pure function `buildEstateView(snapshot: Snapshot, mode: AccountingMode): EstateView` that calls `aggregateClusters({ vinfo, vhost, stretchedClusters: new Set() })`, `aggregateGlobals(...)`, `aggregateHostsPerCluster`, `perDatastore`, `perEsx`, `classifyOsFamily` (per VM, reduce to global + per-cluster `osBreakdown`). Export a frozen `EMPTY_VIEW` constant (modeled on vsizer `globals.ts` `emptySummary`) that `useEstateView` returns when `snapshot === null`. No React, no Zustand, no Zod. Returns `EstateView` with `trends: null` (Phase-4 forward-compat — RESEARCH Pattern 3).

---

### `src/engines/aggregation/index.ts` (barrel) — PORT SHAPE

**Analog:** vsizer `engines/aggregation/index.ts` (5-line re-export barrel). Re-export the public surface — primarily `buildEstateView` + `EMPTY_VIEW` + `classifyOsFamily` + the const tables. `useEstateView` imports from `@/engines/aggregation` (RESEARCH Pattern 3 `import { buildEstateView } from '@/engines/aggregation'`).

---

### `src/types/estate.ts` (type) — PORT TYPES + BRAND RETROFIT

**Analog:** vsizer `types/cluster.ts` (`ClusterAggregate`, full read) + `types/global.ts` (`GlobalSummary`, full read) + the brand-import header idiom of vatlas `src/types/vhost.ts:1` (`import type { Cores, MHz, MiB, Sockets } from '@/engines/units'`).

**Port the vsizer interfaces, then:**

- Brand the unit fields: `physicalGhz`/`consumedGhz`/`availableGhz`/`drReservedGhz` → `GHz`; `physicalRamMb`→`physicalRamMib: MiB` (rename + brand); `vramAllocatedMb`→`vramAllocatedMib: MiB`; `physicalCores`/`usablePhysicalCores`/`vcpuAllocated` → `Cores`.
- **Drop `activeMemMb`** from both interfaces (vatlas `VInfoRow` does not parse it — confirmed `src/types/vinfo.ts` has no such field).
- Add `AccountingMode = 'configured' | 'active' | 'storage-realistic'` union.
- Add `OsFamily` (or re-export from `osFamily.ts`), `DatastoreAggregate`, `EsxAggregate` (shapes in RESEARCH §perDatastore/§perEsx), `EstateView { globals; clusters[]; hosts[]; datastores[]; vmsByCluster; osBreakdown; accountingMode; trends: TimelinePoint[] | null }`.
- Add `datastoreCount: number` + `totalStorageMib: MiB` to `GlobalSummary`.
- Header doc-comment style: copy the vatlas `src/types/vhost.ts:3-12` JSDoc tone (explains the vsizer→vatlas rename rationale).

Re-export from `src/types/index.ts` (extend the existing `export type {...}` block, vatlas `src/types/index.ts:1-9` pattern).

---

### `src/hooks/useEstateView.ts` (hook, request-response) — IDIOM ALREADY SHIPPED

**Analog:** vatlas `src/components/SnapshotListSidebar.tsx:25-28` is the shipped `useMemo`-derived-off-store idiom; the store selector to reuse is `selectActiveSnapshot` (`src/store/snapshotStore.ts:89-90`, returns referentially-stable `Snapshot | null`). RESEARCH Pattern 3 gives the exact target.

```typescript
import { useMemo } from 'react'
import { selectActiveSnapshot, useSnapshotStore } from '@/store/snapshotStore'
import { buildEstateView, EMPTY_VIEW } from '@/engines/aggregation'
import type { AccountingMode, EstateView } from '@/types/estate'

export function useEstateView(mode: AccountingMode): EstateView {
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  return useMemo(
    () => (snapshot ? buildEstateView(snapshot, mode) : EMPTY_VIEW),
    [snapshot, mode],
  )
}
```

**Why it works (shipped contracts):** `selectActiveSnapshot` already exists and returns a stable ref; snapshots are replaced-not-mutated in the store (`snapshotStore.ts:39-43`). This is the ONLY `useMemo` site project-wide (RESEARCH Locked Decisions; reaffirmed `01-05-SUMMARY`). Dashboard components must NOT call engines or `useMemo` — they consume this hook's output as plain props.

---

### `src/hooks/useEstateView.test.ts` (test)

**Analog:** vatlas `src/store/snapshotStore.test.ts` (store-seed-then-assert) + `__tests__/e2e-smoke.test.tsx:99-122` (`useSnapshotStore.getState().addSnapshot(...)` direct seed). Use `@testing-library/react` `renderHook` (installed, RESEARCH Standard Stack). Seed the store, render the hook, assert memo identity is stable across re-render with same `(snapshot, mode)` and changes when `mode` flips.

---

### `src/components/Chart.tsx` (chart infra) — NEW (RESEARCH Pattern 2 is the spec)

**Analog:** No vatlas chart exists yet. RESEARCH Pattern 1 + Pattern 2 give the full target verbatim. Component-shape conventions from vatlas `src/components/FallbackError.tsx` (named export, typed props interface, no default export).

**Tree-shaken registry (module scope, once — Pattern 1):** `import * as echarts from 'echarts/core'`, `import { BarChart, PieChart, GaugeChart } from 'echarts/charts'`, components from `echarts/components`, `SVGRenderer` from `echarts/renderers`, `echarts.use([...])`, `echarts.registerTheme('midnight-executive', THEME)`. **FORBIDDEN:** `import * as echarts from 'echarts'`; importing `CanvasRenderer` (RESEARCH Anti-Patterns; Pitfall 3).

**Wrapper (Pattern 2):** wrap `echarts-for-react/lib/core` `ReactEChartsCore`, single `option: EChartsCoreOption` prop, inject `opts={{ renderer: 'svg' }}` + `theme="midnight-executive"` centrally, `React.memo` with the reference-equality comparator (`a.option === b.option && ...`). Import path is `echarts-for-react/lib/core` (NOT default — tree-shaking). Named export `Chart`.

**Deps:** add `echarts@^6.0.0` + `echarts-for-react@^3.0.6` to `package.json` then `npm install` (RESEARCH Environment — manifest-then-install is the Phase-1-proven non-bypass path; the supply-chain gate only pins `xlsx`, so these install clean).

---

### `src/theme/echartsTheme.ts` (chart config) — TOKEN MAP

**Analog:** vatlas `src/index.css:9-44` `@theme` block is the source of truth (Midnight Executive). Phase 2 adds NO new tokens (UI-SPEC §Design System) — it maps existing CSS vars to an ECharts theme object.

Map per UI-SPEC §Color "Chart series → token mapping" table: OS donut Windows=`--color-primary-500` (dark `-300`), Linux=`--color-primary-300` (dark `-200`), Other=`--color-surface-200` (dark `-700`); gauge bands `--color-util-low/mid/high` at 0–60/60–80/80–100; vCPU-alloc gauge single `--color-primary-500` (NO banding — it's a ratio not a verdict, Moderate-4); axis/grid `slate-500`/`slate-200` (dark `slate-400`/`surface-700`). Export BOTH a light and a dark variant resolved from the same tokens (UI-SPEC: "the theme module MUST expose a dark variant"). The oklch values are in `index.css` lines 16-40 — resolve to the concrete colors there.

---

### `scripts/check-bundle-size.mjs` (CI gate) — SAME PROBE SHAPE

**Analog:** vatlas `scripts/check-supply-chain.mjs` (full read) — copy its shape exactly: bare-Node, no deps, `readFileSync`, clear `console.error` + `process.exit(1)` on violation, `console.log('check-bundle-size: OK')` on pass.

**Logic (Pitfall 4):** post-`vite build`, glob `dist/assets/*.js`, find the chunk containing echarts, `gzipSync` it (`node:zlib`), fail if `> 307200` bytes (300 KB gz — ROADMAP success #5 authoritative). Wire as a `check:bundle-size` npm script alongside the existing `check:supply-chain`/`prebuild` (`package.json:scripts`, vatlas pattern). Keep the Phase-1 700 KB raw Vite chunk warning untouched (orthogonal metric).

---

### `src/components/dashboard/GlobalDashboard.tsx` (component) — STATE-BRANCH LAYOUT

**Analog:** vatlas `src/App.tsx:27-41` (the `hasSnapshots ?` branch + sidebar/main split) and `SnapshotListSidebar.tsx` (`useTranslation` + store reads).

Owns the accounting-mode `useState` (default `'active'` — UI-SPEC §Accounting-Mode Toggle "Default state: Active"; A3 allows lifted `useState`). Calls `useEstateView(mode)`. Renders empty/loading/error states that replace ONLY the dashboard region (sidebar/header stay — UI-SPEC §Copywriting "State scope"). Layout per UI-SPEC §Layout Contract: `gap-6` region rhythm, toolbar → `GlobalSummaryCard` → `OsBreakdownDonut` → `PerClusterColumns` (horizontal scroll) → `CpuReadyPanel`. Error renders `error.message` ONLY, never the error object (Critical-2, mirrors `FallbackError.tsx`).

---

### `src/components/dashboard/GlobalSummaryCard.tsx` (component) — `.panel` STAT BLOCK

**Analog:** vatlas `src/components/SnapshotCard.tsx` (`.panel` class + `useTranslation` + dark-pair color utilities + i18n count interpolation `t('snapshots.card.rows', {...})` at lines 53-58).

DSH-02 stat tiles (clusters/ESX/VMs/datastores/vCPU/vRAM/storage) from `useEstateView().globals`. Numbers via ported `format.ts` (see Shared Patterns). Labels are `dashboard`-namespace i18n keys, numbers are `{{placeholders}}` (UI-SPEC §Copywriting — no pre-formatted numbers in strings). Numeric values: `font-mono tabular-nums` (UI-SPEC §Typography Numeric row). `.label` weight override to `font-semibold` (UI-SPEC §Typography note — the shipped `.label` is `font-medium`/500; Phase 2 MUST add `font-semibold` at usage sites to avoid a 3rd weight).

---

### `src/components/dashboard/PerClusterColumns.tsx` + `ClusterColumn.tsx` — LIST→CARD MAP

**Analog:** vatlas `SnapshotListSidebar.tsx:39-50` (`.map` over sorted entries → child card) and `SnapshotCard.tsx` (each `.panel` card). DSH-01/03. Horizontal-scroll flex row, each `ClusterColumn` a `min-w-[200px]` `.panel` (UI-SPEC §Layout — do NOT reflow to vertical list). Labels left / values right-aligned `font-mono tabular-nums` so metrics align across columns. Per-cluster datastore count: render em-dash `—` if not derivable (A1 — RESEARCH Open Question 1; planner confirms against the MOM-vCenter fixture during planning). Consumes `useEstateView().clusters[]` + `osBreakdown` — NOT engines directly.

---

### `src/components/dashboard/OsBreakdownDonut.tsx` / `UtilizationGauge.tsx` (chart hosts)

**Analog:** consumers of the new `Chart.tsx`; panel wrapper from `SnapshotCard.tsx`. Build the ECharts `option` object (pie for donut, gauge for utilization) and pass to `<Chart option={...} />`. The `option` must be a stable reference (built in a small pure selector off `useEstateView` output — NOT inline in JSX, NOT in a component `useMemo`; RESEARCH Anti-Patterns + Pattern 2 memo rationale). Donut: Windows/Linux/Other series, "Other" always visible. Gauge bands per `echartsTheme.ts`. `height: 320` donut (Chart default), ≤96px gauges (UI-SPEC §Layout).

---

### `src/components/dashboard/CpuReadyPanel.tsx` (component) — CONDITIONAL RENDER

**Analog:** vatlas `SnapshotCard.tsx` (`.panel` + conditional rendering idiom, e.g. `SnapshotListSidebar.tsx:36` `sorted.length === 0 ?`).

DSH-05. **Critical (Pitfall 6 / ADR-0012):** branch on `readinessAvailable` — render localized `"not reported"` (12px micro) when `false`, NEVER `0 %`, NEVER green, NEVER hide the row. `count > 5%` is the ONE accent-gold figure (UI-SPEC §Color closed list). Mean/max via ported `fmtPercentValue` (2 decimals — UI-SPEC §Number Formatting). No verdict words (ADR-0003 — "good/bad/healthy/warning/critical" denylisted).

---

### `src/components/dashboard/AccountingModeToggle.tsx` (component, event-driven) — SEGMENTED `aria-pressed`

**Analog:** vatlas `src/components/ThemeToggle.tsx` (full read — the EXACT pattern to reuse, UI-SPEC §Accounting-Mode Toggle "Reuses the `aria-pressed` segmented pattern already shipped in Phase-1 `ThemeToggle.tsx`").

Copy the `<fieldset aria-label> + <legend className="sr-only"> + PREFERENCES.map(button aria-pressed)` structure (`ThemeToggle.tsx:80-106`). 3 options `'configured'|'active'|'storage-realistic'`, i18n-keyed in `dashboard` namespace. Active segment: `bg-primary-600 text-white` filled + `aria-pressed="true"`, focus ring `ring-2 ring-primary-500` (UI-SPEC §Accounting-Mode Toggle — exactly one active treatment, do NOT also gold-underline). Keyboard: Tab + Arrow + Space/Enter (mirror `ThemeToggle`). `role="group"`. Lifts state to `GlobalDashboard` (controlled component — `value`/`onChange` props, unlike `ThemeToggle` which owns its hook).

---

### `src/i18n/locales/{en,fr}/dashboard.json` (i18n) + `src/i18n/index.ts` (MODIFY)

**Analog:** vatlas `src/i18n/locales/en/common.json` + `fr/common.json` (nested-object key shape) and `src/i18n/index.ts:5-34` (import → `resources` → `NAMESPACES` registration).

New `dashboard` namespace, ~30 keys from UI-SPEC §Copywriting Contract table (section titles, stat labels, toggle labels, empty/loading/error, "not reported", capture-date, mode echo) — both EN and FR. **Modify `src/i18n/index.ts`:** add `enDashboard`/`frDashboard` imports, add to `resources.{en,fr}`, append `'dashboard'` to `NAMESPACES` (line 22). FR↔EN key parity required (UI-SPEC — CI key-diff gate applies). Numbers are `{{placeholders}}`, never pre-formatted.

---

### `src/App.tsx` (MODIFY) — SWAP THE PLACEHOLDER

**Analog:** self — `src/App.tsx:30-35` is the `<main>` placeholder ("Snapshots loaded. Dashboard arrives in Phase 2."). Replace its body with `<GlobalDashboard />`. Keep the `hasSnapshots ?` branch, sidebar, header, `ErrorBoundary`, `Toaster` exactly (App.tsx:18-45 structure unchanged otherwise). The hero/no-snapshot branch is untouched.

---

### `src/__tests__/dashboard-smoke.test.tsx` (integration test)

**Analog:** vatlas `src/__tests__/e2e-smoke.test.tsx` (full read — the `vi.mock('@/engines/parser', ...)` synchronous-pipeline pattern, store-seed via `useSnapshotStore.getState()`, `render(<App />)` + fixture drop).

Extend the same pattern to `parseSnapshot → buildEstateView → render <GlobalDashboard>`. Use the canary fixture (`src/__fixtures__/rvtools-mib-canary.xlsx`) for the math assertions and the realistic `tests/fixtures/RVTools_export_all_2026-04-17_...MOM-vCenter.xlsx` (249 VM / 84 ESX / 102 ds) for the render assertion (RESEARCH Environment). Assert: per-cluster columns present, three accounting modes produce distinct totals (Critical-6, ROADMAP success #2/#6), SVG renderer wired (Pitfall 3 — opts-level or DOM `<svg>` assertion; planner picks per RESEARCH Open Question 2).

---

### engine `*.test.ts` (×8: ghz, perCluster, vinfoMerge, aggregateClusters, globals, contention, osFamily, perDatastore, perEsx, estateView)

**Analog:** vsizer `engines/aggregation/*.test.ts` (port the regression suites — they encode Moderate-4/5, capacity-weighted-ratio, ADR-0011/0012 cases) + vatlas `src/engines/units/converters.test.ts` (the branded-fixture style: `mib(...)`, `mhz(...)`, `cores(...)` wrappers; the `62.4 GHz` ROADMAP canary at lines 42-50).

**Port deviations:** wrap all numeric fixtures in brand constructors; adjust field names (`memoryMb`→`memoryMib`, `vramMb`→`vramMib`); add the 3-required ROADMAP tests — (a) `vcpuPerPcpu` uses `cores` not threads (structurally guaranteed but assert it), (b) `62.4 GHz` `physicalGhz` composition, (c) three-modes-distinct-totals on a ~50/50 poweredOn fixture. ≥75% coverage gate on `engines/aggregation/**` (Phase-1 parser hit 93.5%; enforced in `vitest.config.ts` coverage include).

---

## Shared Patterns

### The Brand Retrofit (apply to EVERY ported engine — the one worked example is `ghz.ts` above)

**Source:** vatlas `src/engines/units/{types,converters}.ts`; worked example in this doc's `ghz.ts` section.
**Apply to:** `ghz.ts`, `perCluster.ts`, `vinfoMerge.ts`, `aggregateClusters.ts`, `globals.ts`, `perDatastore.ts`, `perEsx.ts`, `estateView.ts`, `src/types/estate.ts`.

- Brand on the boundary (function params + return type, interface fields).
- `x as number` to unwrap for arithmetic; never invent a conversion factor (ADR-0010 — RVTools "MB" IS MiB, no `* 1.048576`).
- Re-wrap output with the `units` constructor the return type demands: `mib()`, `ghz()`, `cores()`, `sockets()`, `mhz()`.
- `cpuRatio`/`ramRatio` are bare `number` (0..1) by design — do NOT brand them (`VHostRow.cpuRatio` line 25).
- Engines stay **Zod-free** — branded types are the contract; validation already happened at the parser boundary (RESEARCH Security V5; 01-RESEARCH A8).

### Locale-aware Formatting (port vsizer `utils/format.ts` verbatim)

**Source:** `/Users/fjacquet/Projects/vsizer/src/utils/format.ts` (full read — `fmtInt`, `fmtGhzValue`, `fmtPercentValue`, `fmtRatio`, `fmtMemMb`, all em-dash-on-non-finite).
**Apply to:** every dashboard component rendering a number.

- Port to `src/utils/format.ts` (vatlas has no `src/utils/` yet — create it; or `src/engines/format/` per ARCHITECTURE.md §3 — KISS, planner picks one and is consistent).
- Functions take bare `number` — **unwrap the brand at the call site** (`fmtGhzValue(view.globals.physicalGhz as number)`). RESEARCH A4: zero-change port.
- Locale must come from the active i18next language (FND-03 / UI-SPEC §Number Formatting) — pass `i18n.language` not the vsizer hardcoded `'fr-FR'` default. The em-dash sentinel is mandatory for `null` CPU Ready and undeterminable datastore counts.
- `fmtMemMb` renders "GB/TB" — UI-SPEC mandates "GiB/TiB" suffixes (ADR-0010). Adjust the suffix strings only (the division math is already base-2-correct: `/1024/1024`); do NOT change the arithmetic.

### Dark-pair Color Classes (every Tailwind color utility needs its `dark:` twin)

**Source:** vatlas `src/components/SnapshotCard.tsx:18` doc ("a missing pair would render invisibly in one theme") + `index.css:71-96` `.panel`/`.label` definitions.
**Apply to:** all dashboard components.

- Every `bg-*`/`text-*`/`border-*`/`ring-*` carries a `dark:` counterpart. Reuse `.panel` (auto dark via `.dark .panel`).
- The `.label` utility is `font-medium` (500) — Phase 2 MUST add `font-semibold` (600) at dashboard label sites (UI-SPEC §Typography — only 2 weights allowed; inheriting 500 introduces a forbidden 3rd weight).

### i18n Component Idiom

**Source:** vatlas `SnapshotCard.tsx:1,20,53` / `ThemeToggle.tsx:1,76,81`.

- `const { t } = useTranslation('dashboard')`; keys nested-object style (match `common.json` shape); count/value interpolation `t('key', { vms, hosts })`; numbers formatted by `format.ts` BEFORE interpolation, never pre-formatted inside JSON.

### Privacy / Error Contract (Critical-2 — inherited from Phase 1)

**Source:** vatlas `src/components/FallbackError.tsx` + `src/App.tsx:18` `<ErrorBoundary FallbackComponent={FallbackError}>`.
**Apply to:** `GlobalDashboard.tsx` inline error state, any chart/render error path.

- Render `error.message` / `error.name` ONLY — never interpolate a `VInfoRow`/`Snapshot`/error object (would leak VM names/hostnames). The Phase-1 runtime fetch/XHR/WS guard + CSP cover the new echarts deps (render-only, no network) — no new ASVS surface.

---

## No Analog Found

| File | Role | Data Flow | Reason / Mitigation |
|------|------|-----------|---------------------|
| `src/engines/aggregation/osFamily.ts` | engine | classify | No existing classifier in vatlas. Mitigation: RESEARCH §Code Examples gives the verbatim-ready implementation; purity shape from `engines/units/converters.ts`. |
| `src/engines/aggregation/perDatastore.ts` | engine | group/dedupe | No NAA-dedupe engine exists (vsizer has none either — confirmed: vsizer aggregation dir has no perDatastore). Mitigation: reuse vsizer `perCluster.ts` `groupByCluster` Map-accumulate shape; full `DatastoreAggregate` interface in RESEARCH §perDatastore. |
| `src/components/Chart.tsx` | chart | — | First chart in vatlas — no prior ECharts wrapper. Mitigation: RESEARCH Pattern 1 + 2 are the verbatim spec; component-shape conventions from `FallbackError.tsx`. |

(Partial-match files have a documented pattern source above and are NOT blocked — the planner has a concrete target for each.)

---

## Metadata

**Analog search scope:** `/Users/fjacquet/Projects/rvtui/src/` (types, store, hooks, components, engines/units, i18n, index.css, App, **tests**, scripts) read for vatlas conventions; `/Users/fjacquet/Projects/vsizer/src/engines/aggregation/*` + `src/utils/format.ts` + `src/types/{cluster,global}.ts` read in full for the port.
**Files scanned:** 30 read in full (16 vatlas, 12 vsizer aggregation/types/format, RESEARCH, UI-SPEC).
**Key cross-cutting findings:**

1. The brand retrofit is mechanical (boundary-brand / unwrap-arith / rewrap-output) — `ghz.ts` is the one worked example to copy.
2. `useEstateView` and the segmented toggle are NOT new idioms — `SnapshotListSidebar.tsx` (useMemo-off-store) and `ThemeToggle.tsx` (aria-pressed segmented) are shipped templates to copy near-verbatim.
3. vatlas `VInfoRow` lacks `activeMemMb` — every vsizer `activeMemMb`/`sumActiveMem` reference is dead code in the port and must be dropped (consistent deviation across `vinfoMerge`/`aggregateClusters`/`globals`/`estate.ts`).
4. `check-supply-chain.mjs` is the exact template for the bundle-size CI gate (same bare-Node / exit-code / message shape).
5. Dashboard components consume `useEstateView` output as plain props — they never call engines or `useMemo` (the hook is the single sanctioned memo site).

**Pattern extraction date:** 2026-05-16
