---
quick_id: 260526-vj0
slug: used-storage-guest-used-headline-kpi-to-
date: 2026-05-26
status: complete
---

# Summary — "Used storage" headline → guest-used (LiveOptics parity) + fallback

## What changed
Headline "used storage" now reads **in-guest used** (LiveOptics-comparable), with a
safe fallback to **committed** (`inUseMib`) when the optional `vPartition` sheet is
absent so it never goes blank. The storageByX treemap / per-datastore rollups are
untouched — they stay on committed `inUseMib` (the correct datastore-layer metric).

## Origin
Validation of the VS2 RVTools export vs a LiveOptics deck showed every infra/compute
KPI matching to the decimal, but "used storage" off by 16 %: vatlas headlined
`vInfo "In Use MiB"` (613.9 TiB = datastore-committed, incl. .vswp + snapshots) while
LiveOptics reports in-guest used (≈ `vPartition Consumed` 522 TiB → 527.96 backfilled).
A definition mismatch, not a bug. User chose scope = "headline only + fallback".

## Edits (18 files)
- **Type** `types/estate.ts` — new `OperationalInsights.usedStorageMib: MiB`.
- **Engine** `aggregation/estateView.ts` — `usedStorageMib = guest ? guest.consumedMib : a.inuse`
  in `insightsOf`; `mib(0)` in `EMPTY_INSIGHTS`. Pure, single `buildEstateView` pass.
- **Dashboard** `dashboard/OperationalInsights.tsx` — storage tiles → provisioned /
  **Used storage** / **Committed**. Removed the duplicate `footprint` tile (was a 2nd
  `inUseMib`) and the now-subsumed `guestData` tile (its value = usedStorage when present).
- **PPTX** `export/pptx/slides/overviewSlide.ts` — overview storage KPI → `usedStorageMib`.
- **HTML report** `export/html/renderReport.tsx` — added "Used storage" headline Metric
  (`operationalInsights.usedStorageMib`); relabelled the headline "In use" → "Committed".
- **i18n** en/fr/de/it × {rci, pptx, report}: +`usedStorage`, relabel `inUse`→"Committed",
  removed `rci.insights.footprint`, removed `pptx.overview.inUse`. keyParity green.
- **Tests** `aggregation/estateView.test.ts` — fallback (no vPartition ⇒ usedStorageMib ===
  inUseMib) + guest-present (usedStorageMib === guestUsedMib, ≠ committed).

## Verification
- `npm run typecheck` (app + test) — clean
- `npx @biomejs/biome check src` — clean (321 files)
- `npx vitest run` — 560/560 pass (incl. i18n keyParity + 2 new tests)
- `npx vitest run --coverage` — `success: true`; engines ≥75 % thresholds satisfied

## Notes / follow-ups
- DE/IT terms ("Belegter Speicher"/"Zugesichert", "Spazio utilizzato"/"Impegnato") ride
  the existing pending-native-review flag.
- `ClusterDetail` (drill screen, not a headline) intentionally keeps its own committed +
  guest-data rows; its committed row now reads the relabelled "Committed" string.
- When `vPartition` is absent the headline silently shows committed (the chosen fallback);
  no footnote added (KISS). Revisit if a "data source" caption is wanted.
