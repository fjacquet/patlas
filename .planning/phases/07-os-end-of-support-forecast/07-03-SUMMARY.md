---
phase: 07-os-end-of-support-forecast
plan: 03
subsystem: ui
tags: [eos, estateview, viewtoggle, i18n, datatable, echarts]

requires:
  - phase: 07-01
    provides: loadEosCatalogue() parse-once boundary + EosCatalogue type
  - phase: 07-02
    provides: buildEosProjection / classifyEsxi pure engines
provides:
  - EstateView.eos projection composed in the single buildEstateView pass (no new memo)
  - fmtDate(iso, locale) locale-aware date formatter with em-dash sentinel
  - ECharts heatmap/calendar/visualmap registered (SVG-only)
  - 5th 'eos' ViewToggle segment + App branch
  - EosView read-only presenter (freshness/as-of lines, cumulative bucket strip, forecast chart, P3 DataTable drill, verbatim unknown-OS list, separate ESXi section)
  - eos i18n namespace (EN/FR) + nav.eos + col.eolFrom in inventory.json
  - DataTable header/body column-alignment fix (benefits all consumers)
affects: [10-html-pptx-export consumes the EstateView.eos shape]

tech-stack:
  added: []
  patterns:
    - "EOS projection types live in @/types/estate (types→engines direction, no cycle)"
    - "DataTable header row mirrors the virtualized body flex layout for column alignment"

key-files:
  created:
    - src/components/eos/EosView.tsx
    - src/i18n/locales/en/eos.json
    - src/i18n/locales/fr/eos.json
  modified:
    - src/types/estate.ts
    - src/engines/aggregation/estateView.ts
    - src/engines/eos/bucketEos.ts
    - src/utils/format.ts
    - src/utils/format.test.ts
    - src/components/Chart.tsx
    - src/components/ViewToggle.tsx
    - src/App.tsx
    - src/i18n/index.ts
    - src/i18n/locales/en/inventory.json
    - src/i18n/locales/fr/inventory.json
    - src/components/inventory/DataTable.tsx
    - .planning/REQUIREMENTS.md

key-decisions:
  - "D-00: EOS projection composed in the single buildEstateView pass; EosView is presenter-only (no second memo)"
  - "D-03/D-07: always-visible as-of + catalogue-verified lines; neutral >90d staleness caption; EN/FR parity"
  - "D-05: 5th 'eos' ViewToggle segment reusing the shipped fieldset+aria-pressed idiom (no new nav)"
  - "D-08: EOS drill reuses the shipped generic DataTable with an inline ColumnDef<EosRow> config (column config, not a new component — same pattern as vm/esx/datastore configs)"
  - "D-09b/c: ESXi hosts surfaced as a separate kind; patch level = em-dash; never summed with VMs"
  - "D-11/D-12: unknown-OS drill = verbatim raw strings + occurrence counts, rendered as an auto-escaped React text child (no raw-HTML sink)"
  - "REQUIREMENTS.md EOS rows reconciled from stale Phase 5 → Phase 7"

patterns-established:
  - "Pattern: EOS projection types in @/types/estate, engine import type-only (no cycle)"
  - "Pattern: virtualized DataTable header must share the body's flex column sizing"

requirements-completed: [EOS-01, EOS-02, EOS-03, EOS-04, EOS-05, EOS-06]

duration: 95min
completed: 2026-05-17
---

# Phase 7 Plan 03: EstateView Wiring + EosView UI Summary

**The OS end-of-support forecast shipped end-to-end: a 5th read-only ViewToggle segment with always-visible freshness/as-of lines, a reconciling cumulative bucket strip, a neutral SVG forecast chart, a P3 DataTable drill, a verbatim unknown-OS list, and a separate ESXi section — composed in the single buildEstateView pass with EN/FR parity and no verdict color.**

## Performance

- **Duration:** ~95 min (incl. 2 checkpoint-feedback fix cycles)
- **Tasks:** 3 + blocking human-verify checkpoint (approved)
- **Files modified:** 16 (3 created, 13 modified)

## Accomplishments

- `EstateView.eos` typed projection + frozen `EMPTY_EOS`; composed via `buildEosProjection` inside the existing single pass (no second memo, D-00). EOS types defined in `@/types/estate` to keep the types→engines direction (no cycle); `bucketEos.ts` imports them type-only and re-exports.
- `fmtDate(iso, locale)` added with the em-dash sentinel; covered by `format.test.ts`.
- ECharts `HeatmapChart`/`CalendarComponent`/`VisualMapComponent` registered SVG-only (VIZ-01).
- 5th `'eos'` ViewToggle segment (D-05, shipped idiom verbatim) + `App.tsx` branch.
- `EosView.tsx` presenter: as-of + catalogue-verified lines + conditional staleness caption (D-03/D-07); 6-tile cumulative bucket strip derived from the disjoint partition; reconciliation line with explicit `VMs · ESXi hosts` split (D-09b); neutral SVG forecast bar chart; P3 `DataTable` drill for entity buckets (D-08, inline `ColumnDef<EosRow>` config); verbatim raw-string + occurrence list for the unknown-OS bucket (D-11/D-12, rendered as an auto-escaped React text child — no raw-HTML sink); separate ESXi host section (patch = em-dash, D-09c).
- `eos` i18n namespace (EN/FR, identical keys, no editorial verbs); `nav.eos` + `col.eolFrom` added to `inventory.json` (en/fr).
- REQUIREMENTS.md EOS-01..06 reconciled Phase 5 → Phase 7.
- 337 tests green; `tsc --noEmit` clean; whole-repo Biome clean.

## Deviations from Plan

**[Rule 1 - Adjustment] EOS drill columns: inline `ColumnDef<EosRow>` instead of `vmColumns|esxColumns`** — Found during: Task 2 | Issue: the plan literally said `columns={vmColumns|esxColumns}`, but those are typed `ColumnDef<VmDisplayRow>` / `ColumnDef<EsxAggregate>` and `EosRow` is a distinct projection row — passing them would not typecheck | Fix: an inline `ColumnDef<EosRow>` config feeding the same shipped generic `DataTable` primitive (column config is not a component; vm/esx/datastore each already have their own config — this is the DRY-consistent reading of D-08) | Verification: tsc clean, drill renders | Impact: none on D-08 intent (DataTable reused, no new table component).

**[Rule 1 - Bug, UAT checkpoint] EOS drill header rendered the raw key `col.eolFrom`** — Found during: human-verify checkpoint (user) | Issue: `DataTable` resolves visible headers via `useTranslation('inventory')` → `t('col.<id>')` (the `headerFor` prop is CSV-only by design); the EOS-only `eolFrom` id had no `inventory:col.eolFrom` key | Fix: added `col.eolFrom` to en/fr `inventory.json` (the namespace every DataTable consumer's headers resolve through) | Verification: header reads "End of support"/"Fin de support"; tsc/tests green | Commit: fix(07-03) col.eolFrom.

**[Rule 1 - Bug, UAT checkpoint] DataTable header/body column misalignment (pre-existing, all consumers)** — Found during: human-verify checkpoint (user, 2nd round; shown on both the EOS drill and the shipped Inventory VM table) | Issue: virtualized `<tbody>` rows use `flex w-full` + per-cell `flex-1` (equal widths) but `<thead>` used default table-cell content-sizing → header/body column edges never matched, in every DataTable consumer | Fix: header row now mirrors the body flex layout exactly (`<tr class="flex w-full">`, `<th class="flex flex-1 overflow-hidden text-ellipsis … px-3">`) | Verification: tsc/biome clean, 337 tests green; user approved | Impact: improves VM/ESX/datastore tables too (touched `DataTable.tsx`, outside the plan's declared `files_modified` — a justified root-cause fix, user-directed at the checkpoint).

**Total deviations:** 3 (1 type-safety adjustment, 2 UAT checkpoint bug fixes — the last a pre-existing shipped-component bug). **Impact:** all within phase scope and locked decisions; the DataTable fix is a net improvement for all four table consumers.

## Verification

- `npx tsc --noEmit` → No errors found
- `npx @biomejs/biome check .` → no errors
- `npx vitest run` → PASS 337 / FAIL 0
- `useMemo` grep in `EosView.tsx` + `estateView.ts` → 0 (single-memo invariant, D-00)
- raw-HTML injection prop grep in `EosView.tsx` → 0 (XSS-safe, D-12)
- en/fr `eos.json` key sets identical; editorial-verb grep → 0
- `EOS-0. | Phase 5` in REQUIREMENTS.md → 0; `EOS-0. | Phase 7` → 6
- Human-verify checkpoint: **approved** by the user after the two alignment fixes.

## Issues Encountered

None outstanding. Two UAT-surfaced defects (raw header key; pre-existing DataTable header/body misalignment) were fixed and re-verified during the checkpoint loop.

## Next Phase Readiness

Phase 7 complete (3/3 plans). `EstateView.eos` is export-ready for Phase 10 (HTML/PPTX) — that phase consumes the shape, this phase does not generate the artifact.

## Self-Check: PASSED
