---
phase: 04-multi-vcenter-stretched-allocation-dr
plan: 05
subsystem: aggregation
tags: [stretched, factual-site-data, g1, i18n, requirements, replan]

requires:
  - phase: 04-01
    provides: validated multi-vCenter merge engine spine + per-site reservation math (kept unchanged)
provides:
  - "factual ClusterAggregate.siteData ('detected'|'assumed') replacing the rejected stretchedConfidence verdict"
  - "neutral ClusterColumn caption (no confidence verdict, no chip); per-site rows only when detected"
  - "estate-level 'N clusters marked stretched' factual line"
  - "REQUIREMENTS.md: one factual STR-03, STR-04 retired; vSAN/networks→P9 forward note"
affects: [05-rich-intelligence, 06-allocation-dr, 09-storage-network]

tech-stack:
  added: []
  patterns:
    - "Stretched = user declaration; engine reports site provenance FACTUALLY, never a high/med/low judgement (UAT G1)"
    - "Relabel-only refactor: reservation fraction math byte-identical, proven by the unchanged matrix numbers"

key-files:
  created: []
  modified:
    - src/types/estate.ts (drop StretchedConfidence; add siteData 'detected'|'assumed')
    - src/engines/aggregation/aggregateClusters.ts (reservationFor returns siteData; math unchanged)
    - src/engines/aggregation/aggregateClusters.test.ts (matrix asserts siteData; numbers unchanged)
    - src/engines/aggregation/globals.test.ts (fixture field)
    - src/components/stretched/StretchedPill.tsx (LowConfidenceChip deleted)
    - src/components/dashboard/ClusterColumn.tsx (factual caption; rows only when detected)
    - src/components/dashboard/GlobalDashboard.tsx (estate "N clusters marked stretched")
    - src/i18n/locales/en/str.json, src/i18n/locales/fr/str.json (siteData.*/stretched.estateCount; parity 8/8)
    - .planning/REQUIREMENTS.md (STR-03 reworded; STR-04 removed; P9 forward note)

key-decisions:
  - "siteData enum: 'detected' = all hosts tagged + ≥2 fault domains (real split); 'assumed' = partial OR none (symmetric 0.5). partial/none distinction dropped per G1 (no judgement)"
  - "Reservation math NOT touched — only the discriminator label changed; matrix numbers identical"

patterns-established:
  - "Factual provenance over judgement: the engine states where a value came from, never rates the user's declaration"

requirements-completed: [STR-01, STR-02, STR-03]

duration: ~1 session (inline)
completed: 2026-05-17
---

# Phase 4 Plan 05: G1 Stretched Rework — Summary

**The rejected auto confidence verdict + low-confidence chip are gone; a factual `siteData` ('detected'/'assumed') now drives a neutral caption — the engine reports where the per-site split came from and never judges the user's stretched declaration. Reservation math is provably unchanged (matrix numbers identical; real-file `CL_VXB1K_CORE` still 0.5).**

## Performance

- **Completed:** 2026-05-17
- **Tasks:** 2 of 2 (executed inline, no subagent — per user preference)
- **Files modified:** 9

## Accomplishments

- `StretchedConfidence` type + `stretchedConfidence` field removed; `ClusterAggregate.siteData: 'detected' | 'assumed'` added. `reservationFor()` fraction/site math **byte-identical** — the full matrix (4+4/6+4-tagged/6+4-untagged/partial/8+0/2+2/CL_VXB1K_CORE) passes with the **same reservedFraction/drReservedGhz/per-site numbers**, only the discriminator label changed (20/20).
- `LowConfidenceChip` deleted. `ClusterColumn`: detected → Site A/B rows + Reservation % + neutral "site data: detected"; assumed → Reservation % + "symmetric split assumed (no site data)", **no Site A/B, no chip, no verdict**.
- `GlobalDashboard`: neutral estate line **"N clusters marked stretched"** (from the store Set, no second `useMemo`).
- `str` i18n EN/FR reworked (`siteData.*`, `stretched.estateCount`; `confidence.*`/`lowConfidence.chip` removed) — parity 8/8.
- `REQUIREMENTS.md`: single factual STR-03; STR-04 line + tracking row removed; vSAN/networks→P9 forward note.
- Full suite **305/305**; tsc clean; biome clean; single-`useMemo`=2 (intact); supply-chain + bundle green.

## Task Commits

1. **Task 1: factual siteData replaces confidence (engine+types+tests)** — `feat(04-05)`
2. **Task 2: caption + drop chip + estate count + str i18n + REQUIREMENTS** — `feat(04-05)`

## Real-File UAT (mandatory — feedback_real_file_uat)

Throwaway harness vs real `allvCenters.xlsx` (deleted; never committed):

- ✅ `CL_VXB1K_CORE` (fault-domain tagged) → `siteData: 'detected'`, `reservedFraction 0.5`, Site A/B = 211.2 GHz each (real split).
- ✅ An untagged cluster → `siteData: 'assumed'`, `reservedFraction 0.5`, Site A `null` (→ "symmetric split assumed", no Site A/B).
- ✅ No `stretchedConfidence` field present on the aggregate.
- ✅ Reservation `0.5` matches the prior 04-02 real-file result — math provably intact.
- Note: the harness flags an arbitrary low-fault-domain cluster stretched purely to exercise the 'assumed' engine path; it does NOT assert any real cluster's stretched status (the user owns that ground truth — `no-domain-guesses-in-uat`).

## Deviations from Plan

- **Single-useMemo grep:** standing note as in prior plans — literal grep matches comments + the pre-existing P1 `SnapshotListSidebar` memo; actual `useMemo(` call sites remain exactly 2. Estate line derives from the store Set inline, no new memo.
- Plan split into Task1/Task2 commits; Task-1 `tsc` was transiently red (ClusterColumn still on the old field until Task 2) — verified Task-1 logic via per-file vitest, full `tsc` green after Task 2. No scope change.
- Test `it()` description strings still say "confidence low/medium" in a couple of matrix cases (cosmetic; assertions are correct on `siteData`). Left as-is — not worth churn.

**Total deviations:** 1 standing, 1 sequencing note, 1 cosmetic. No scope creep.

## Issues Encountered

None — clean relabel-refactor; the kept engine math made this low-risk and the unchanged matrix numbers prove no regression.

## User Setup Required

None.
