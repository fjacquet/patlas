---
phase: 08-in-session-trends
plan: 02
subsystem: ui
tags: [zustand, web-worker, echarts, warm-up, memory-release]

requires:
  - phase: 08-in-session-trends
    provides: TrendHeadline/ReleasedTrendAggregate types + aggregateTrendGroup (plan 08-01)
provides:
  - releaseRawRows(id) inputs-only store mutation (DD-C)
  - Latest-first non-blocking background warm-up drain + {done,total}
  - LineChart registered in the shipped <Chart> ECharts registry
affects: [08-03, trends UI warm-up indicator, dashboard sparklines, delta panel]

tech-stack:
  added: []
  patterns:
    - "Non-blocking background drain: parse latest first, fire-and-forget sequential continuation (singleton Worker preserved)"
    - "DD-C release: aggregate captured BEFORE rows emptied (Pitfall 4 ordering)"

key-files:
  created: []
  modified:
    - src/store/snapshotStore.ts
    - src/hooks/useSnapshotUpload.ts
    - src/components/Chart.tsx
    - src/engines/trends/buildTrendSeries.ts
    - src/engines/trends/index.ts

key-decisions:
  - "DD-C threshold fixed at 4 (HYDRATED_BUDGET); release oldest-by-capturedAt non-active; never the active/latest"
  - "Release-time aggregate uses mode 'active' + default ratios — frozen at release (inherent DD-C trade-off; documented)"
  - "aggregateTrendGroup exported from trends engine (DRY) — release path reuses the same math as buildTrendSeries"

patterns-established:
  - "Warm-up {done,total} state source for the scoped 'trends preparing — N/M' indicator (no blocking overlay)"

requirements-completed: [TRD-01, TRD-02, TRD-05]

duration: 22min
completed: 2026-05-17
---

# Phase 8 Plan 02: Warm-up + Release + LineChart Summary

**Latest-`capturedAt`-first non-blocking warm-up drain (singleton Worker preserved), the `releaseRawRows` inputs-only DD-C mutation with aggregate-before-empty ordering, and `LineChart` registered with the ≤300 KB gz bundle gate re-verified at 268.0 KiB.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 3/3
- **Files modified:** 5

## Accomplishments

- **Task 1:** `releaseRawRows(id, releasedAggregate)` added to `SnapshotState` + impl copying the `setCapturedAt` REPLACE-never-mutate idiom (empties `vinfo/vhost/vdatastore/vpartition`, sets `rawReleased`, carries `releasedAggregate`). No store-cached aggregate, no storage spill (persist-grep 7 = baseline). Store tests 16 pass. (Snapshot type fields already landed in 08-01 per its documented deviation.)
- **Task 2:** `useSnapshotUpload` rewritten — latest-first ordering via the shared `filenameIsoDate` probe (no duplicated regex), first snapshot parsed+added then a non-awaited sequential background drain (singleton Worker intact), `{done,total}` exposed, DD-C `releaseRawRows` fired for the oldest non-active snapshot when >4 loaded with the aggregate computed before rows are emptied. `err.message`-only toast preserved.
- **Task 3:** `LineChart` added to the tree-shaken `echarts.use([...])` (single option-prop API unchanged, SVG only). `npm run build` green; `npm run check:bundle-size` OK — index chunk 268.0 KiB ≤ 300 KiB (A1 verified, not assumed).

## Deviations from Plan

**[Rule 1 - DRY] `aggregateTrendGroup` exported from the trends engine** — Found during: Task 2. The DD-C release path needs the per-snapshot `{headline, byCluster}` aggregate; re-deriving it inline would duplicate the merge+aggregate logic (DRY is binding). The private `aggregateGroup` in `buildTrendSeries.ts` (plan 08-01's module) was renamed to an exported `aggregateTrendGroup` (opts-object signature) and re-exported via the trends barrel; `buildTrendSeries` uses it internally, `useSnapshotUpload` uses it for the single-snapshot release. Files: src/engines/trends/buildTrendSeries.ts, src/engines/trends/index.ts. Verified: 108 trends/aggregation/store/hooks tests green; tsc + biome clean. Commit: 121fa65.

**Total deviations:** 1 auto-fixed (Rule 1). **Impact:** none — additive export; behavior of `buildTrendSeries` unchanged (same internal call, opts-object form).

## Verification

- `npx vitest run src/store/ src/hooks/ src/engines/trends/ src/engines/aggregation/` → 108 passed
- `npx tsc --noEmit -p tsconfig.app.json` → no errors
- `npm run build && npm run check:bundle-size` → OK (echarts chunk 268.0 KiB ≤ 300 KiB)
- `npx @biomejs/biome check` → clean (store, hook, Chart, trends)
- Privacy/TRD-05: persist-grep 7 = baseline (no new persistence); `releaseRawRows` REPLACE-never-mutate, no `state.snapshots.set(`
- Singleton Worker preserved: exactly 1 `parseInWorker(` call site, sequential drain

## Self-Check: PASSED

3 task commits present (6b4171b, 121fa65, 34b4d42); all acceptance criteria re-run green; plan `<verification>` block satisfied incl. the bundle gate.

## Next

Ready for **08-03** (TrendsView + DeltaPanel + dashboard sparklines + inline capturedAt edit + EN/FR i18n + REQUIREMENTS reconciliation + human-verify checkpoint). 08-03 consumes `EstateView.trends` (08-01), `{done,total}` + registered `LineChart` (this plan).
