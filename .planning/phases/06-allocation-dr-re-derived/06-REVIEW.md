---
phase: 06-allocation-dr-re-derived
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - src/App.tsx
  - src/components/dashboard/GlobalDashboard.tsx
  - src/components/dr/DrSimPanel.tsx
  - src/components/dr/DrSimPanel.test.tsx
  - src/components/planning/PlannedRatiosControl.tsx
  - src/components/planning/PlanningView.tsx
  - src/components/ViewToggle.tsx
  - src/engines/aggregation/estateView.ts
  - src/engines/drSim/allocate.ts
  - src/engines/drSim/index.ts
  - src/engines/drSim/runScenario.ts
  - src/engines/drSim/runScenario.test.ts
  - src/hooks/useEstateView.ts
  - src/i18n/locales/en/alloc.json
  - src/i18n/locales/fr/alloc.json
  - src/i18n/locales/en/dr.json
  - src/i18n/locales/fr/dr.json
  - src/i18n/locales/en/inventory.json
  - src/i18n/locales/fr/inventory.json
  - src/store/snapshotStore.ts
  - src/types/estate.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: resolved
resolution:
  fixed: [CR-01, WR-01, WR-02, WR-03, WR-04]
  deferred: [IN-01, IN-02, IN-03]
  deferred_reason: Info-severity, out of --fix scope (Critical+Warning only)
  fix_commits: [fdabb81, 29cd9b2, ab531fc, 25a0a70]
  verified: "tsc -b clean; vitest 310/310; biome ./src clean; locked decisions D-00..D-12 intact"
---

# Phase 6: Code Review Report

**Reviewed:** 2026-05-17
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 6 re-derives Allocation/DR around a "planned" lens. The locked decisions are largely
respected: `DrMode` is exactly `'server' | 'site'` with no cluster/vCenter leftover, no
`confidence` grade anywhere, physical DR impact uses branded `GHz`/`Cores`/`MiB`, the
single-`useMemo` invariant holds (the only `useMemo` is in `useEstateView.ts`; the planned
projection composes inside `buildEstateView`), engines stay pure (no React/DOM/Zustand/Zod),
and the store performs no browser-storage writes for planned-ratio/DR inputs.

One BLOCKER: the planned-ratios numeric inputs admit `NaN`/blank values that flow unguarded
into the planned re-aggregation and corrupt `plannedView`/`plannedDrSim` numbers. Several
warnings concern a privacy-relevant URL-hash coupling still wired into the measured path, an
unbounded host-count stepper, and a default-ratio inconsistency. Dead i18n keys remain.

## Critical Issues

### CR-01: Planned-ratio inputs accept NaN / blank and corrupt the planned re-aggregation

**File:** `src/components/planning/PlannedRatiosControl.tsx:74,87`
**Issue:** Both numeric fields commit `Number(e.target.value)` directly into the store:
`setRatios({ ...ratios, cpu: Number(e.target.value) })`. Clearing the field (or typing `-`,
`e`, `.`) makes `e.target.value === ''` → `Number('') === NaN`. There is no clamp, no
`Number.isFinite` guard, and `min`/`step` on a native `<input type=number>` are not enforced
on manual entry. The `NaN` is stored in `plannedRatios`, read by `useEstateView`, and passed
to `buildEstateView` as `plannedRatios: { cpuRatio: NaN, ramRatio: NaN }`. Inside
`estateView.ts:228` this drives `aggregateClusters({ allocRatios: plannedRatios })`, so
`capacityVcpu = usablePhysicalCores × NaN = NaN` and `capacityRamMib = physicalRamMib × NaN
= NaN`. `survivorVerdict`/`band` then evaluate `NaN <= 0` (false) and `NaN <= 0.8·cap`
(false) → every survivor silently reports `overflows`, and `plannedDrSim` numbers (the gold
accent figures via `applyPlannedToDr`) are `NaN`. `fmtRatio` masks only the echo line with an
em-dash (`format.ts:93`); the corrupted capacity/verdict/DR figures are NOT routed through
`fmtRatio` and render as wrong/`NaN`. Wrong DR numbers are called out in the codebase as the
project's #1 risk (`types/estate.ts:446`), and a silent all-`overflows` planned verdict is a
data-integrity defect.
**Fix:** Sanitize on commit, mirroring the existing `useAllocationHash` clamp idiom (KISS, no
new dep):

```ts
const CPU_MIN = 1
const RAM_MIN = 0.25
const safeNum = (raw: string, min: number, fallback: number): number => {
  const n = Number(raw)
  return Number.isFinite(n) && n >= min ? n : fallback
}
// cpu field:
onChange={(e) => setRatios({ ...ratios, cpu: safeNum(e.target.value, CPU_MIN, ratios.cpu) })}
// ram field:
onChange={(e) => setRatios({ ...ratios, ram: safeNum(e.target.value, RAM_MIN, ratios.ram) })}
```

Alternatively guard at the store boundary in `setPlannedRatios` so any caller is protected.

## Warnings

### WR-01: Measured path still couples to the URL-hash ratio mechanism (D-06 surface risk)

**File:** `src/hooks/useEstateView.ts:4-5,40-41,52`
**Issue:** D-06 mandates no URL-hash persistence of ratio/DR inputs. `useEstateView` still
imports `AllocRatios`/`DEFAULT_RATIOS` from `useAllocationHash` and accepts a `ratios`
parameter defaulting to `DEFAULT_RATIOS`, threading it into `allocRatios` for the *measured*
aggregation. `useAllocationHash` itself (still on disk, still read/written by
`AllocationSliders.tsx`) does `history.replaceState` of `#alloc=cpu:..,ram:..` — i.e. ratio
inputs are persisted to the URL. Phase 6's intent is that the planned ratios live only in the
in-memory store, but the measured ratio still reaches `buildEstateView` via this hash-backed
path whenever a live caller passes hash-derived `ratios`. No reviewed caller passes `ratios`
(all use the `DEFAULT_RATIOS` default), so the hash is currently inert *for these files*, but
the coupling and the live `AllocationSliders` consumer keep a ratio-input URL-persistence
path alive against the spirit of D-06. Confirm whether `AllocationSliders`/`useAllocationHash`
are still mounted; if so this is effectively a ratio input persisted to the URL.
**Fix:** If Phase 6 retires the slider/hash entirely, delete `useAllocationHash.ts` +
`AllocationSliders.tsx` and drop the `ratios` parameter from `useEstateView` (pass the
in-memory measured ratios explicitly). If the hash path is intentionally retained for the
measured lens, document the D-06 carve-out explicitly in the hook and confirm it with the
phase decision record so it is not a silent regression.

### WR-02: Per-cluster host-count stepper accepts out-of-range / NaN input

**File:** `src/components/dr/DrSimPanel.tsx:255-263`
**Issue:** `onChange={(e) => stepCluster(hosts, Number(e.target.value))}` passes the raw
number to `replaceClusterHosts`. `Number('')` → `NaN`; `Math.min(NaN, len)` → `NaN`;
`slice(0, NaN)` → `[]` (silently clears the cluster's failed hosts with no feedback). Manual
entry above `max` is clamped by `Math.min(n, clusterHosts.length)` so that side is safe, but
negative input relies solely on `Math.max(0, ...)` — acceptable — while the `NaN`/blank case
produces a confusing silent reset. Lower severity than CR-01 because `replaceClusterHosts`
bounds it (no corrupt numbers escape), but it is still a UX correctness defect.
**Fix:** Coerce in the handler: `const n = Number(e.target.value); stepCluster(hosts,
Number.isFinite(n) ? n : 0)` (or guard inside `replaceClusterHosts` with
`Number.isFinite(n) ? n : 0`).

### WR-03: Planned-ratio default (4:1 / 1:1) vs input `min` inconsistency

**File:** `src/components/planning/PlannedRatiosControl.tsx:84` / `src/store/snapshotStore.ts:78`
**Issue:** The RAM input declares `min={0.25} step={0.25}` while `useAllocationHash`'s
`RAM_MIN` is `0.5` and `RAM_MAX` is `4`; the CPU input has no `max` (the slider contract used
`CPU_MAX = 16`). The planned path bypasses the `useAllocationHash` clamp entirely, so these
attributes are the only (browser-only, unenforced on programmatic/manual edge cases) bound.
The two subsystems now disagree on what a valid ratio is, which will surface as inconsistent
behavior between the measured slider lens and the planned lens.
**Fix:** Centralize the planned-ratio bounds as named constants and reuse them in both the
input attributes and the CR-01 sanitizer so the planned and measured lenses agree on valid
ranges.

### WR-04: `runScenario` Site-loss removes stretched-cluster hosts at the lost site with no failover modeling

**File:** `src/engines/drSim/runScenario.ts:61-71`
**Issue:** Site loss removes *every* host whose `faultDomain ∈ failedSites`, including hosts
belonging to declared-stretched clusters, and their VMs — then re-aggregates survivors. For a
stretched cluster spanning two sites, losing one site is exactly the case where the cluster is
*expected* to survive on the other site; the engine instead drops that site's capacity and
VMs with no restart/failover onto the surviving site. The `assumptions.doesNotModel` string
(`dr.json:45`) discloses "Does not model: HA admission control … stretched-cluster
split-brain", so this is arguably by-design, but the panel's separate "lost — no DR target"
line (`DrSimPanel.tsx:161-167`) only counts *non*-stretched hosts at the site, implying the
stretched portion *is* protected — while the engine `before − after` delta still books the
stretched hosts as removed capacity. The UI narrative and the engine math diverge for the
stretched-at-lost-site case.
**Fix:** Either (a) document explicitly (caveat key) that Site loss measures raw physical
subtraction including stretched hosts and that surviving-site failover is not modeled, so the
"lost — no DR target" line is the *only* DR-aware statement; or (b) exclude declared-stretched
clusters' hosts from the Site-loss removal set (model the surviving site keeping them) so the
engine matches the UI's implied semantics. Pick one and make the contract single.

## Info

### IN-01: Dead i18n keys left in `alloc.json` (both locales)

**File:** `src/i18n/locales/en/alloc.json:23-24` / `src/i18n/locales/fr/alloc.json:23-24`
**Issue:** `planned.drSlotHeading` and `planned.drSlotPending` described a "DR-sim lands in a
following plan" placeholder. `PlanningView.tsx` now renders `<DrSimPanel>` directly, so these
keys are unreferenced. Parity is intact (present in both locales) but the keys are dead.
**Fix:** Remove both keys from `en/alloc.json` and `fr/alloc.json`.

### IN-02: `DrSimPanel.summary()` Before/After GHz·RAM labels are raw unit strings, not i18n

**File:** `src/components/dr/DrSimPanel.tsx:173-174`
**Issue:** `{ label: 'GHz', ... }` and `{ label: 'RAM MiB', ... }` are hardcoded literals
inside an otherwise fully-translated panel (contrast with `t('stat.clusters')` etc. on
171-172). Not user-facing-prose-denylisted and unit symbols are locale-neutral, but it is an
inconsistency with the i18n convention applied everywhere else in the file.
**Fix:** Add `stat.ghz`/`stat.ramMib` keys to `dr.json` (en+fr) and use `t(...)` for
consistency, or add a brief comment that bare unit symbols are intentionally not translated.

### IN-03: Stale `useAllocationHash`-era doc comments on Phase-6 types/UI

**File:** `src/types/estate.ts:152-159` / `src/components/dr/DrSimPanel.tsx:64`
**Issue:** Comments still reference the retired model: "Allocation headroom (ALC — driven by
the URL-hash ratio sliders)" and "the slider changes THIS verdict" on `ClusterAggregate`, and
"reversible/neutral failed-selection UI" wording is fine but the surrounding ALC/slider
references are now misleading given D-05/D-06 replaced sliders with the planned-ratios numeric
control. Stale comments mislead future maintainers about where ratios originate.
**Fix:** Update the doc comments to reference the planned-ratios store slice (D-05) instead of
the URL-hash sliders.

---

*Reviewed: 2026-05-17*
*Reviewer: Claude (gsd-code-reviewer)*
*Depth: standard*
