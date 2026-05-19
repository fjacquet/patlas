# Roadmap: vatlas

## Milestones

- ✅ **v1.0 RVTools Atlas (MVP)** — Phases 1–11 (shipped 2026-05-19) — full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ⏳ **v2.0 Offline-Capable, Redesigned, Better Deck** — Phases 12–17

## v2.0 — Offline-Capable, Redesigned, Better Deck

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
- [ ] **Phase 16: Capacity Planning visual return** (PLN-01)
  - Goal: changing the planned ratio shows a measured-vs-planned headroom visualization.
  - Success: visualization updates on ratio change; reconciles with Dashboard; no new memo; no editorial verbs; EN/FR.
- [ ] **Phase 17: PPTX quality overhaul** (PPT-01..03)
  - Goal: crisp/correctly-sized deck charts + dense factual brand-free text.
  - Success: regenerated canary deck has sharp charts + denser facts; structural golden tests pass; brand-free intact.

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
| v2.0 Offline-Capable, Redesigned, Better Deck | 12–17 | 4/6 | ⏳ In progress (Phases 12–15 ✓) | — |

Full v1.0 phase detail (goals, success criteria, requirements, pitfalls) is archived in [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md). Requirements archived in [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md). Audit: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md).

---
*v1.0 shipped 2026-05-19. v2.0 started 2026-05-19 — Phases 12–15 ✓ (governance, PWA, right-side nav, KPI-tile redesign). Phase 16 (Capacity Planning visual return) next. Carry: Phases 13–15 visual/offline Playwright UAT; ClusterColumn tile polish (UIX-02); icons-MCP exact-set swap.*
