---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Offline-Capable, Redesigned, Better Deck
status: Awaiting next milestone
stopped_at: v2.0 milestone CLOSED — archived (ROADMAP/REQUIREMENTS/audit → milestones/), PROJECT evolved, tagged v2.0
last_updated: "2026-05-20T12:20:00.000Z"
last_activity: 2026-05-20 — Milestone v2.0 completed and archived
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 7
  completed_plans: 7
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-20 after v2.0 milestone)

**Core value:** A user drops a RVTools workbook and walks away with a polished, shareable HTML report and PPTX deck describing their VMware estate — without uploading a single byte. The report is the product.
**Current focus:** None — v2.0 shipped & tagged (installable offline PWA, redesigned UI, vsizer-grade deck). Start the next milestone with `/gsd-new-milestone`.

## Current Position

Phase: Milestone v2.0 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-05-25 — out-of-milestone Right-sizing + Monster-VM extracts shipped on `feat/vm-rightsizing-stress`.

> **Out-of-milestone (2026-05-25, branch `feat/vm-rightsizing-stress`, via the
> superpowers spec/plan flow — `docs/superpowers/`):** shipped two new
> analytics extracts — **Right-sizing** (oversized/undersized/stressed from
> RVTools `vMemory`+`vCPU`) and **Monster VMs** (largest by configured vCPU/
> vRAM). New parser sheets → `VmUsageRow`; `sizing.ts`/`monsterVm.ts` engines;
> `sizingThresholds`/`monsterThresholds` store slices; `RightSizingView`/
> `MonsterVmView` + two native PPTX slides; en+fr i18n. Full gate green (545
> tests, `sizing.ts` 100%). Pending: app-wide `de`+`it` localization (Plan 2 —
> `docs/superpowers/plans/2026-05-25-de-it-localization.md`). Fold into a new
> GSD milestone when convenient.

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01 | 26min | 3 tasks | 30 files |
| Phase 01 P02 | 24min | 3 tasks | 8 files |
| Phase 01 P03 | 22min | 3 tasks | 12 files |
| Phase 01 P04 | 35min | 3 tasks | 27 files |
| Phase 02 P01 | 14min | 2 tasks | 9 files |
| Phase 02 P02 | 60 | 2 tasks | 30 files |
| Phase 02 P03 | 24min | 3 tasks | 16 files |
| Phase 03 P01 | 38min | 3 tasks | 12 files |
| Phase 03 P03 | 50min | 3 tasks | 10 files |
| Phase 06 P01 | 22min | 3 tasks | 12 files |
| Phase 06 P02 | 14min | 3 tasks | 9 files |
| Phase 06 P03 | ~28min | 3 tasks | 5 files |
| Phase 07 P01 | 35min | 3 tasks | 7 files |
| Phase 07 P02 | 50min | 3 tasks | 7 files |
| Phase 07 P03 | 95min | 3 tasks | 16 files |
| Phase 08 P01 | 38min | 3 tasks | 14 files |
| Phase 08 P02 | 22min | 3 tasks | 5 files |
| Phase 08 P03 | 41min | 4 tasks | 18 files |

## Accumulated Context

### Roadmap Evolution

- Phase 11 added: Report and deck gap closure (v1.0 audit F-2/F-1): Phase 9 analytics into HTML report + PPTX deck; resolve dead plannedView; reconcile traceability

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 7 phases under horizontal-layers structure (Foundation → Aggregation → Inventory → Analytics Core → EOS → Trends → Exports+Deploy)
- Stack: vsizer's stack at 2026-05 versions + ECharts (SVG renderer, tree-shaken) + live-DOM HTML report serialization
- Privacy: runtime fetch/XHR/WS/Beacon guard lands in Phase 1 before any feature is tempted to add telemetry
- Math: branded `MiB`/`GiB`/`GHz` types in Phase 1 make MB-is-MiB and MHz-vs-GHz bugs unrepresentable
- Multi-vCenter: keyed on `(VI SDK UUID, vm_bios_uuid)`, never silent merge on names — lands in Phase 4
- [Phase ?]: react-i18next 17 ships cleanly on TS 5.9 strict; v16 fallback not needed
- [Phase ?]: Vitest 4 + jsdom 29 + Node 26: jsdom needs explicit url + setup forwards localStorage from globalThis.jsdom.window
- [Phase ?]: FallbackError reads only error.name + error.message (never error.cause/stack/String) — hardened beyond vsizer's original
- [Phase ?]: Class-strategy dark mode (NOT data-theme) locked in plan 01-01
- [Phase ?]: Plan 02 privacy-guard import slot reserved as the first non-trivial line of src/main.tsx
- [Phase ?]: 06-03: DrSimPanel reworked to two-mode physical-impact (Server stepper + Site picker + lost line), Custom-Failover in-panel toggle, no confidence; wired into PlanningView. Phase 6 COMPLETE.

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 15 BLOCKED on user action:** the `/Users/fjacquet/Projects/icons` `render_icon` MCP is not connected to the session. Enable it (`claude mcp add icons …` then restart) so the exact KPI icon set can be vendored into `src/components/icons/`. Icon-agnostic structure (StatTile/TileSection + 4-component refactor) can proceed first if desired; icons drop into the slot after.
- Phase 1 must harvest 4+ real RVTools workbooks (one per generation: 3.10, 3.11, 4.0, 4.4) from `~/Downloads/`, `~/Library/CloudStorage/OneDrive-Home/`, and `vsizer/public/samples/rvtools-sample.xlsx` to lock in column-alias dictionary and MB-is-MiB canary
- Phase 4 must verify whether RVTools `vCluster` exposes host fault-domain or site tag in current versions (if not, engine surfaces `confidence: 'medium'` with "assumed symmetric" chip)
- Phase 5 needs research pass: OS-naming-variant matrix (harvest 50+ real OS strings; assert <5% unknown-OS rate) and `endoflife.date` v1 API Beta schema stability
- Phase 7 needs research pass: HTML-report font-embedding mechanism (subset selection, corporate-VPN CSP proxy testing, file:// vs http:// vs proxy rendering)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260517-sdq | Fix 4 CodeRabbit PR#1 review findings: engine purity, EOS month math, fmtDate TZ, STATE.md | 2026-05-17 | 47422e4..6a0c7ec | [260517-sdq-fix-4-coderabbit-pr-1-review-findings-en](./quick/260517-sdq-fix-4-coderabbit-pr-1-review-findings-en/) |

## Deferred Items

Items acknowledged and deferred at milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| uat | Consolidated Playwright browser UAT — PWA offline cold-boot (PWA-02) + web-layout visuals (installability already browser-confirmed) | open | v2.0 (2026-05-20) |
| pptx | DR slide bare when no scenario — optional stretched-cluster reservation summary | open | v2.0 (2026-05-20) |
| ui | UIX-03 icons are hand-authored placeholders — swap for the icons-project render_icon exact set once that MCP is enabled | open | v2.0 (2026-05-20) |

## Session Continuity

Last session: 2026-05-19T04:58:20.855Z
Stopped at: Phase 11 context gathered
Resume file: .planning/phases/11-report-and-deck-gap-closure-surface-phase-9-storage-network-/11-CONTEXT.md

## Operator Next Steps

- **Start the next milestone:** `/gsd-new-milestone`.
- Optional carry-forwards (deferred at v2.0 close — see Deferred Items): consolidated Playwright UAT (offline cold-boot + web-layout visuals; installability already confirmed); DR bare-slide stretched summary; swap UIX icons for the icons-project exact set. Reference deck for the PPTX bar: vsizer `~/Downloads/RVTools_export_all_2026-01-07_10_23_35_vsizer.pptx`.
