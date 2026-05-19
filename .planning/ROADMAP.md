# Roadmap: vatlas

## Milestones

- ✅ **v1.0 RVTools Atlas (MVP)** — Phases 1–11 (shipped 2026-05-19) — full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ⏳ **v2.0 Offline-Capable, Redesigned, Better Deck** — Phases 12–18

## v2.0 — Offline-Capable, Redesigned, Better Deck

### Phase 18 — PPTX vsizer-parity rebuild + stretched UX (added 2026-05-19)

User found the deck "worthless / not on par with the website" vs the vsizer reference deck. Diagnosis: vatlas's pptx slide builders surface a fraction of the EstateView and lack vsizer's designed layout. Decision: port vsizer's proven slide design **brand-free** (vatlas UI-SPEC §Color — navy/gold/grey, NO verdict green/orange/red); make stretched-cluster handling as simple as vsizer's.

- [x] **18-01 Cluster slide** — rebuilt to vsizer parity (draw primitives, 5 KPI cards, CPU/RAM utilization blocks w/ peak + min/mean/max, KEY FIGURES banner, provenance footer, simple stretched suffix); slide-1 vCenter duplication fixed; cluster i18n EN/FR canonicalised. 502 green. `feat(18-01)`.
- [x] **18-02 Title slide + overview readability** — title rebuilt vsizer-style (eyebrow + big title + 5 navy KPI tiles); new `pptxMemMib` fixes overview's unreadable raw-MiB (now GiB/TiB). Visually verified via soffice render. `feat(18-02)`.
- [~] **18-03 Remaining slides** — Planned (Phase-16 headroom parity) + Storage (readable TiB + per-cluster table, dropped broken treemap) DONE & visually verified (`feat(18-03)`). Still: network (misleading all-zeros → factual "sheets absent"), dr (barren when no scenario → show stretched-cluster reservation summary), eos/inventory (functional but plain).
- [ ] **18-04 Stretched-management UX** — align the app-side stretched-cluster declaration to vsizer's simplicity (investigate vsizer's toggle vs vatlas `setStretchedClusters`/StretchedPill).
- Carry: regenerate a real deck and visually UAT vs the vsizer reference.

Plan: `~/.claude/plans/i-need-to-add-delightful-kahan.md` · Requirements: [REQUIREMENTS.md](REQUIREMENTS.md)

- [x] **Phase 12: Privacy governance — ADR-0001 SW exception + supply-chain gate** (GOV-01, GOV-02) — 2026-05-19
  - Goal: land the reviewable privacy-policy change (no app behavior change) before any SW code.
  - Success: `check:supply-chain` passes with the workbox allowlist; a `sw.ts` missing the guard import fails the gate; ADR-0001 + PITFALLS Critical-2 amended and consistent. ✓ (9/9 gate tests, tsc+biome green, commit `feat(12-01)`)
- [x] **Phase 13: Installable, fully-offline PWA** (PWA-01..04) — *depends on 12* — 2026-05-19
  - Goal: installable + works fully offline via an audited precache-only SW; updates never silently wipe a loaded estate.
  - Success: build emits `sw.js` + `manifest.webmanifest` (scope `/vatlas/`, 4 icons); SW guard-first + precache-only (no runtime route bundled); smart-update unit-tested; bundle-size + build + 494-suite green (commit `feat(13-01)`). ⚠ Offline hard-reload runtime UAT (Playwright, browser) still pending — structurally + gate + unit verified only.
- [x] **Phase 14: Navigation IA — right-side vertical menu** (NAV-01) — 2026-05-19
  - Goal: primary nav is a right rail before the drop zone, keyboard/ARIA preserved.
  - Success: right-side `<nav>` rail in the loaded layout; ViewToggle gains opt-in vertical orientation; keyboard/ARIA/role=group preserved; ViewToggle tests adapted + new vertical test; EN/FR unchanged; 495-suite + build green (commit `feat(14-01)`). ⚠ Visual placement UAT pending.
- [x] **Phase 15: Visual redesign — KPI tile system** (UIX-01, UIX-03; UIX-02 partial) — *depends on 14* — 2026-05-19
  - Goal: dashboard + cluster zoom become grouped icon/color KPI tiles matching the vsizer reference.
  - Success: StatTile/TileSection + same-origin inline-SVG icon set; GlobalSummaryCard + OperationalInsights + ClusterDetail refactored; values unchanged; 498-suite + key-parity + bundle-size + build green (commit `feat(15-01)`). ⚠ UIX-02 partial: ClusterColumn intentionally deferred (already gauge-rich, risk trim). Icons are hand-authored placeholders — swap via the icon prop once the icons-MCP exact set is vendored. Visual UAT pending.
- [x] **Phase 16: Capacity Planning visual return** (PLN-01) — 2026-05-19
  - Goal: changing the planned ratio shows a measured-vs-planned headroom visualization.
  - Success: StatTiles + bar Chart (measured vs planned vCPU/vRAM capacity vs allocated demand, gold markLine) from existing view.globals/plannedView; render-time reduce, no new memo; panel reordered under the ratio control; EN/FR; no editorial verbs; 500-suite + build + bundle green (commit `feat(16-01)`). Visual UAT pending.
- [x] **Phase 17: PPTX quality overhaul** (PPT-01, PPT-03; PPT-02 partial) — 2026-05-19
  - Goal: crisp/correctly-sized deck charts + dense factual brand-free text.
  - Success: print-grade 1600×900 render + `sizing:'contain'` (no stretch) for ALL charts; overview+cluster slides gain a factual KPI row of the dropped facts; builder/chartSvg tests assert it; 502-suite + golden structural + build + bundle green; brand-free intact (commit `feat(17-01)`). ⚠ PPT-02 partial: only overview+cluster enriched (the screenshotted sparse slides); eos/dr/trends/inventory/network/storage/planned/contention enrichment is follow-up. Visual deck UAT pending.

## Phases

<details>
<summary>✅ v1.0 RVTools Atlas (MVP) — Phases 1–11 — SHIPPED 2026-05-19</summary>

- [x] Phase 1: Foundation & Invariants (5/5) — 2026-05-15
- [x] Phase 2: Aggregation & Global Dashboard (3/3) — 2026-05-16
- [x] Phase 3: Inventory Navigation (3/3) — 2026-05-16
- [x] Phase 4: Multi-vCenter Merge & Factual Labels (2/2) — 2026-05-17
- [x] Phase 5: Rich Cluster / Host / ESX Intelligence (2/2) — 2026-05-17
- [x] Phase 6: Allocation & DR (re-derived) (3/3) — 2026-05-17
- [x] Phase 7: OS End-of-Support Forecast (3/3) — 2026-05-17
- [x] Phase 8: In-Session Trends (3/3) — 2026-05-17
- [x] Phase 9: Storage / Network / Detailed Views + Threshold Alerting (5/5) — 2026-05-18
- [x] Phase 10: HTML + PPTX Exports & Deploy (5/5) — 2026-05-18
- [x] Phase 11: Report & deck gap closure — v1.0 audit F-2/F-1 (6/6) — 2026-05-19

</details>

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 RVTools Atlas (MVP) | 1–11 | 43/43 | ✅ Complete — released & deployed | 2026-05-19 |
| v2.0 Offline-Capable, Redesigned, Better Deck | 12–17 | 6/6 | ✅ Code-complete (UAT + audit pending) | — |

Full v1.0 phase detail (goals, success criteria, requirements, pitfalls) is archived in [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md). Requirements archived in [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md). Audit: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md).

---
*v1.0 shipped 2026-05-19. v2.0 — all 6 phases (12–17) code-complete 2026-05-19: governance/ADR SW exception, offline PWA, LEFT vertical nav (user-revised from right), KPI-tile redesign, Capacity Planning visual return, PPTX overhaul. 502 tests + tsc/biome/gate/bundle/build green. Pending before milestone close: (1) Playwright visual+offline UAT (Phases 13–17), (2) milestone audit, (3) follow-up polish — ClusterColumn tiles (UIX-02), PPT-02 remaining slides, icons-MCP exact-set swap.*
