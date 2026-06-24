# patlas Plan 2A — Strip VMware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the VMware/RVTools-only code from patlas (DR/stretched-cluster analysis, the RVTools parser adapter and its glue) and harden the two transitional types Plan 1 left soft (`Snapshot.source` and `VInfoRow.guestType`).

**Architecture:** patlas (a Proxmox fork of vatlas) ingests only Proxmox reports after Plan 1. The RVTools adapter, the DR what-if engine, and the stretched-cluster concept have no Proxmox analog. This plan deletes them and the code that fed them, then tightens the types that were widened/optional only to keep the RVTools path compiling. `snapshotMerge` and `vsanRelink` are KEPT — they are the entry point for all aggregation and degrade correctly for single-cluster Proxmox data.

**Tech Stack:** React 19 · TypeScript (strict) · Zustand 5 · Zod 4 (parser boundary only) · Vitest 4 · Biome.

## Global Constraints

- **Privacy invariant (absolute):** no fetch of dataset bytes, no telemetry, no `localStorage`/`sessionStorage`/IndexedDB of dataset rows. Only `patlas-theme` + `patlas-lang` keys. Refresh = data gone.
- **Engines stay pure:** no React/DOM/Zustand/Zod inside `src/engines/**`. Zod only at the parser boundary (`schemas.ts`).
- **Branded units only** via the `src/engines/units` constructors. GiB→MiB = `× MIB_PER_GIB` (1024); never `* 1.048576`.
- **i18n key parity:** every locale key path must exist in all four locales (`en`/`fr`/`de`/`it`); `src/i18n/keyParity.test.ts` enforces it. Deleting a namespace means deleting the file in ALL four locales.
- **Each task ends GREEN:** `npm run typecheck` (app + test projects), `npx @biomejs/biome check .`, and `npm run test:run` all clean before committing. Deletion tasks must fix every dangling reference in the same task.
- **Signed commits** required — never `--no-gpg-sign`. Commit prefix `<type>(patlas-2a-NN): …`.
- **Use `npx @biomejs/biome check .`** for lint — never `npm run lint` (intercepted, prints a bogus error).
- The real Proxmox fixture lives git-ignored at `src/engines/parser/__fixtures__/proxmox-report.xlsx`; the realfile tests run when present.

## File Structure

**Deleted:**

- `src/engines/drSim/` (3 files: `runScenario.ts`, `allocate.ts`, `index.ts` + 2 tests)
- `src/components/dr/DrSimPanel.tsx` (+ test), `src/components/stretched/StretchedPill.tsx`
- `src/engines/export/pptx/slides/drSimSlide.ts`
- `src/i18n/locales/{en,fr,de,it}/dr.json` and `str.json` (8 files)
- `src/engines/parser/adapters/rvtools.ts` (+ test), `src/engines/parser/normalizeColumns.ts` (+ test), `src/engines/parser/synthesizeOrphanClusters.ts`
- `src/__fixtures__/rvtools-inventory-10k.xlsx`, `src/__fixtures__/rvtools-mib-canary.xlsx`, and `src/engines/parser/canary.test.ts` (consumes the canary fixture)

**Modified:**

- `src/engines/aggregation/estateView.ts` — drop `runScenario` import + `drSim`/`plannedDrSim` blocks + return fields + `EMPTY_VIEW` entries.
- `src/types/estate.ts` — drop `DrScenario`/`DrMode`/`DrSimResult`, `EstateView.drSim`/`plannedDrSim`, and `ClusterAggregate` DR-reservation fields.
- `src/engines/aggregation/aggregateClusters.ts` — drop `stretchedClusters` param + reservation derivation.
- `src/hooks/useEstateView.ts` — drop `scenario`/`stretchedClusters` subscriptions, deps, and the `buildEstateView` args.
- `src/store/snapshotStore.ts` — drop `scenario` + `stretchedClusters` slices/actions/selectors.
- `src/components/planning/PlanningView.tsx` — drop the `DrSimPanel` block.
- `src/engines/export/html/renderReport.tsx`, `src/engines/export/chartBundle.ts`, `src/engines/export/pptx/builder.ts` — drop DR sections.
- `src/types/snapshot.ts` — `source: 'proxmox'` (drop the union).
- `src/types/vinfo.ts` — `guestType: 'qemu' | 'lxc'` (required).
- `src/engines/parser/schemas.ts` — `guestType: z.enum(['qemu','lxc'])` (drop `.optional()`).
- ~27 test/fixture files constructing `source: 'rvtools'` → `'proxmox'`.

---

### Task 1: Remove the DR / stretched-cluster stack

Delete the DR what-if engine, its UI, its store slices, its export sections, and its i18n — and the stretched-cluster reservation logic it depends on. End green.

**Files:**

- Delete: `src/engines/drSim/runScenario.ts`, `allocate.ts`, `index.ts`, `runScenario.test.ts`, `allocate.test.ts`; `src/components/dr/DrSimPanel.tsx`, `DrSimPanel.test.tsx`; `src/components/stretched/StretchedPill.tsx`; `src/engines/export/pptx/slides/drSimSlide.ts`; `src/i18n/locales/{en,fr,de,it}/dr.json`, `src/i18n/locales/{en,fr,de,it}/str.json`
- Modify: `src/types/estate.ts`, `src/engines/aggregation/estateView.ts`, `src/engines/aggregation/aggregateClusters.ts`, `src/hooks/useEstateView.ts`, `src/store/snapshotStore.ts`, `src/components/planning/PlanningView.tsx`, `src/engines/export/html/renderReport.tsx`, `src/engines/export/chartBundle.ts`, `src/engines/export/pptx/builder.ts`
- Plus: any test that asserts on `drSim`/`plannedDrSim`/`stretchedClusters`/`drReserved*` (find them in step 1).

**Interfaces:**

- Produces: `EstateView` without `drSim`/`plannedDrSim`; `ClusterAggregate` without `drReservedGhz`/`drReservedRamMib`/`reservationFor`/`siteData`/`siteACapacity*`/`siteBCapacity*`; `aggregateClusters` signature without the `stretchedClusters` parameter; `buildEstateView` options without `scenario`/`plannedRatios`-driven DR.

- [ ] **Step 1: Inventory the blast radius**

Run, to find every reference that must be cleaned:

```bash
cd /Users/fjacquet/Projects/patlas
grep -rln "drSim\|DrSim\|plannedDrSim\|stretched\|Stretched\|runScenario\|DrScenario\|DrMode\|DrSimResult\|drReserved\|reservationFor\|selectScenario\|selectStretchedClusters\|siteACapacity\|siteBCapacity\|drSimSlide\|StretchedPill\|'dr'\|\"dr\"\|/dr.json\|str.json" src/ | sort
```

Expected: the files listed above plus their tests. Treat this list as the work set.

- [ ] **Step 2: Delete the DR engine, UI, export slide, and i18n files**

```bash
cd /Users/fjacquet/Projects/patlas
git rm -r src/engines/drSim
git rm src/components/dr/DrSimPanel.tsx src/components/dr/DrSimPanel.test.tsx
git rm src/components/stretched/StretchedPill.tsx
git rm src/engines/export/pptx/slides/drSimSlide.ts
git rm src/i18n/locales/en/dr.json src/i18n/locales/fr/dr.json src/i18n/locales/de/dr.json src/i18n/locales/it/dr.json
git rm src/i18n/locales/en/str.json src/i18n/locales/fr/str.json src/i18n/locales/de/str.json src/i18n/locales/it/str.json
```

(If `StretchedPill` proves to have a sibling test, `git rm` that too — the step-1 grep reveals it.)

- [ ] **Step 3: Remove DR types from `types/estate.ts`**

Delete the `DrScenario`, `DrMode`, `DrSimResult` type declarations; remove `drSim: DrSimResult | null` and `plannedDrSim: DrSimResult | null` from `EstateView`; remove `drReservedGhz`, `drReservedRamMib`, `reservationFor`, `siteData`, `siteACapacityGhz`/`siteBCapacityGhz`/`siteACapacityRamMib`/`siteBCapacityRamMib` (and any other `site*`/`reservation*` DR field) from `ClusterAggregate`. Leave every non-DR field intact.

- [ ] **Step 4: Remove DR computation from the engines**

In `src/engines/aggregation/estateView.ts`: delete the `runScenario` import; delete the `const drSim = …` and `const plannedDrSim = …` blocks; remove `drSim`/`plannedDrSim` from the returned object and from the `EMPTY_VIEW` sentinel.
In `src/engines/aggregation/aggregateClusters.ts`: remove the `stretchedClusters` parameter from the signature and every call site, and delete the `reservationFor` / `drReserved*` / `site*` derivation block. The function keeps producing all non-DR `ClusterAggregate` fields.

- [ ] **Step 5: Remove DR wiring from the hook and store**

In `src/hooks/useEstateView.ts`: remove the `selectScenario` and `selectStretchedClusters` subscriptions, drop `scenario`/`stretchedClusters` from the `useMemo` dependency array, and remove them from the `buildEstateView(...)` / `aggregateClusters(...)` call args.
In `src/store/snapshotStore.ts`: delete the `scenario` and `stretchedClusters` state slices, their actions (setters/toggles), and their selectors (`selectScenario`, `selectStretchedClusters`).

- [ ] **Step 6: Remove DR from the UI and exports**

In `src/components/planning/PlanningView.tsx`: remove the `DrSimPanel` import and its rendered block (keep the rest of the Planning view — `PlannedEstatePanel` stays).
In `src/engines/export/html/renderReport.tsx`: delete the DR report section (the `view.drSim`-guarded block) and any `vsan`-adjacent DR lines that reference `drSim`.
In `src/engines/export/chartBundle.ts`: delete the `view.drSim` branch.
In `src/engines/export/pptx/builder.ts`: remove the `drSimSlide` import and its call.

- [ ] **Step 7: Fix the tests that referenced DR**

For every remaining test surfaced by step 1 (e.g. `estateView.test.ts`, export tests, `aggregateClusters` tests, store tests) remove or adjust the assertions on `drSim`/`plannedDrSim`/`stretchedClusters`/`drReserved*` and drop the `stretchedClusters` argument from `aggregateClusters(...)` calls. Do NOT weaken unrelated assertions — only remove the DR-specific ones.

- [ ] **Step 8: Verify green**

Run:

```bash
cd /Users/fjacquet/Projects/patlas
npm run typecheck && npx @biomejs/biome check . && npm run test:run 2>&1 | grep -E "Test Files|Tests "
```

Expected: typecheck clean, biome clean, all tests pass (count drops by the deleted DR/stretched tests). The i18n keyParity test passes (dr/str removed symmetrically across all four locales).

- [ ] **Step 9: Commit**

```bash
cd /Users/fjacquet/Projects/patlas
git add -A
git commit -m "refactor(patlas-2a-01): remove DR what-if and stretched-cluster stack"
```

---

### Task 2: Remove the RVTools adapter path

Delete the RVTools adapter and its glue (`normalizeColumns`, `synthesizeOrphanClusters`) plus the RVTools-only tests and Excel fixtures. The worker already uses `adaptProxmox` and imports none of these, so no production wiring changes.

**Files:**

- Delete: `src/engines/parser/adapters/rvtools.ts`, `rvtools.test.ts`; `src/engines/parser/normalizeColumns.ts`, `normalizeColumns.test.ts`; `src/engines/parser/synthesizeOrphanClusters.ts`; `src/engines/parser/canary.test.ts`; `src/__fixtures__/rvtools-inventory-10k.xlsx`, `src/__fixtures__/rvtools-mib-canary.xlsx`
- Plus: `src/engines/parser/parserEdges.test.ts` if it only tests the RVTools path (inspect in step 1; if it tests `parseXlsx`/shared helpers too, keep those parts).

**Interfaces:**

- Consumes: nothing new.
- Produces: a parser surface with `parseXlsx`, `columnMap`, `proxmox.ts`, `proxmoxColumns.ts`, `extractZip.ts`, `schemas.ts`, `vmUsage*` as the only adapters.

- [ ] **Step 1: Confirm no production code imports the RVTools path**

```bash
cd /Users/fjacquet/Projects/patlas
grep -rln "adaptRvtools\|normalizeColumns\|synthesizeOrphanClusters\|parseSnapshot" src/ | grep -v ".test." | grep -v "/adapters/rvtools.ts\|/normalizeColumns.ts\|/synthesizeOrphanClusters.ts"
```

Expected: NO output (the worker uses `adaptProxmox`). If anything prints, STOP and report — there is an unexpected consumer.
Then inspect `src/engines/parser/parserEdges.test.ts` and `src/engines/parser/canary.test.ts` to see exactly what they import.

- [ ] **Step 2: Delete the RVTools files and fixtures**

```bash
cd /Users/fjacquet/Projects/patlas
git rm src/engines/parser/adapters/rvtools.ts src/engines/parser/adapters/rvtools.test.ts
git rm src/engines/parser/normalizeColumns.ts src/engines/parser/normalizeColumns.test.ts
git rm src/engines/parser/synthesizeOrphanClusters.ts
git rm src/engines/parser/canary.test.ts
git rm src/__fixtures__/rvtools-inventory-10k.xlsx src/__fixtures__/rvtools-mib-canary.xlsx
```

- [ ] **Step 3: Resolve `parserEdges.test.ts`**

If step 1 showed `parserEdges.test.ts` imports `adaptRvtools`/`synthesizeOrphanClusters`/`parseSnapshot`, it is RVTools-only → `git rm src/engines/parser/parserEdges.test.ts`. If it ALSO covers `parseXlsx` or `columnMap` (shared, kept) helpers, instead edit it to delete only the RVTools-dependent test cases and keep the shared-helper ones. Choose based on the step-1 inspection; do not leave it importing deleted modules.

- [ ] **Step 4: Verify green**

Run:

```bash
cd /Users/fjacquet/Projects/patlas
npm run typecheck && npx @biomejs/biome check . && npm run test:run 2>&1 | grep -E "Test Files|Tests "
```

Expected: clean; test count drops by the removed RVTools/canary/parserEdges tests. The Proxmox realfile tests still run and pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/fjacquet/Projects/patlas
git add -A
git commit -m "refactor(patlas-2a-02): remove RVTools adapter, normalizeColumns, orphan-cluster synthesis"
```

---

### Task 3: Harden `Snapshot.source` to `'proxmox'`

Drop `'rvtools'` from the union and sweep every fixture that still constructs it.

**Files:**

- Modify: `src/types/snapshot.ts` (the `source` field)
- Modify: ~26 test files constructing `source: 'rvtools'` (full list below)

**Interfaces:**

- Produces: `Snapshot.source: 'proxmox'` (single literal).

- [ ] **Step 1: Narrow the type**

In `src/types/snapshot.ts`, change `source: 'rvtools' | 'proxmox'` to `source: 'proxmox'`.

- [ ] **Step 2: Run typecheck to enumerate the breakages**

Run: `cd /Users/fjacquet/Projects/patlas && npm run typecheck 2>&1 | grep "source"`
Expected: FAIL — one error per fixture still using `source: 'rvtools'`. This is the authoritative work list (cross-check against step 3).

- [ ] **Step 3: Sweep `'rvtools'` → `'proxmox'` in all fixtures**

Replace `source: 'rvtools'` with `source: 'proxmox'` in each of:

```
src/components/network/NetworkView.test.tsx
src/components/rightsizing/RightSizingView.test.tsx
src/components/storage/StorageView.test.tsx
src/components/monstervm/MonsterVmView.test.tsx
src/components/inventory/columns/columns.test.ts
src/components/hosts/HostsView.test.tsx
src/__tests__/rightsizing-e2e.test.tsx
src/__tests__/inventory-stress.test.tsx
src/__tests__/dashboard-smoke.test.tsx
src/__tests__/e2e-smoke.test.tsx        (two occurrences)
src/engines/aggregation/estateView.test.ts
src/engines/trends/captureDateOrdinal.test.ts
src/engines/trends/buildTrendSeries.test.ts
src/engines/snapshotMerge/vCenterIndex.test.ts
src/engines/snapshotMerge/mergeSnapshotsToEstate.test.ts
src/engines/export/html/renderReport.test.tsx
src/engines/export/html/assembleHtml.test.ts
src/engines/export/chartBundle.test.ts
src/engines/export/pptx/builder.test.ts
src/engines/export/buildExportView.test.ts
src/hooks/useSnapshotUpload.test.ts
src/hooks/useEstateView.test.ts
src/store/snapshotStore.test.ts
```

A repo-wide sed makes this exact and complete:

```bash
cd /Users/fjacquet/Projects/patlas
grep -rl "source: 'rvtools'" src/ | xargs sed -i '' "s/source: 'rvtools'/source: 'proxmox'/g"
```

(The `parser.worker.ts` already emits `'proxmox'`, so it is unaffected.)

- [ ] **Step 4: Verify no `'rvtools'` source literal remains**

Run: `cd /Users/fjacquet/Projects/patlas && grep -rn "source: 'rvtools'" src/ ; echo "exit: $?"`
Expected: no matches.

- [ ] **Step 5: Verify green**

Run:

```bash
cd /Users/fjacquet/Projects/patlas
npm run typecheck && npx @biomejs/biome check . && npm run test:run 2>&1 | grep -E "Test Files|Tests "
```

Expected: clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/fjacquet/Projects/patlas
git add -A
git commit -m "refactor(patlas-2a-03): harden Snapshot.source to 'proxmox' only"
```

---

### Task 4: Harden `VInfoRow.guestType` to required

Make `guestType` non-optional in the type and the Zod schema; the Proxmox adapter already sets it on every row, so only fixtures that build a `VInfoRow` without it (if any) need a value.

**Files:**

- Modify: `src/types/vinfo.ts` (`guestType`), `src/engines/parser/schemas.ts` (Zod entry)
- Plus: any fixture building a `VInfoRow` literal without `guestType` (typecheck reveals them).

**Interfaces:**

- Produces: `VInfoRow.guestType: 'qemu' | 'lxc'` (required); Zod `guestType: z.enum(['qemu','lxc'])`.

- [ ] **Step 1: Make the type required**

In `src/types/vinfo.ts`, change `guestType?: 'qemu' | 'lxc'` to `guestType: 'qemu' | 'lxc'`.

- [ ] **Step 2: Make the Zod schema required**

In `src/engines/parser/schemas.ts`, change `guestType: z.enum(['qemu', 'lxc']).optional()` to `guestType: z.enum(['qemu', 'lxc'])`.

- [ ] **Step 3: Run typecheck to find fixtures missing `guestType`**

Run: `cd /Users/fjacquet/Projects/patlas && npm run typecheck 2>&1 | grep -i "guestType"`
Expected: an error for each `VInfoRow` literal lacking `guestType` (helper builders in test files). If none, the adapter and helpers already always set it.

- [ ] **Step 4: Add `guestType` to any flagged fixture/helper**

For each location flagged in step 3, add `guestType: 'qemu'` to the `VInfoRow` literal (use `'qemu'` as the neutral default for a generic test VM; use `'lxc'` only where a test specifically exercises a container). If a shared test-helper factory builds `VInfoRow`, add a `guestType: 'qemu'` default there (single edit covers many call sites).

- [ ] **Step 5: Verify green**

Run:

```bash
cd /Users/fjacquet/Projects/patlas
npm run typecheck && npx @biomejs/biome check . && npm run test:run 2>&1 | grep -E "Test Files|Tests "
```

Expected: clean; all tests pass; the Proxmox realfile tests still pass (the adapter always sets `guestType`).

- [ ] **Step 6: Commit**

```bash
cd /Users/fjacquet/Projects/patlas
git add -A
git commit -m "refactor(patlas-2a-04): make VInfoRow.guestType required (type + Zod)"
```

---

## Self-Review

**Spec coverage (Plan 2A scope = the spec's "Cut: DR" §6.2 + the deferred "RVTools removal / type hardening" from Plan 1's tracked deviations):**

- DR/stretched removal (spec §6.2) → Task 1 ✓
- RVTools adapter removal (spec §3 "Strip") → Task 2 ✓
- `source` hardening (Plan 1 tracked deviation) → Task 3 ✓
- `guestType` hardening (Plan 1 tracked deviation) → Task 4 ✓
- KEEP `snapshotMerge` + `vsanRelink` (map coupling analysis) → not touched, explicitly ✓
- i18n parity preserved (dr/str deleted in all 4 locales) → Task 1 step 2/8 ✓
- Deferred to Plan 2B: terminology remap + inventory guestType segmentation → not in this plan ✓

**Placeholder scan:** no TBD/TODO; deletion steps use exact `git rm` paths; the two judgment points (parserEdges.test.ts in Task 2 step 3; which fixtures need guestType in Task 4) are resolved by an explicit inspect-then-decide instruction, not left vague. ✓

**Type consistency:** `source: 'proxmox'` (Task 3) and `guestType: 'qemu' | 'lxc'` required (Task 4) match the Zod schema edits; `aggregateClusters` losing its `stretchedClusters` param (Task 1 step 4) is reflected in the test fix-ups (Task 1 step 7). ✓

**Ordering note:** Task 1 (DR) and Task 2 (RVTools) are independent (disjoint files) and could run in parallel via worktrees; Tasks 3 and 4 (hardening) must follow Task 2 (they touch the same fixtures the RVTools removal leaves) and are best run sequentially after, since both sweep the test-fixture set and would otherwise collide.
