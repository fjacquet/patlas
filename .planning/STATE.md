---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Proxmox-Native Views (Snapshot Sprawl, Storage Content, Cluster Health)
status: Shipped
stopped_at: v2.1.0 milestone CLOSED — three Proxmox-native views + .zip upload fix merged to main, tagged v2.1.0, live at https://fjacquet.github.io/patlas/
last_updated: "2026-06-24T00:00:00.000Z"
last_activity: 2026-06-24 — Milestone v2.1.0 completed and shipped
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 7
  completed_plans: 7
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-24 after v2.1.0 milestone)

**Core value:** A user drops a Proxmox VE report (`.zip` bundle or bare `.xlsx`) and walks away with a polished, shareable HTML report and PPTX deck describing their Proxmox estate — without uploading a single byte. The report is the product.
**Current focus:** None — v2.1.0 shipped & tagged (three Proxmox-native views: Snapshot Sprawl, Storage Content, Cluster Health; `.zip` upload fix). Start the next milestone with `/gsd-new-milestone`.

## Current Position

Phase: Milestone v2.1.0 complete
Plan: —
Status: Shipped — awaiting next milestone
Last activity: 2026-06-24 — v2.1.0 shipped: Snapshot Sprawl, Storage Content, Cluster Health views + .zip upload fix merged to main; app live at https://fjacquet.github.io/patlas/.

> **v2.1.0 (2026-06-24, branch `docs/proxmox-refresh`, merged to main):**
> Three Proxmox-native views: **Snapshot Sprawl** (guest snapshots on the
> estate — count, guests-with-snapshots, total size, oldest age; excludes the
> Proxmox `current` live-state marker), **Storage Content** (what occupies each
> storage by content type — images/rootdir/iso/vztmpl/backup — + backup-file
> inventory with per-guest recency), **Cluster Health** (HA quorum/fencing
> service state, HA-managed guest resources, scheduled backup jobs via
> `extractStackedSection` helper for composite Cluster sheets). All three are
> web-only (excluded from HTML report + PPTX deck). Also fixed the `.zip`
> upload bug (upload zone now accepts Proxmox `.zip` report bundles in addition
> to bare `.xlsx`). Inherited analytics relabeled to Proxmox; DR analysis
> removed.

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
- Stack: vatlas stack at 2026-05 versions + ECharts (SVG renderer, tree-shaken) + live-DOM HTML report serialization + fflate (zip extraction for Proxmox .zip bundles)
- Privacy: runtime fetch/XHR/WS/Beacon guard lands in Phase 1 before any feature is tempted to add telemetry
- Math: branded `MiB`/`GiB`/`GHz` types in Phase 1 make MB-is-MiB and MHz-vs-GHz bugs unrepresentable
- Cluster pivot: Proxmox cluster name (standalone node ⇒ implicit "proxmox" bucket); replaces multi-vCenter merge
- Guests = unified QEMU VMs + LXC containers with `guestType` flag; UI segments by type
- DR analysis dropped: no Proxmox analog in scope
- Three Proxmox-native views (v2.1.0) are web-only — excluded from HTML report + PPTX deck by design
- [Phase ?]: react-i18next 17 ships cleanly on TS 5.9 strict; v16 fallback not needed
- [Phase ?]: Vitest 4 + jsdom 29 + Node 26: jsdom needs explicit url + setup forwards localStorage from globalThis.jsdom.window
- [Phase ?]: FallbackError reads only error.name + error.message (never error.cause/stack/String) — hardened beyond vsizer's original
- [Phase ?]: Class-strategy dark mode (NOT data-theme) locked in plan 01-01
- [Phase ?]: Plan 02 privacy-guard import slot reserved as the first non-trivial line of src/main.tsx

### Pending Todos

None yet.

### Blockers/Concerns

- **UIX icons:** the `/Users/fjacquet/Projects/icons` `render_icon` MCP is not connected to the session. Enable it (`claude mcp add icons …` then restart) to swap hand-authored KPI icon placeholders for the icons-project exact set (deferred from v2.0).
- DE/IT technical terminology is pending native review before release (shipped 2026-05-25 across 18 namespaces).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260517-sdq | Fix 4 CodeRabbit PR#1 review findings: engine purity, EOS month math, fmtDate TZ, STATE.md | 2026-05-17 | 47422e4..6a0c7ec | [260517-sdq-fix-4-coderabbit-pr-1-review-findings-en](./quick/260517-sdq-fix-4-coderabbit-pr-1-review-findings-en/) |
| 260526-vj0 | Headline "used storage" → in-guest used (LiveOptics parity) + fallback to committed; keep inUseMib for storage treemap | 2026-05-26 | a11d963 | [260526-vj0-used-storage-guest-used-headline-kpi-to-](./quick/260526-vj0-used-storage-guest-used-headline-kpi-to-/) |

## Deferred Items

Items acknowledged and deferred at milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| uat | Consolidated Playwright browser UAT — PWA offline cold-boot (PWA-02) + web-layout visuals (installability already browser-confirmed) | open | v2.0 (2026-05-20) |
| ui | UIX-03 icons are hand-authored placeholders — swap for the icons-project render_icon exact set once that MCP is enabled | open | v2.0 (2026-05-20) |
| i18n | DE/IT technical terminology pending native review | open | v2.1.0 (2026-06-24) |

## Session Continuity

Last session: 2026-05-19T04:58:20.855Z
Stopped at: Phase 11 context gathered
Resume file: .planning/phases/11-report-and-deck-gap-closure-surface-phase-9-storage-network-/11-CONTEXT.md

## Operator Next Steps

- **Start the next milestone:** `/gsd-new-milestone`.
- Optional carry-forwards (deferred — see Deferred Items): consolidated Playwright UAT (offline cold-boot + web-layout visuals; installability already confirmed); swap UIX icons for the icons-project exact set; DE/IT native terminology review.
