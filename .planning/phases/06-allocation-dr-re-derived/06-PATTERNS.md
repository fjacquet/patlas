# Phase 6: Allocation & DR (re-derived) - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 13 (8 modified, 5 new)
**Analogs found:** 13 / 13 (every file evolves a shipped, real-file-validated analog — zero greenfield)

> This phase EVOLVES the shipped P4/P5 spine. Every "analog" below is the *current state of the file being reworked itself* (the strongest possible analog). The planner copies the exact change-points named here. Do NOT rewrite from zero — ROADMAP `vsizer reuse` + replan brief mandate keep-and-evolve.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engines/drSim/runScenario.ts` | engine | transform | itself (current shipped) | self / exact |
| `src/engines/drSim/allocate.ts` | engine | transform | itself (current shipped) | self / exact |
| `src/engines/drSim/index.ts` | engine (barrel) | — | itself | self / exact |
| `src/types/estate.ts` (`DrMode`/`DrSimResult`/`DrScenario`/`EstateView`) | model/types | — | itself | self / exact |
| `src/engines/aggregation/aggregateClusters.ts` | engine | transform | itself (ratio-bake point) | self / exact |
| `src/engines/aggregation/estateView.ts` | engine (assembler) | transform | itself (P5 added insights here) | self / exact |
| `src/components/ViewToggle.tsx` | component (nav) | event-driven | itself + P5 `hosts`-segment commit `123ecb2` | exact (precedent) |
| `src/components/dr/DrSimPanel.tsx` | component | request-response (presenter) | itself (current shipped) | self / exact |
| Planned-ratios control (NEW) | component | event-driven | `src/components/allocation/AllocationSliders.tsx` (preset group) | role+flow match |
| Planning view shell (NEW) | component (view branch) | event-driven | `GlobalDashboard.tsx` DR-block region + `App.tsx` view switch | role+flow match |
| Zustand planned-ratios slice (NEW, in `snapshotStore.ts`) | store | event-driven | `snapshotStore.ts` `stretchedClusters`/`scenario` slices | exact |
| `useEstateView.ts` + `buildEstateView` planned projection | hook + engine | transform | `useEstateView.ts` (P4/P5 added `ratios`/`scenario`/insights through it) | exact (precedent) |
| i18n: `dr.json` / `alloc.json` / `inventory.json` (EN+FR) | config | — | shipped `dr.json`/`alloc.json` EN/FR pair | exact |

---

## Pattern Assignments

### `src/engines/drSim/runScenario.ts` (engine, transform) — REWORK

**Analog:** itself, current shipped (`src/engines/drSim/runScenario.ts:1-120`).

**Current mode handling to REWORK** (lines 14-19) — `['host','cluster','vcenter']` → `['server','site']`:

```typescript
const isEmpty = (s: DrScenario): boolean =>
  s.failedHosts.size === 0 && s.failedClusters.size === 0 && s.failedVCenters.size === 0

/** Dominant mode for the UI echo: vCenter ▷ cluster ▷ host. */
const dominantMode = (s: DrScenario): DrMode =>
  s.failedVCenters.size > 0 ? 'vcenter' : s.failedClusters.size > 0 ? 'cluster' : 'host'
```

Lines 42-61 (`vcLostClusters`, `clusterFailed`, the vCenter/cluster survivor filters) are the **cluster-loss + vCenter-loss paths to STRIP**. Keep only the host-filter spine (`failedHosts`) and add the site-filter (site = fault-domain of declared-stretched clusters; reuse `h.faultDomain` already on `VHostRow`, same field `aggregateClusters.reservationFor` uses at `aggregateClusters.ts:71-75`).

**Survivor-aggregate spine to KEEP verbatim** (lines 63-92) — the "re-run shipped aggregation on survivor subset" pattern is the load-bearing reuse; do NOT touch the `aggregate()`/`aggregateGlobals` composition:

```typescript
const aggregate = (vinfo: typeof merged.vinfo, vhost: typeof merged.vhost) =>
  aggregateClusters({ vinfo, vhost, mode: opts.mode,
    stretchedClusters: opts.stretchedClusters, allocRatios: opts.allocRatios })
const beforeClusters = aggregate(merged.vinfo, merged.vhost)
const afterClusters = aggregate(survivorVinfo, survivorVhost)
const before = aggregateGlobals(beforeClusters)
const after = aggregateGlobals(afterClusters)
const perSurvivor = afterClusters.map((c) => ({ cluster: c.cluster, verdict: survivorVerdict(c) }))
```

**Impact-metric CHANGE-POINT** (lines 80-87, 114-115) — replace vCPU evacuee with **physical CPU (GHz/cores) + physical RAM removed**. Currently:

```typescript
const evacueeVcpu = Math.max(0, (before.vcpuAllocated as number) - (after.vcpuAllocated as number))
const evacueeVramMib = Math.max(0, (before.vramAllocatedMib as number) - (after.vramAllocatedMib as number))
// ...
evacueeVcpu: cores(evacueeVcpu),
evacueeVramMib: mib(evacueeVramMib),
```

New: derive from `before.physicalGhz/physicalCores/physicalRamMib − after.*` (the GlobalSummary already carries physical fields — confirm field names in `globals.ts`). Use branded `ghz()`/`cores()`/`mib()` from `@/engines/units` (`units/types.ts:16-23`) — never raw numbers (D-09 / branded-units invariant).

**Caveats KEEP, confidence REMOVE** (lines 94-118) — keep the `caveats: string[]` i18n-key-suffix pattern (lines 94-101) verbatim; **delete** the `confidence` block:

```typescript
// DELETE these lines (D-10):
const verdicts = perSurvivor.map((p) => p.verdict)
const confidence: DrSimResult['confidence'] = verdicts.includes('overflows')
  ? 'low' : verdicts.includes('tight') ? 'medium' : 'high'
// ...and `confidence,` from the return object (line 117).
```

**Custom-Failover wiring (D-11):** no new primitive — `opts.allocRatios` is *already* the injection point. Custom Failover = call `runScenario` with the planned ratios instead of measured ratios. The minimal-blast-radius change is in `buildEstateView` / `useEstateView` (which `allocRatios` it passes), NOT in `runScenario` itself.

---

### `src/engines/drSim/allocate.ts` (engine, transform) — REUSE, change feed only

**Analog:** itself (`src/engines/drSim/allocate.ts:1-48`).

`Verdict` / `band` / `worse` / `survivorVerdict` are reused **unchanged** (factual-by-design, denylist comment in-file lines 3-9 — already D-09-compliant). The **only** change point is *what capacity is fed in*. Current (lines 39-48):

```typescript
export const survivorVerdict = (
  c: Pick<ClusterAggregate, 'vcpuAllocated' | 'vramAllocatedMib' | 'capacityVcpu' | 'capacityRamMib'>,
): Verdict => {
  const cpu = band(c.vcpuAllocated as number, c.capacityVcpu as number)
  const ram = band(c.vramAllocatedMib as number, c.capacityRamMib as number)
  return worse(cpu, ram)
}
```

For the *physical* survivor verdict (D-09), feed physical capacity-vs-load. Note `capacityVcpu`/`capacityRamMib` are produced by `aggregateClusters.ts:248-249` as `usablePhysicalCores * cpuRatio` / `physicalRamMib * ramRatio` — i.e. the ratio is *already baked there*. Planner decides whether to add a physical-basis verdict variant or feed physical fields through this same signature. Do NOT re-derive the ratio here (the `aggregateClusters` DRY contract — comment lines 33-37).

---

### `src/engines/aggregation/aggregateClusters.ts` (engine, transform) — ratio-bake composition point

**Analog:** itself (`src/engines/aggregation/aggregateClusters.ts:1-269`).

**The exact change-point for the planned-ratio what-if** (lines 158-160, 248-249) — this is where ratios enter; the planned-ratio what-if must compose HERE (call `aggregateClusters` with planned `allocRatios`), NOT add a second `useMemo`:

```typescript
const cpuRatio = allocRatios?.cpuRatio ?? 4
const ramRatio = allocRatios?.ramRatio ?? 1
// ...
capacityVcpu: coresOf(usablePhysicalCores * cpuRatio),  // line 248 — ratio baked here
capacityRamMib: mib(physicalRamMib * ramRatio),          // line 249
```

Per-site reservation math to KEEP intact (lines 70-105, 196-216) — `reservationFor`, `fGhz/fRam/fCores`, `siteData: 'detected'|'assumed'`, the symmetric-50% fallback (lines 95-104, D-08 carry of P4 D-03), and `siteACapacityGhz`/`siteBCapacityGhz` (lines 255-258) feed the Site-loss picker's site identity. `h.faultDomain` (line 57, 71-74) is the canonical "site" field for the DR Site-loss filter.

---

### `src/engines/aggregation/estateView.ts` (engine assembler) — add planned projection (precedent: P5 added insights here)

**Analog:** itself (`src/engines/aggregation/estateView.ts:1-261`).

**Closest precedent — how P5 added a new projection inside the single pass** (lines 119-199, the `operationalInsights`/`clusterInsights` block) and **how the DR result already rides this pass** (lines 201-205):

```typescript
// DR what-if runs INSIDE this single composition (no second memo): the
// shipped aggregation re-run on survivors. `null` when nothing failed.
const drSim = opts?.scenario
  ? runScenario(merged, opts.scenario, { mode, stretchedClusters, allocRatios })
  : null
```

The planned-projection follows this exact idiom: compute a second `runScenario` / second `aggregateClusters` pass with **planned** ratios inside this one function, add it to the returned `EstateView` object (lines 207-222) and to `EMPTY_VIEW` (lines 245-260). NO new `useMemo`, NO new file — extend `buildEstateView`'s single pass and the `EstateView` shape. The `opts` param shape (lines 55-59) is where a `plannedRatios` field is added.

---

### `src/types/estate.ts` (model) — DR contract change

**Analog:** itself (`src/types/estate.ts:406-440`).

Current contract to REWORK:

```typescript
/** The dominant DR loss mode of a scenario (UI selector state echo). */
export type DrMode = 'host' | 'cluster' | 'vcenter'       // → 'server' | 'site'

export interface DrScenario {
  failedHosts: Set<string>
  failedClusters: Set<string>     // remove (cluster-loss dropped)
  failedVCenters: Set<string>     // remove (vCenter-loss dropped)
  // add: failedSites: Set<string> (fault-domain values of declared-stretched clusters)
}

export interface DrSimResult {
  mode: DrMode
  before: GlobalSummary
  after: GlobalSummary
  evacueeVcpu: Cores              // → physical CPU removed (GHz + cores)
  evacueeVramMib: MiB             // → physical RAM removed (keep MiB brand)
  perSurvivor: { cluster: string; verdict: Verdict }[]   // KEEP (Verdict reused)
  confidence: 'high' | 'medium' | 'low'                  // DELETE (D-10)
  caveats: string[]               // KEEP (i18n key suffixes — D-10)
}
```

`EstateView` (lines 346-373) gains the planned-projection field alongside `drSim` and `operationalInsights`, mirroring the `trends: T | null` / `drSim: DrSimResult | null` idiom (line 365 comment). Every consumer of `DrMode`/`DrScenario`/`DrSimResult` must be enumerated and updated (`runScenario.ts`, `estateView.ts`, `DrSimPanel.tsx`, `snapshotStore.ts` `EMPTY_SCENARIO`, all `drSim`/`scenario` test fixtures) — coverage gate ≥75% on `engines/drSim`.

---

### `src/components/ViewToggle.tsx` (component, event-driven) — EXTEND (precedent: P5 commit `123ecb2`)

**Analog:** itself + the P5 `hosts`-segment commit `123ecb2` (a 4-line `ViewToggle.tsx` change + 1 i18n key — the *exact* precedent for adding `'planning'`).

Add `'planning'` to the union + array (lines 3-5), nothing else changes — the `fieldset`/`legend`/`aria-pressed`/Arrow-key/wraparound idiom is generic over `VIEWS`:

```typescript
export type AppView = 'dashboard' | 'inventory' | 'hosts'         // + | 'planning'
const VIEWS = ['dashboard', 'inventory', 'hosts'] as const          // + 'planning'
```

KEEP verbatim (lines 47-74) — the active-segment accent-gold styling (`bg-accent-500 text-surface-900`, line 65) and the **`biome-ignore` + literal `role="group"`** (lines 49-50) which the CI grep gate asserts. Add `nav.planning` to `inventory.json` EN+FR (the namespace used at line 28: `useTranslation('inventory')`, key rendered at line 70 `t(\`nav.${view}\`)`).

**App-shell wiring precedent** — `App.tsx:34-44` is the view switch to extend:

```typescript
{activeView === 'inventory' ? (<InventoryView />)
  : activeView === 'hosts' ? (<HostsView />)
  : (<GlobalDashboard />)}
// add: : activeView === 'planning' ? (<PlanningView />)
```

---

### `src/components/dr/DrSimPanel.tsx` (component, presenter) — REWORK in place

**Analog:** itself (`src/components/dr/DrSimPanel.tsx:1-234`).

**Mode selector to rework** (line 14, 51-64, 102-128) — `['host','cluster','vcenter']` → `['server','site']`. KEEP the `<fieldset role="group">` + `aria-pressed` + Arrow-key idiom and the **`bg-primary-600 text-white`** active style (line 119 — UI-SPEC says DR mode active state stays primary, NOT accent) and the `biome-ignore` literal `role="group"` (lines 103-104, CI-gated).

**Reversible/neutral failed-selection UX to KEEP verbatim** (lines 16-22, 131-161) — `toggleIn` replace-never-mutate, the checkbox + grey strike-through (`text-slate-400 line-through`) + the "simulated failed" chip (`t('failed.chip')`, lines 153-157). No red, no icon, no dialog (D-10/G3).

**Single gold figure to re-point** (lines 184-192) — from vCPU to physical CPU+RAM (D-09). Currently:

```tsx
<p className="font-mono text-2xl font-semibold tabular-nums text-accent-500">
  {fmtInt(drSim.evacueeVcpu as number, loc)} vCPU
</p>
```

Re-label to "Physical CPU removed" ({GHz}/{cores}) + "Physical RAM removed" ({MiB}); keep `text-accent-500` as the *one* gold figure. Use `fmtGhzValue`/`fmtInt` (already imported line 4).

**Confidence block to DELETE** (lines 209-212):

```tsx
<div className="flex items-baseline gap-2 text-xs text-slate-600 dark:text-slate-400">
  <span className="font-semibold">{t('confidence.label')}</span>
  <span>{t(`confidence.${drSim.confidence}`)}</span>
</div>
```

**Caveats + assumptions blocks to KEEP** (lines 214-231) verbatim. **Verdict word render to KEEP** (lines 203-204) — `t(\`verdict.${p.verdict}\`)` neutral text, the UI-SPEC Open-Item-2 contract (enum word + numbers, no color).

**ADD** (new, no existing analog in this file): per-cluster host-count stepper (Server loss), site picker + "lost — no DR target" line (Site loss), the "Apply planned ratios to this scenario" checkbox (D-11, an in-panel affordance — NOT a 3rd mode tab). For the stepper/checkbox, reuse the native `<input>` + `<label className="flex items-center gap-2 text-sm">` idiom already in this file (lines 138-158).

---

### Planned-ratios control (NEW component) — REPLACES the slider mechanism

**Analog:** `src/components/allocation/AllocationSliders.tsx:1-113`.

**Preset-group idiom to REUSE VERBATIM** (lines 14-19, 80-105) — the `PRESETS` const supplies D-05's exact values; the `<fieldset role="group">` + `aria-pressed` + `matchesPreset` segmented group is copied verbatim, INCLUDING the `biome-ignore` literal `role="group"` (lines 81-82, CI-gated):

```typescript
const PRESETS: readonly Preset[] = [
  { key: '1to1', ratios: { cpu: 1, ram: 1 } },
  { key: '4to1', ratios: { cpu: 4, ram: 1 } },   // default (D-05: CPU 4:1 / RAM 1:1)
  { key: '8to1', ratios: { cpu: 8, ram: 1 } },
  { key: 'vdi10to1', ratios: { cpu: 10, ram: 1 } },
]
const matchesPreset = (r: AllocRatios, p: Preset): boolean =>
  r.cpu === p.ratios.cpu && r.ram === p.ratios.ram
```

**DROP** the two `<input type="range">` sliders (lines 47-78) — replace with `<input type="number">` (D-05; preset click fills the numeric field, off-preset typing clears the active preset = the existing `matchesPreset`→no-active behavior, factual, no error). Preset button height `h-8` (line 94) and the factual echo caption pattern (lines 108-110, `t('echo', { cpu, ram })`) are kept verbatim per UI-SPEC.

**CRITICAL — DROP the URL-hash mechanism entirely.** `AllocationSliders` currently sources state from `useAllocationHash` (`src/hooks/useAllocationHash.ts:1-81`). The new control is **in-memory only via a Zustand inputs slice** (D-06): NO `useAllocationHash`, NO `history.replaceState`, NO `parseAllocHash`, NO URL-hash codec. `useAllocationHash.ts` is the *anti-pattern* here — it is the killed mechanism, present only to show what NOT to reuse. (`AllocRatios`/`DEFAULT_RATIOS` *types* may be re-homed, but the hash hook itself is not used.)

---

### Zustand planned-ratios slice (NEW, added to `snapshotStore.ts`)

**Analog:** `src/store/snapshotStore.ts` — the `stretchedClusters` and `scenario` slices (lines 41-58, 64-69, 107-116, 164-168).

**Inputs-only, REPLACE-never-mutate, no-persist idiom to copy verbatim** — `stretchedClusters` (lines 44-47, 67, 107) and `scenario` (lines 48-52, 69, 109-116) are the exact templates:

```typescript
// state field (mirror stretchedClusters/scenario JSDoc — "Inputs-only,
// REPLACED never mutated; no persist, no localStorage (PROJECT.md line 53)"):
plannedRatios: { cpu: number; ram: number }   // default { cpu: 4, ram: 1 } (D-05)
// setter (mirror setStretchedClusters line 107 / setScenario lines 109-116):
setPlannedRatios: (r) => set({ plannedRatios: { ...r } }),
// selectors (mirror lines 164-168 — stable refs, never construct in selector):
export const selectPlannedRatios = (s) => s.plannedRatios
export const selectSetPlannedRatios = (s) => s.setPlannedRatios
// reset in clearAll (mirror lines 136-143).
```

The store-level header comment (lines 11-30, esp. PAR-05 "no browser-storage writes... refresh == data gone") already covers this slice — no new persistence, no middleware (D-06 / privacy invariant).

---

### `useEstateView.ts` + planned projection (hook, transform) — precedent: P4/P5 added inputs through it

**Analog:** `src/hooks/useEstateView.ts:1-54` (the single-`useMemo` site).

**Precedent — how P4 added `ratios`/`scenario` through the one memo** (lines 37-54):

```typescript
export function useEstateView(mode: AccountingMode, ratios: AllocRatios = DEFAULT_RATIOS): EstateView {
  const stretchedClusters = useSnapshotStore(selectStretchedClusters)
  const scenario = useSnapshotStore(selectScenario)
  return useMemo(() => {
    // ...
    return buildEstateView(mergeSnapshotsToEstate(selected), mode, {
      stretchedClusters,
      allocRatios: { cpuRatio: ratios.cpu, ramRatio: ratios.ram },
      scenario,
    })
  }, [snapshots, selectedIds, stretchedClusters, scenario, mode, ratios.cpu, ratios.ram])
}
```

Planned ratios are read here via a new `selectPlannedRatios` store selector and passed into `buildEstateView`'s `opts` (a new `plannedRatios` field), added to the dep array exactly like `ratios.cpu, ratios.ram`. NO new `useMemo`, NO recompute in any component (presenters only — line 35-36 contract). The planned projection + reworked DR result are produced inside `buildEstateView` and surface on `EstateView`.

---

### i18n: `dr.json` / `alloc.json` / `inventory.json` (config) — EN/FR key-pair

**Analog:** `src/i18n/locales/en/dr.json` + `src/i18n/locales/fr/dr.json` (verified 1:1 key parity), `en/alloc.json`, `en/inventory.json`.

**`dr.json` changes (EN+FR both, parity is a hard gate):**

```jsonc
// REWORK mode keys (en/dr.json:3-8 → server/site):
"mode": { "label": "...", "server": "Server loss", "site": "Site loss" }   // drop host/cluster/vcenter
// DELETE the entire confidence block (en/dr.json:28-33, fr/dr.json:28-33) — D-10
// KEEP verbatim: failed.chip (line 13), verdict.* (18-22), assumptions.* (23-27),
//   caveats.* (34-37) — extend caveats content for the two-mode/physical model
// ADD: site-loss "lost — no DR target" key, per-cluster stepper label,
//   "Apply planned ratios" affordance, empty-state-no-stretched key (UI-SPEC Copywriting table)
```

**`alloc.json`** — reuse the `preset.*` keys (lines 9-14: `1to1`/`4to1`/`8to1`/`vdi10to1`) verbatim; the `echo` interpolation pattern (line 15, `"CPU {{cpu}} · RAM {{ram}}"`) is the template for the "Planned lens — applies {cpu} CPU / {ram} RAM" caption. New keys land under a `planned.*` group (separate surface, D-03). **`inventory.json`** — add `nav.planning` (EN: "Planning", FR parity) under `nav` (lines 2-7), exactly like the shipped `nav.hosts`.

**Sentinel/denylist invariants** — em-dash `—` is the "not derivable" sentinel; no editorial verbs (`recommend`/`should`/`poor`/`good`/`worse`-as-judgement/high-med-low); no pre-formatted numbers in strings (use `fmt*` + i18n `count`/interpolation). These hold across every new key.

---

## Shared Patterns

### Branded units (physical DR impact)

**Source:** `src/engines/units/types.ts:7-23`
**Apply to:** `runScenario.ts`, `allocate.ts`, `estate.ts` `DrSimResult`

```typescript
export type GHz = number & { readonly __brand: 'GHz' }
export type Cores = number & { readonly __brand: 'Cores' }
export type MiB = number & { readonly __brand: 'MiB' }
export const ghz = (n: number): GHz => n as GHz
export const cores = (n: number): Cores => n as Cores
export const mib = (n: number): MiB => n as MiB
```

Physical DR impact (GHz/cores/MiB removed) MUST be branded — never a raw `number`, never raw `* 1.048576` (ADR-0010).

### `<fieldset role="group">` + `aria-pressed` segmented idiom (CI-gated)

**Source:** `ViewToggle.tsx:47-74`, `DrSimPanel.tsx:102-128`, `AllocationSliders.tsx:80-105`
**Apply to:** the new ViewToggle `planning` segment, the reworked DR mode selector, the new planned-ratios preset group
The literal `role="group"` + its `biome-ignore` comment are asserted by a CI grep gate — keep verbatim in every reuse. Active-state color differs by surface: ViewToggle top-level = `bg-accent-500 text-surface-900`; DR mode + preset = `bg-primary-600 text-white`.

### Inputs-only Zustand slice (no persist — privacy)

**Source:** `snapshotStore.ts:44-58` (`stretchedClusters`/`scenario`), selectors `162-168`
**Apply to:** the new `plannedRatios` slice
REPLACE-never-mutate (Zustand `Object.is`); selectors return stable refs (never construct an array/object inside a selector); reset in `clearAll`; no persist middleware, no localStorage/URL-hash (PAR-05 / D-06).

### Single-`useMemo` invariant (grep-gated)

**Source:** `useEstateView.ts:37-54` → `estateView.ts:52-223`
**Apply to:** planned projection + reworked DR result
All planned/DR numbers compute inside the one `buildEstateView` pass; surface on `EstateView`; components are pure presenters (e.g. `DrSimPanel.tsx:33-44`, `OperationalInsights.tsx:9-16`). No second `useMemo`, no component-level recompute.

### Factual presenter + sentinel + no-verdict

**Source:** `OperationalInsights.tsx:16-43` (em-dash via `na = t('na')`), `allocate.ts:3-9` (denylist comment), `DrSimPanel.tsx:203-204` (neutral verdict word)
**Apply to:** every Planning/DR string and figure
Em-dash for not-derivable (never fabricated 0); no color/traffic-light; enum words (`absorbs`/`tight`/`overflows`) are kept-by-design factual state words, rendered neutral.

---

## No Analog Found

None. Every Phase-6 file evolves a shipped, real-file-validated analog. The three NEW components (planned-ratios control, Planning view shell, planned-ratios store slice) each have an exact in-repo role+flow analog named above (`AllocationSliders` preset group, `GlobalDashboard` DR-block region + `App.tsx` switch, `snapshotStore` `stretchedClusters`/`scenario` slices). The planner uses these analogs, not RESEARCH.md (there is no `06-RESEARCH.md` by design — UI-SPEC line 16).

**Anti-pattern (named so the planner does NOT reuse it):** `src/hooks/useAllocationHash.ts` — the killed URL-hash codec. D-06 forbids URL-hash/localStorage; the new planned-ratios state is the in-memory Zustand slice instead. Listed only to mark it out of scope for reuse.

---

## Metadata

**Analog search scope:** `src/engines/drSim/`, `src/engines/aggregation/`, `src/components/{,dr/,allocation/,dashboard/}`, `src/hooks/`, `src/store/`, `src/types/`, `src/i18n/locales/{en,fr}/`, git commit `123ecb2` (P5 hosts-segment precedent)
**Files scanned:** 14 source files + 4 i18n files read; 1 git commit inspected
**Pattern extraction date:** 2026-05-17
