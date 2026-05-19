---
phase: 11
plan: "02"
subsystem: i18n
tags: [i18n, locale, export, parity]
requires: []
provides:
  - "storage/network/planned dotted i18n keys (the chrome contract 11-05/11-06 resolve via strings['storage.title'] ?? fallback)"
affects:
  - src/i18n/locales/en/report.json
  - src/i18n/locales/fr/report.json
  - src/i18n/locales/en/pptx.json
  - src/i18n/locales/fr/pptx.json
tech-stack:
  added: []
  patterns:
    - "Collision-free-by-intent: identical dotted paths across report.json + pptx.json so the prefix-less flatten spread (useExport.ts:77-84) resolves the same string regardless of which file wins"
key-files:
  created: []
  modified:
    - src/i18n/locales/en/report.json
    - src/i18n/locales/fr/report.json
    - src/i18n/locales/en/pptx.json
    - src/i18n/locales/fr/pptx.json
key-decisions:
  - "Same dotted paths AND same values in report.json + pptx.json (simplest collision-safe choice; plan allowed differing values but identical paths)"
  - "FR uses Gio for GiB; factual-only (no editorial verbs); {{n}} placeholder for vsanShared, formatted at render"
requirements-completed: [STG-04, STG-05, NET-01, NET-02, NET-03, NET-04, NET-05]
duration: 7 min
completed: 2026-05-19
---

# Phase 11 Plan 02: Storage/Network/planned i18n keys Summary

Added matched `storage` (10 keys), `network` (5 keys), `planned` (10 keys) nested blocks to all four locale files (`{en,fr}/{report,pptx}.json`) with EN↔FR path parity and report↔pptx path-identity (collision-free-by-intent against the prefix-less flatten in `useExport.ts:77-84`). FR follows `Gio`/factual conventions; no pre-formatted numbers (`{{n}}` placeholder only); no editorial verbs.

- Tasks: 1 · Files: 4 modified
- Start 2026-05-19 · ~7 min

## Deviations from Plan

None - plan executed exactly as written. (`report.json` had no pre-existing `eos`/`dr` blocks — those live only in `pptx.json`; the new blocks were appended after `footer`, which does not affect path-parity since the same paths were added to all four files.)

## Verification

- `npx vitest run src/i18n/keyParity.test.ts` → 16/16 passed (EN↔FR parity green, report + pptx)
- All 4 files valid JSON (`JSON.parse` via require succeeds); each carries `storage`/`network`/`planned`
- Path trees IDENTICAL report.json↔pptx.json for both `en` and `fr`
- Factual-only/no-number denylist scan over the added blocks → 0 hits
- `npx @biomejs/biome check` → clean (4 files, no fixes)

## Self-Check: PASSED

- All 4 key-files.modified present with the three blocks
- `git log --grep="11-02"` → 1 production commit (feat)
- All task `<acceptance_criteria>` re-run green; plan `<verification>` green

## Next

Ready for 11-03 (traceability reconcile). The Storage/Network/planned chrome contract is now resolvable by Wave-2 11-05 (PPTX slides) and 11-06 (HTML sections).
