---
phase: 02-aggregation-global-dashboard
plan: 01
subsystem: ui
tags: [echarts, echarts-for-react, svg-renderer, tree-shaking, charting, theme, react-memo, ci-gate]

# Dependency graph
requires:
  - phase: 01-foundation-invariants
    provides: "Midnight Executive @theme tokens in src/index.css; FallbackError component-shape conventions; check-supply-chain.mjs gate template; class-strategy dark mode"
provides:
  - "src/components/Chart.tsx — the single tree-shaken <Chart> primitive (echarts/core + echarts.use, {renderer:'svg'} injected centrally, React.memo reference comparator) consumed by every later phase"
  - "src/theme/echartsTheme.ts — MIDNIGHT_EXECUTIVE_LIGHT/DARK ECharts theme objects mapped from index.css tokens (registered as 'midnight-executive' / 'midnight-executive-dark')"
  - "scripts/check-bundle-size.mjs + check:bundle-size npm script — CI gate failing when the echarts chunk exceeds 307200 bytes gz"
  - "echarts@6.0.0 + echarts-for-react@3.0.6 in dependencies"
affects: [02-02-aggregation-engines, 02-03-dashboard-ui, dashboard, charting, pptx-export, html-report]

# Tech tracking
tech-stack:
  added: ["echarts@^6.0.0", "echarts-for-react@^3.0.6"]
  patterns:
    - "Tree-shaken ECharts: echarts/core + per-feature subpath imports + echarts.use([...]); the top-level barrel import is forbidden and CI-gated"
    - "Single universal `option` prop on <Chart> (no per-chart-family prop API — KISS, future-proof for treemap/heatmap/calendar/line)"
    - "React.memo with reference-equality comparator (option objects come from memoized useEstateView selectors)"
    - "Pure data theme module (no React/DOM) mapped from index.css @theme tokens; light+dark both resolved"
    - "Post-build bare-Node CI size gate modeled on check-supply-chain.mjs"

key-files:
  created:
    - src/components/Chart.tsx
    - src/components/Chart.test.tsx
    - src/theme/echartsTheme.ts
    - src/theme/echartsTheme.test.ts
    - scripts/check-bundle-size.mjs
  modified:
    - package.json
    - package-lock.json
    - tsconfig.app.json
    - .github/workflows/static.yml

key-decisions:
  - "echarts pinned ^6.0.0 / echarts-for-react ^3.0.6 — re-verified GA latest at execution (6.1.0 only at rc.2, excluded per GA-only stack discipline)"
  - "SVG-assertion path: mocked echarts-for-react/lib/core stand-in that renders <svg> iff opts.renderer==='svg' (jsdom cannot produce real ECharts SVG geometry — RESEARCH Open Question 2 documented fallback)"
  - "Removed deprecated tsconfig baseUrl rather than ignoreDeprecations (TS 5.9 rejects the '6.0' token the TS7.0 deprecation demands); paths resolve relative to tsconfig under moduleResolution:bundler"
  - "echarts-chunk marker substring in check-bundle-size.mjs = literal 'echarts' (case-insensitive latin1 scan of dist/assets/*.js)"
  - "Wired check:bundle-size into static.yml as a post-build CI step (T-02-02 enforcement) — NOT prebuild (prebuild stays supply-chain-only per 01-03)"

patterns-established:
  - "Pattern 1: Tree-shaken ECharts registry at module scope, once, before any chart mounts"
  - "Pattern 2: <Chart> wrapper — single option prop, central opts/theme injection, reference-equality memo"
  - "Pattern 3: Theme as pure data mapped from CSS @theme tokens, light+dark, registered at module load"

requirements-completed: [VIZ-01, VIZ-02, VIZ-03]

# Metrics
duration: 14min
completed: 2026-05-16
---

# Phase 2 Plan 01: ECharts SVG Infrastructure Summary

**Tree-shaken `<Chart>` wrapper (echarts/core + `echarts.use`, `{renderer:'svg'}` injected centrally, reference-equality `React.memo`) plus the Midnight Executive light/dark ECharts theme and a ≤300 KB gz CI bundle gate — the chart primitive every later phase consumes.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-05-16T04:51:08Z
- **Completed:** 2026-05-16T05:05:42Z
- **Tasks:** 2
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments

- `echarts@6.0.0` + `echarts-for-react@3.0.6` installed via the manifest-then-`npm install` non-bypass path; xlsx CDN-tarball pin byte-identical, supply-chain gate green
- `scripts/check-bundle-size.mjs` — bare-Node post-build gate that gzips the echarts-bearing `dist/assets/*.js` chunk and fails CI above 307200 bytes; wired as `check:bundle-size` and into `static.yml` after the Build step
- `src/components/Chart.tsx` — tree-shaken (`echarts/core` + `echarts.use([...])`, no barrel import, SVG-only registry) memoized wrapper around `echarts-for-react/lib/core`, `{renderer:'svg'}` + theme injected centrally so no caller can pick canvas (VIZ-01 structurally enforced)
- `src/theme/echartsTheme.ts` — pure `MIDNIGHT_EXECUTIVE_LIGHT`/`DARK` objects mapped from `index.css` @theme tokens per the UI-SPEC chart-series table; both registered once at module load (VIZ-03)
- RED→GREEN TDD observed: 12 behavior tests (theme token map, distinct light/dark, inline-`<svg>`/no-`<canvas>`, reference-equality memo comparator) — all green; full suite 127/127

## Task Commits

1. **Task 1: Add ECharts deps + the bundle-size CI gate** — `26a1137` (feat)
2. **Task 2: Midnight Executive theme + `<Chart>` wrapper (TDD)** — `7279ba6` (feat; RED→GREEN observed within the single task — modules created together because the `<behavior>` block tests theme+wrapper as one feature unit)

_Note: the plan's TDD task ships theme + wrapper as one coupled feature; RED was confirmed (both suites failed on absent modules) before GREEN._

## Files Created/Modified

- `src/components/Chart.tsx` — the single `<Chart>` primitive: tree-shaken registry + memoized SVG/theme-injecting wrapper
- `src/components/Chart.test.tsx` — DOM `<svg>`/no-`<canvas>` assertion via mocked `echarts-for-react/lib/core`; memo-comparator contract
- `src/theme/echartsTheme.ts` — pure light+dark Midnight Executive ECharts theme objects
- `src/theme/echartsTheme.test.ts` — token-map + distinct-variant + slate-axis behavior tests
- `scripts/check-bundle-size.mjs` — post-build ≤300 KB gz echarts-chunk CI gate
- `package.json` / `package-lock.json` — echarts deps + `check:bundle-size` script
- `tsconfig.app.json` — removed deprecated `baseUrl` (see Deviations)
- `.github/workflows/static.yml` — added post-build `check:bundle-size` step

## Decisions Made

- **ECharts versions re-verified at execution:** `npm view` confirmed `echarts` latest GA = `6.0.0` (no GA move past 6.0; `6.1.0-rc.2` exists but RC is excluded per GA-only stack discipline) and `echarts-for-react` latest = `3.0.6` with peer `echarts ^6.0.0`. The plan's `^6.0.0` / `^3.0.6` pins were correct and installed exactly (resolved `echarts@6.0.0`, `echarts-for-react@3.0.6`).
- **SVG-assertion path:** Used the RESEARCH Open Question 2 documented fallback — a `vi.mock` stand-in for `echarts-for-react/lib/core` that renders an `<svg>` (with `data-theme`) iff the `opts.renderer` it received is `'svg'`, else a `<canvas>`. jsdom does not produce real ECharts SVG geometry, so this deterministically proves both the central `{renderer:'svg'}` injection (VIZ-01) and the DOM-presence behavior contract without Vitest Browser Mode.
- **echarts-chunk marker substring:** the literal string `echarts` (case-insensitive `latin1` scan of `dist/assets/*.js`). ECharts ships its own `echarts` identifier strings into whichever emitted chunk it lands in regardless of Rolldown chunk-naming.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed deprecated `baseUrl` from tsconfig.app.json**

- **Found during:** Task 2 (typecheck verification gate)
- **Issue:** `npm run typecheck` (`tsc --noEmit -p tsconfig.test.json`) exited non-zero on a pre-existing TS5101: `baseUrl` deprecated, error on the TS7.0 track. The error message demands `ignoreDeprecations: "6.0"`, but TypeScript 5.9.3 rejects `"6.0"` (TS5103 — only `"5.0"` valid, which does not silence this TS7.0-targeted deprecation). This pre-existing Phase-1 config issue blocked the plan's mandatory `typecheck` exit-0 gate (and CI).
- **Fix:** Removed `"baseUrl": "."` from `tsconfig.app.json`; rewrote `paths` entries as `./src/*` so they resolve relative to the tsconfig. Under `moduleResolution: "bundler"` `baseUrl` is unnecessary for path mapping — resolution behavior is unchanged (app + test typecheck both clean; full suite 127/127; build passes). Vite/Vitest aliases live in their own configs and were untouched.
- **Files modified:** tsconfig.app.json
- **Verification:** `npm run typecheck` exits 0 (both stages); `vitest run` 127/127; `npm run build` passes
- **Committed in:** `7279ba6` (Task 2 commit)

**2. [Rule 3 - Blocking] biome reformatted check-bundle-size.mjs**

- **Found during:** Task 2 (lint gate)
- **Issue:** `scripts/check-bundle-size.mjs` (committed in Task 1) failed `biome check` formatting (multi-line `.filter` predicate).
- **Fix:** Applied `biome check --write`; cosmetic only (single-line predicate). Re-staged in the Task 2 commit.
- **Files modified:** scripts/check-bundle-size.mjs
- **Verification:** `biome check .` clean across 72 files
- **Committed in:** `7279ba6` (Task 2 commit)

**3. [Rule 2 - Missing Critical] Wired check:bundle-size into CI (static.yml)**

- **Found during:** Task 1/2 (threat-model T-02-02 review)
- **Issue:** The plan creates the gate script + npm script but the threat register marks T-02-02 (`dist bundle integrity`) `mitigate` — the mitigation is "fails CI". Without a CI step the gate is not enforced. The execution prompt's critical_reminders also mandate CI wiring.
- **Fix:** Added a `Check bundle size (ECharts chunk ≤300 KB gz — T-02-02)` step in `.github/workflows/static.yml` immediately after `Build` (post-build, not prebuild — prebuild stays supply-chain-only per 01-03). This is non-disruptive: at the 02-01 state the gate exits 0 ("no echarts chunk found") because nothing imports `<Chart>` outside tests yet; it becomes a live failing gate the moment 02-03 imports `<Chart>` into the dashboard or a non-tree-shaken import slips in.
- **Files modified:** .github/workflows/static.yml
- **Verification:** `npm run check:bundle-size` exits 0 with the expected "nothing to gate yet" message; YAML step placed correctly after Build
- **Committed in:** `7279ba6` (Task 2 commit)

**4. [Rule 1 - Bug] Reworded source comments to keep the tree-shaking grep gates honest**

- **Found during:** Task 2 (source-gate verification)
- **Issue:** Explanatory comments in `Chart.tsx` literally contained the forbidden tokens (`import * as echarts from 'echarts'` and `CanvasRenderer`), causing the plan's `! grep -q "from 'echarts'"` / `! grep -q "CanvasRenderer"` structural gates to false-positive on documentation.
- **Fix:** Reworded the comments to describe the forbidden patterns without containing the exact tokens (e.g., "the full barrel import of the top-level echarts package", "the canvas renderer is intentionally never imported"). The structural CI gate stays strict and honest.
- **Files modified:** src/components/Chart.tsx
- **Verification:** `! grep -q "from 'echarts'"` and `! grep -q "CanvasRenderer"` both pass; tests still 12/12
- **Committed in:** `7279ba6` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 missing-critical, overlapping 1 bug-class comment fix)
**Impact on plan:** All auto-fixes were necessary to make the plan's own verification gates and CI pass, or to enforce a `mitigate`-disposition threat. No scope creep — no aggregation engines, no dashboard components (those are 02-02/02-03). The tsconfig fix is the only change outside the plan's `files_modified`, and it is a minimal, behavior-preserving correction of a pre-existing Phase-1 config issue that blocked this plan's mandatory typecheck gate.

## Issues Encountered

- An external markdown auto-formatter touched `02-01-PLAN.md` (cosmetic URL-wrapping). Reverted via `git checkout --` so the authoritative plan stays pristine — no functional impact.
- RTK CLI proxy garbled `npm run lint` JSON output; ran `biome` directly from `node_modules/.bin` for reliable lint results (all 72 files clean).

## Measured ECharts gz chunk size

**Not yet present in the production bundle for plan 02-01.** As the plan's `<verification>` explicitly anticipates, no chart is imported outside tests yet (the dashboard imports `<Chart>` in 02-03), so `vite build` emits no echarts-bearing chunk and `check:bundle-size` reports `OK (no echarts chunk found — nothing to gate yet)` and exits 0. The authoritative ≤300 KB gz assertion is exercised by 02-03's verification once the dashboard imports `<Chart>`. The gate is wired and verified to fire correctly (exits 1 when `dist/assets` is absent; selects echarts chunks by the `echarts` marker; gzips and compares against 307200 bytes).

## Security

- `semgrep --config auto` on all 5 new source files: **0 findings, exit 0**.
- `check-supply-chain`: OK — xlsx tarball pin byte-identical, no telemetry dep introduced (T-02-01 re-verified green). ECharts/echarts-for-react are render-only; the Phase-1 fetch/XHR/WS/Beacon guard + CSP `connect-src 'self'` cover them. No new network surface.
- No `## Threat Flags` — this plan introduces no security surface beyond the plan's existing `<threat_model>` (render-only deps, no endpoints/auth/file/schema changes).

## Known Stubs

None. The theme is fully resolved (concrete oklch/hex strings from `index.css`, no placeholders); `<Chart>` is fully wired to `echarts-for-react/lib/core`. The bundle gate's "nothing to gate yet" path is intentional and plan-sanctioned (02-03 makes it live), not a stub.

## Next Phase Readiness

- `<Chart>` and the Midnight Executive theme are ready to be consumed by 02-03's dashboard chart hosts (`OsBreakdownDonut`, `UtilizationGauge`) — pass a full ECharts `option` object built in a pure selector off `useEstateView`.
- The bundle-size gate goes live automatically once 02-03 imports `<Chart>` into the dashboard.
- Plan 02-02 (aggregation engines + `useEstateView`) is independent of this plan and unblocked.
- No blockers.

## Self-Check: PASSED

- `src/components/Chart.tsx` — FOUND
- `src/components/Chart.test.tsx` — FOUND
- `src/theme/echartsTheme.ts` — FOUND
- `src/theme/echartsTheme.test.ts` — FOUND
- `scripts/check-bundle-size.mjs` — FOUND
- Commit `26a1137` (Task 1) — FOUND
- Commit `7279ba6` (Task 2) — FOUND

---
_Phase: 02-aggregation-global-dashboard_
_Completed: 2026-05-16_
