---
phase: 07-os-end-of-support-forecast
plan: 02
subsystem: testing
tags: [eos, normalizer, esxi, lifecycle-bucketing, tdd, pure-engine]

requires:
  - phase: 07-01
    provides: EosCatalogue type + parse-once boundary (passed as a parameter)
provides:
  - normalizeOs — pure RVTools-OS → {slug,version}|null regex bank (composes classifyOsFamily)
  - classifyEsxi — pure vhost.esxVersion → major EOL; patch always null sentinel
  - buildEosProjection — pure disjoint partition + reconciliation + rawUnknown + esxi split
  - REAL_OS_STRINGS / REAL_ESX_VERSIONS harvested fixture (66 distinct strings)
  - EosProjection / EosRow / EsxiHostRow / EosBucketKey types
affects: [07-03 wires buildEosProjection into buildEstateView + the EosView presenter]

tech-stack:
  added: []
  patterns:
    - "Pure Zod-free engines receive the typed catalogue + injected today as parameters"
    - "Disjoint partition is the reconciliation source; cumulative is a derived display overlay"

key-files:
  created:
    - src/engines/eos/fixtures/real-os-strings.ts
    - src/engines/eos/normalizeOs.ts
    - src/engines/eos/normalizeOs.test.ts
    - src/engines/eos/classifyEsxi.ts
    - src/engines/eos/classifyEsxi.test.ts
    - src/engines/eos/bucketEos.ts
    - src/engines/eos/bucketEos.test.ts
  modified: []

key-decisions:
  - "D-06/D-10: disjoint 7-way partition reconciles exactly to vinfo.length; unknown is a first-class peer"
  - "D-07: today is an injected Date param; bucketer is clock-free (Date.UTC/Date.parse only)"
  - "D-12: normalizeOs whitespace-normalizes for matching only; raw string preserved verbatim by the caller"
  - "D-09b: ESXi hosts classified into a separate esxi sub-structure; host counts never summed into the VM partition"
  - "EOS-05/A4: <5% unknown is occurrence-weighted (user-confirmed); per-distinct fixture asserts the honest unknown long-tail partition"
  - "Multi-version (CentOS 4/5/6/7) + versionless + nested-ESXi-guest strings → first-class unknown, never force-fit (Pitfall 3/6, D-00)"

patterns-established:
  - "Pattern: EOS engines compose osFamily.ts (DRY) and stay pure/Zod-free, catalogue passed in"

requirements-completed: [EOS-01, EOS-02, EOS-04, EOS-05]

duration: 50min
completed: 2026-05-17
---

# Phase 7 Plan 02: Pure EOS Engines (TDD) Summary

**Three pure, Zod-free, test-first engines — an OS-string regex bank, an ESXi major-EOL classifier, and a disjoint lifecycle bucketer that reconciles exactly to the entity total with first-class unknown + verbatim raw-string capture.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3 completed (TDD RED→GREEN each, 6 commits)
- **Files modified:** 7 created

## Accomplishments

- `normalizeOs.ts` — slug regex bank; RHEL-8×4 + Oracle-Linux×3 resolve; multi-version/versionless/nested-ESXi-guest → null (first-class unknown, D-10/D-12); composes `classifyOsFamily` (DRY).
- `classifyEsxi.ts` — `vhost.esxVersion` → major EOL from catalogue; `patchEol` always `null` (v1 has no patch EOL — D-09c/Pitfall 1); never reads VM guest-OS (D-09a/b).
- `bucketEos.ts` — `buildEosProjection({vinfo,vhost,catalogue,today})`: disjoint 7-bucket partition summing to `vinfo.length` (D-06/D-10); injected clock-free `today` (D-07/Pitfall 4); verbatim occurrence-counted `rawUnknown` (D-11/D-12); cumulative derived from partition; ESXi split by kind (D-09b); standard-EOL-only (D-04).
- `fixtures/real-os-strings.ts` — 66 harvested distinct strings + 4 real ESX versions.
- 25 eos test cases green; `tsc --noEmit` clean; whole-repo Biome clean (177 files).

## Deviations from Plan

**[Rule 4 - Spec ambiguity, escalated & user-resolved] EOS-05 / criterion-5 "<5% unknown" metric** — Found during: Task 1 (writing the <5% assertion) | Issue: the plan's literal "unknown rate <5% **per-distinct-string** on the 50+ fixture" is unsatisfiable by construction — `REAL_OS_STRINGS` deliberately over-represents the unknown long tail (~24 of 66) to exercise the D-10/D-11 unknown bucket; RESEARCH open question A4 itself frames the 5% as occurrence-weighted. Self-contradictory plan text vs its own fixture. | Resolution: paused Task 1, presented the conflict; user chose **occurrence-weighted (RESEARCH A4)**. Implemented two assertions: (a) an occurrence-weighted realistic-estate distribution <5% unknown, (b) a per-distinct partition assertion that the expected-unknown set is exactly the honest long tail (nothing matchable silently unknown, nothing force-fit). | Verification: both assertions green in `normalizeOs.test.ts` | Commits: 07-02 RED/GREEN Task 1.

**[Rule 1 - Adjustment] Grep-gated doc-comment rewording** — `grep -c`==0 acceptance gates for `osConfig|osTools` (classifyEsxi), `new Date(` (bucketEos), and `eoesFrom|isEoes` tripped on doc-comments naming the tokens to document their deliberate absence. Comments reworded; zero behavior/scope change.

**Total deviations:** 2 (1 spec ambiguity escalated to user per "replan on spec drift", 1 comment reword). **Impact:** none on scope; EOS-05 metric now has an explicit user-blessed definition.

## Verification

- `npx vitest run src/engines/eos` → PASS 25/0
- `npx @biomejs/biome check .` → 177 files, no errors
- `npx tsc --noEmit` → No errors found
- `grep -c "from 'zod'"` on normalizeOs/classifyEsxi/bucketEos → 0 each (pure)
- `grep -c "new Date(" bucketEos.ts` → 0 (today injected, Pitfall 4)
- EOS-06 coverage (`src/engines/eos` aggregate): lines 100% · funcs 100% · branch 79.66% · stmts 95.45% (≥75% gate met; `normalizeOs` per-file branch 66.66% is within the aggregate `src/engines/**` gate as the plan specifies — not an individual-file gate)

## Issues Encountered

None blocking. Note: `normalizeOs.ts` per-file branch coverage (66.66%) sits below 75% in isolation; the project gate is the aggregate `src/engines/**` include (eos aggregate 79.66%, whole-engines higher) — within spec per the plan/RESEARCH "auto-gated by the existing include". Flagged for optional follow-up if per-file gating is ever introduced.

## Next Phase Readiness

Ready for 07-03 — `buildEosProjection` + `classifyEsxi` are the engine inputs the EstateView single-pass wiring and the `EosView` presenter consume.

## Self-Check: PASSED
