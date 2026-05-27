---
quick_id: 260526-vj0
slug: used-storage-guest-used-headline-kpi-to-
date: 2026-05-26
---

# Quick task — "Used storage" headline KPI → guest-used (LiveOptics parity) + fallback

## Why
vatlas headlines `vInfo "In Use MiB"` as used storage (613.9 TiB on the VS2 file =
storage **committed** on datastores, incl. .vswp + snapshots). LiveOptics reports
**in-guest used** (≈ vPartition Consumed = 522 TiB → 527.96 after backfill). The 16 %
gap is purely a definition mismatch. Decision (user, scope = "headline only + fallback"):
the headline "used storage" figure should read guest-used, falling back to committed
when the optional `vPartition` sheet is absent so it never goes blank. Keep `inUseMib`
(committed) as a clearly-labeled secondary figure AND as the basis for the storageByX
treemap / per-datastore analytics (committed is correct there — do NOT change those).

## Design
New derived engine field, pure, in the single `buildEstateView` pass:
`usedStorageMib = guestUsedMib ?? inUseMib`.

## Tasks
1. **Type** `src/types/estate.ts` — add `usedStorageMib: MiB` to `OperationalInsights`
   with a doc comment (guest-used when available, else committed fallback; the
   LiveOptics-comparable figure).
2. **Engine** `src/engines/aggregation/estateView.ts` — set
   `usedStorageMib: mib(guest ? (guest.consumedMib as number) : a.inuse)` in `insightsOf`;
   add `usedStorageMib: mib(0)` to `EMPTY_INSIGHTS`.
3. **Dashboard** `src/components/dashboard/OperationalInsights.tsx` — storage tiles become
   provisioned / **usedStorage** (= `usedStorageMib`) / **inUse=committed** (= `inUseMib`).
   Remove the `footprint` tile (true duplicate of inUse) AND the now-subsumed `guestData`
   tile (its value equals usedStorage when present; would re-introduce a duplicate).
4. **PPTX** `src/engines/export/pptx/slides/overviewSlide.ts` — retarget the single storage
   KPI from `inUse`/`inUseMib` to `usedStorage`/`usedStorageMib`.
5. **HTML report** `src/engines/export/html/renderReport.tsx` — add a "Used storage" headline
   Metric (= `view.operationalInsights.usedStorageMib`); relabel the existing "In use" headline
   Metric → "Committed" (still `storage.estate.inUseMib`). Annex tables + treemap unchanged.
6. **i18n** (all four locales en/fr/de/it; keyParity gate):
   - `rci.json` insights: +`usedStorage`, relabel `inUse`→"Committed", **remove** `footprint`
     (keep `guestData` — ClusterDetail uses it).
   - `pptx.json` overview: +`usedStorage`, **remove** `overview.inUse` (overview-only).
   - `report.json` storage: +`usedStorage`, relabel `inUse`→"Committed" (keep `colInUse`).
   No editorial verbs, no pre-formatted numbers. (DE/IT terms ride the pending-native-review flag.)
7. **Tests** — extend `estateView.test.ts`: usedStorageMib === guestUsedMib when vPartition
   present; === inUseMib when absent. Keep engines coverage ≥75 %.

## Verify
`npm run typecheck` (app + test) · `npx @biomejs/biome check .` · `npm run test:run` ·
`src/i18n/keyParity.test.ts` green · `npm run test:coverage` engines ≥75 %.

## Out of scope
storageByX treemap / per-datastore rollups / DR sims (stay on committed `inUseMib`).
ClusterDetail keeps its own committed + guestData rows (detail screen, not a headline).
