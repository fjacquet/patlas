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

## Milestone: v2.0 — Offline-Capable, Redesigned, Better Deck

**Shipped:** 2026-05-20
**Phases:** 7 (12–18, executed inline) · **Commits:** 30 · **Changes:** 63 files, +9,296/−2,090 · **Tests:** 506/80 files

### What Was Built
Installable, fully-offline PWA under an audited ADR-0001 service-worker exception (guard-first, precache-only); one-left-column KPI-tile dashboard with a scannable cluster table + central stretched toggles; Capacity Planning measured-vs-planned headroom visual; PPTX deck rebuilt to vsizer parity (brand-free, all charts native pptxgenjs, fully labeled).

### What Worked
- **Catching the ADR conflict before coding** — the brainstorm-then-check habit surfaced that service workers were forbidden by an Accepted ADR *before* any PWA code, turning a silent violation into a deliberate, governed amendment.
- **Render-and-look verification** — once the PPTX was rendered (`soffice → PDF → Read`) instead of judged by tests, every real defect (missing chart text, ugly raw MiB, broken treemap block) became obvious and fixable. This is now a saved practice.
- **Native pptxgenjs over rasterized charts** — sidestepped the resvg-no-font root cause entirely and made every deck label reliable.
- **vsizer as the concrete reference** — reading the sibling's proven slide builders + comparing decks beat guessing.

### What Was Inefficient
- Several PPTX rounds shipped before the deck was rendered/looked-at — the "tests pass but it's worthless" gap. Multiple partial passes (sparse-text fixes, gauge tweaks) preceded the actual fix (native charts + the render loop). Earlier visual verification would have collapsed ~4 rounds into one.
- Right-then-left nav churn (docx said "right", user wanted left) — a quick confirm would have saved a flip.
- A test-file collection bug (`new URL(import.meta.url)` in pwa-sw.test) sat latent until the milestone audit caught it.

### Patterns Established
- **Deck visuals = native pptxgenjs shapes+text**, never rely on rasterized-chart text ([[project_pptx_resvg_no_font]]).
- **Verify visual artifacts by rendering** ([[feedback_verify_deck_visually]]).
- **Govern, don't waive, invariant exceptions** — the SW exception extends the privacy model (guard inside the SW) rather than poking a hole, and is CI-enforced.

### Key Lessons
- For any visual deliverable, render and look before claiming done — tests/text-extraction miss layout, density, readability, and missing-in-raster text.
- When a foundational ADR blocks a requested feature, stop and amend it deliberately (with the user) — never route around the gate.

### Cost Observations
- Model mix: predominantly opus (inline execution, no executor subagents per user preference).
- Sessions: 1 long continuous session.
- Notable: inline execution kept the user tightly in the visual-feedback loop (many short "look at this deck" iterations) — high-touch but it's what converged the deck to acceptable. The cost was a very long single session and several pre-render rounds that a render-first habit would have avoided.

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
