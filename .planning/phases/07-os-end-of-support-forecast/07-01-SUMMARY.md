---
phase: 07-os-end-of-support-forecast
plan: 01
subsystem: infra
tags: [zod, endoflife.date, eos, ci, build-time-data]

requires:
  - phase: 02-aggregation
    provides: engines-stay-pure / Zod-only-at-boundary precedent (parser/schemas.ts)
provides:
  - Committed, Zod-validated endoflife.date snapshot (src/engines/eos/catalogue.json, 11 products)
  - EosCatalogueSchema + EosCatalogue type — the single zod importer under src/engines/eos/
  - loadEosCatalogue() parse-once boundary
  - npm run sync:eos maintainer fetcher (fail-closed, off the deploy path)
  - Warn-only CI freshness step (>90d ::warning::, never blocks)
affects: [07-02 engines consume EosCatalogue, 07-03 EstateView wiring + freshness UI]

tech-stack:
  added: []
  patterns:
    - "Zod only at the catalogue boundary (mirrors parser/schemas.ts)"
    - "Build-time third-party data: maintainer sync script decoupled from the CI deploy"

key-files:
  created:
    - src/engines/eos/catalogueSchema.ts
    - src/engines/eos/catalogue.ts
    - src/engines/eos/catalogue.json
    - src/engines/eos/catalogue.test.ts
    - scripts/sync-eos.mjs
  modified:
    - package.json
    - .github/workflows/static.yml

key-decisions:
  - "D-01: catalogue is a static import Zod-validated once at catalogue.ts; zero runtime fetch"
  - "D-02: sync:eos fail-closed (non-zero, no write); CI freshness is exit-0 warn-only — outage never blocks deploy"
  - "D-04: single standard-support EOL model — no paid-tier fields in schema, snapshot, or sync projection"

patterns-established:
  - "Pattern: EOS catalogue boundary = the parser-schema boundary applied to bundled third-party data"

requirements-completed: [EOS-06]

duration: 35min
completed: 2026-05-17
---

# Phase 7 Plan 01: EOS Catalogue Spine Summary

**Build-time endoflife.date catalogue: a committed, Zod-validated 11-product snapshot with a single parse-once boundary, a fail-closed maintainer sync script, and a warn-only CI freshness gate that structurally decouples the deploy from third-party uptime.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 completed
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- `catalogueSchema.ts` — `EosCatalogueSchema` (Release/Product/EosCatalogue), the sole `zod` importer under `src/engines/eos/`; single standard-EOL model, no paid-tier fields (D-04).
- `catalogue.ts` — `loadEosCatalogue()` parses the committed JSON once at module scope (D-01).
- `catalogue.json` — synced live from endoflife.date v1 (11 products: esxi, rhel, oracle-linux, windows-server, windows, centos, debian, ubuntu, sles, almalinux, rocky-linux; `lastVerified` 2026-05-17; ESXi 8.0→2027-10-11, 7.0→2025-10-02).
- `scripts/sync-eos.mjs` + `sync:eos` npm script — bare-Node fetcher, fail-closed on any error without writing (D-02).
- `.github/workflows/static.yml` — warn-only freshness step (after type-check, before lint/build); zero network, unconditional `exit 0` (D-02, Pitfall 5).
- 8 catalogue tests pass; whole-repo Biome clean.

## Deviations from Plan

**[Rule 1 - Bug] Pre-existing CI lint failure (out of scope, user-approved fix)** — Found during: gh actions check requested by user mid-Task-1 | Issue: `.planning/tmp/docs-work-manifest.json` failed the Biome lint step on the branch (1 error), failing all CI runs — unrelated to Phase 7, pre-existing at session start | Fix: `biome check --write` on the manifest, committed separately as `chore:` (commit `ef45f15`) after explicit user approval | Verification: `biome check .` now clean (171 files) | Commit: ef45f15

**[Rule 1 - Adjustment] Doc-comment rewording for grep-gated acceptance criteria** — The acceptance gates assert `grep -c` == 0 for `eoesFrom|isEoes|eoasFrom` (schema + sync) and `endoflife.date` (workflow). Doc-comments naming those tokens to document their deliberate absence tripped the literal-grep gates; comments were reworded to preserve the D-04/Pitfall-5 rationale without the literal tokens. No behavior change.

**Total deviations:** 2 (1 pre-existing CI unblock, 1 comment reword). **Impact:** none on Phase 7 scope; CI lint is now green for subsequent pushes.

## Verification

- `npx vitest run src/engines/eos/catalogue.test.ts` → PASS 8/0
- `npx @biomejs/biome check .` → 171 files, no errors
- `grep -rl "from 'zod'" src/engines/eos/` → exactly `catalogueSchema.ts`
- `grep -c "endoflife.date" .github/workflows/static.yml` → 0
- `node -p require('./src/engines/eos/catalogue.json').lastVerified` → `2026-05-17`

## Issues Encountered

None.

## Next Phase Readiness

Ready for 07-02 — the pure engines import `EosCatalogue` as a typed parameter from this boundary.

## Self-Check: PASSED
