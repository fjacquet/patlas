---
phase: 10-html-pptx-exports-deploy
plan: 03
subsystem: export
tags: [html-report, renderToStaticMarkup, csp, size-budget, xss, wave-2]
requires: [10-02]
provides:
  - "renderReport — typed pure HTML report tree (8 HTM-04 sections, D-09 trends omission)"
  - "inlineAssets + assertSizeBudget — CSP meta, light CSS, <5MB/<15MB hard gate"
  - "assembleHtml — single self-contained offline <!doctype> document with spliced chart SVGs"
affects: [10-05]
tech-stack:
  added: []
  patterns:
    - "renderReport emits data-chart-slot placeholders; assembleHtml is the single sanctioned raw-SVG splice layer (React tree stays raw-HTML-free)"
    - "Deterministic c-{i}-{slug} anchor ids defeat slug-collision dup-id (Pitfall 6)"
key-files:
  created:
    - src/engines/export/html/renderReport.tsx (+test)
    - src/engines/export/html/inlineAssets.ts (+test)
    - src/engines/export/html/assembleHtml.ts (+test)
key-decisions:
  - "TOP_N_CLUSTERS = 16 inline-with-chart; remainder → chart-less annex table (size lever)"
  - "Charts spliced as trusted ECharts-SSR SVG strings in assembleHtml, NOT via a React raw-markup prop (grep-gated absent in renderReport)"
  - "CSP exact: default-src 'none'; img-src data:; style-src 'unsafe-inline' data:; font-src data:; system-font default = 0 embedded bytes"
requirements-completed: [HTM-01, HTM-02, HTM-03, HTM-04, HTM-05]
duration: ~55min
completed: 2026-05-18
---

# Phase 10 Plan 03: HTML report engine Summary

**The product itself: one call yields a single self-contained offline `.html` — `renderToStaticMarkup` of a typed pure tree, all 8 HTM-04 sections (trends omitted at <2 snapshots, D-09), XSS-safe, crisp inline ECharts-SSR SVG charts, under 5 MB typical / 15 MB on a 10k-VM fixture. 20/20 html tests, 47/47 export+i18n.**

## Accomplishments
- `renderReport`: typed React tree (cover · headlines · per-cluster[top-16 + chart slot] · eos · dr · trends[D-09 conditional] · annex · methodology). Pure (no Zustand/i18next/clock). All user strings via JSX text nodes — auto-escaped (explicit `<script>` test); zero raw-markup escape-hatch prop (grep 0). Deterministic `c-{i}-{slug}` anchors proven collision-safe.
- `inlineAssets` + `assertSizeBudget`: exact CSP meta, light-fixed plain CSS (maps the placeholder + gold `.flagged` marker classes), system-font default (0 embedded bytes), hard 5/15 MB gate.
- `assembleHtml`: the one sanctioned string-assembly layer — splices trusted chart SVGs into `data-chart-slot` placeholders, wraps a single `<!doctype html>` with CSP + inline `<style>`. Offline/no-JS verified on a 10k-VM fixture under the ceiling.

## Task Commits
1. **Task 1: renderReport tree** — `feat(10-03)` (5/5)
2. **Task 2: inlineAssets + size budget** — `feat(10-03)` (7/7)
3. **Task 3: assembleHtml + 10k ceiling** — this commit (4/4 → 20/20 html total)

## Deviations from Plan
**1. [Signature refinement] `renderReport({view,trends,strings,locale})` (no `charts` param).** The plan listed `charts` on `renderReport`; charts are spliced by `assembleHtml` (the sanctioned raw layer) so `renderReport` only emits placeholders — keeping its tree provably raw-HTML-free (the cleanest way to satisfy the "no raw-markup prop in renderReport" acceptance + the "inline SVG charts" requirement simultaneously). `assembleHtml` owns the `charts: ChartMap`.
**2. [Test-assertion correctness] HTM-02 "no http(s)" → "no http(s) ASSET ref".** The inline ECharts SVG necessarily carries `xmlns="http://www.w3.org/2000/svg"` (an inert namespace URI, never fetched; CSP `default-src 'none'` blocks any fetch). Asserting the absence of `src/href/url(...)` http(s) references is the correct expression of HTM-02/T-10-10 (no leaking external asset) — a bare "no http substring" test is wrong (would forbid the mandatory SVG namespace).

No scope creep; no new deps (supply-chain unaffected).

## Issues Encountered
- Two test-helper bugs (slot id read post-splice; probe bar option lacked axes) — fixed; not product issues. `@/...` IDE diagnostics are the known tsconfig-path noise (`npm run typecheck` exit 0).

## Next Plan Readiness
10-04 (PPTX engine) consumes `buildExportView`/`chartToSvg` + the 10-01 resvg decision. 10-05 (worker + ExportButtons + DEP) consumes `assembleHtml`. Browser spot-check of a real exported file is deferred to 10-05's human-verify checkpoint.

---
*Phase: 10-html-pptx-exports-deploy*
*Completed: 2026-05-18*
