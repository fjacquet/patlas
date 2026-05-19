# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — RVTools Atlas (MVP)

**Shipped:** 2026-05-19
**Phases:** 11 | **Plans:** 43 | **Sessions:** multi (final close in one long session)

### What Was Built
- 100% client-side RVTools→atlas: parser-in-Web-Worker, throwing privacy guard (no byte leaves the browser), branded MiB/GHz units, immutable Zustand snapshot store, single `useEstateView` memo bridging store→UI/exports.
- Full analytic surface: global dashboard, virtualized inventory (tree + sortable/filterable tables + CSV), multi-vCenter merge, stretched-cluster factual site data, calculated allocation ratios, server/site DR physical-impact sim, rich per-cluster/host operational insights, OS End-of-Support forecast, in-session multi-snapshot trends, storage/network/threshold-alerting detailed views with vSAN relink.
- "The report is the product": shareable self-contained **HTML report** + themed bilingual **PPTX deck** (Midnight Executive, real ECharts SVG rasterized via resvg-wasm), GitHub Pages CI deploy at fjacquet.github.io/vatlas/.

### What Worked
- The GSD verify-loop caught real value gaps: the v1.0 audit returned `gaps_found` (F-2: an entire shipped phase invisible in the deliverable; F-1: a dead view-model) — Phase 11 closed both, re-audit `passed`. Without the audit, v1.0 would have shipped with Phase 9 absent from "the product".
- Inline plan execution (per the user's standing instruction — no gsd-executor) gave visible, steerable progress; atomic per-task commits made the destructive-ROADMAP recovery clean.
- Pattern-mapper before planning produced execution-ready plans with concrete analog file:line refs — Phase 11's 14 tasks needed zero architectural guesswork.

### What Was Inefficient
- **`tsc -b` ≠ the canonical CI gate.** Used `npx tsc -b` as the type gate for Phase 11; CI runs `npm run typecheck` (`tsc --noEmit && tsc --noEmit -p tsconfig.test.json`), which caught `noUncheckedIndexedAccess` errors in a test file that `tsc -b` did not. Result: **every Phase 11 push was CI-red and undeployed** until caught at milestone close. Cost: a deploy-fix cycle + an overstated "CI green" claim.
- The GSD SDK destructively overwrote `ROADMAP.md` to a 14-line stub (planner / `roadmap.update-plan-progress`); recovery required restoring 282 lines from git and manual reconciliation. STATE counters were also miscounted by `state.update-progress` (1/1/100% vs actual 11/11).
- Criterion-proxy imprecision recurred across plans (`grep -c` counts lines not occurrences; the absence-comment grep-gate trips on doc-comments naming a forbidden token) — documented in CLAUDE.md yet still tripped each time, costing per-task rework.

### Patterns Established
- Engines pure & Vitest-gated; components thin single-`useEstateView` prop-consumers (no second memo, no `@/engines` import) — held across 11 phases including the Phase 11 additions.
- Export = pure `buildExportView` (active snapshot, active locale), ECharts SVG inlined for HTML / resvg-rasterized for PPTX; slide modules compose only `_layout.ts` primitives.
- i18n: every key in EN+FR, recursive key-parity CI gate; collision-free dotted paths across `report.json`/`pptx.json` (prefix-less flatten).
- Factual-only invariant (no editorial verbs; gold marker, never traffic-light) enforced by string-lint + acceptance greps.

### Key Lessons
1. **Run the project's canonical gate, not a substitute.** `npm run typecheck` (the script CI runs), never `tsc -b`. Verify CI is actually green after pushing — don't infer "green" from a local proxy.
2. **Don't trust GSD SDK roadmap/state mutations to preserve this repo's ROADMAP/STATE format.** After plan/execute, check `wc -l .planning/ROADMAP.md`; recover from git + manually reconcile. (Memorialized.)
3. **The milestone audit earns its keep.** A `gaps_found` that forces a closure phase before close is the system working — "the report is the product" gap (F-2) would otherwise have shipped.
4. CLAUDE.md gotchas (grep-gate counts lines/comments) are real and recurring — phrase absence comments without the literal token; treat `grep -c` criteria as line-proxies and verify the true invariant.

### Cost Observations
- Model mix: predominantly opus (orchestration + inline execution + subagent researchers/integration-checkers on opus); sonnet for plan-checker (disabled this project).
- Sessions: the close ran in one very long continuous session (context auto-compacted).
- Notable: subagents (pattern-mapper, integration-checker ×2, planner) protected the main context; inline execution kept the user in the loop at the cost of a long single session.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | multi | 11 | First milestone — established GSD discuss→plan→execute→audit loop; added a gap-closure phase (11) from the audit; inline-execution mode adopted per user preference |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 484 | engines ≥75% gated | resvg-wasm only net-new export dep; HTML report = zero new runtime deps (renderToStaticMarkup) |

### Top Lessons (Verified Across Milestones)

1. (v1.0) Use the canonical CI gate locally; verify CI actually green post-push — local proxies (`tsc -b`) can diverge from `npm run typecheck`.
2. (v1.0) The milestone audit catches deliverable-value gaps that phase-level work misses ("the report is the product" only true once F-2 closed).
