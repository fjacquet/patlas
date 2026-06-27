# PPTX rendition fixes — design

- **Date:** 2026-06-27
- **Status:** Approved (brainstorming) → ready for plan
- **Scope:** Spec 1 of 2. The network topology-tree redesign is a **separate** spec (Spec 2).

## Problem

A PPTX export of the real cv4pve workbook (6 nodes / 179 guests) showed four rendering/data problems. Recent web/HTML fixes (notably the PR #19 storage-KPI correction) did not all propagate to the PPTX deck.

1. **Estate overview — storage KPIs wrong.** The slide shows `Provisioned` = 3.1 TiB (a partial per-VM `Disk Size` sum, only ~56% of VMs report it) and `Used storage` = 0 GiB (the always-empty per-VM `Disk Usage` column). PR #19 already replaced these in the web dashboard with the authoritative VM-data datastore figures; the PPTX overview slide was never updated.
2. **Backup coverage — table overlap.** Two stacked tables collide: the "VMs without successful backup" table renders taller than its manual `curY += rows * 0.24` height estimate, so the "Operational health" sub-heading and table overprint it.
3. **Filesystem fill risk — table overflow + noise.** `TOP_N = 20` rows overflow the slide (only ~4.3" of vertical space, `autoPage: false`), and most rows are read-only `squashfs` (snap) mounts that report 100% **by design** — inflating "151 mounts over threshold" with false positives across web, HTML, and PPTX.
4. **Network — illegible diagram.** The upstream `network-diagram.svg` (1762×14092px) rasterized and squeezed into a wide-short slide box is an unreadable blur.

## Out of scope

- **Network topology-tree redesign** — its own design (Spec 2, Approach B). This spec only stops the deck from embedding the blurry raster as an interim measure.
- **Cluster-detail web screen** still reading per-VM storage fields — separate follow-up (flagged on PR #19).
- **HTML report renderer changes** — none needed. The engine `squashfs` filter (Fix 2) feeds the same `EstateView`, so the HTML report's protection table improves automatically. The HTML report's existing `slice(0, 20)` cap on the fsFill table is pre-existing and left as-is.
- The shared `OperationalInsights.provisionedMib` / `usedStorageMib` fields are **not** removed (other consumers use them); the overview slide simply stops displaying them.

## Design

### Fix 1 — Estate overview storage KPIs (slide-level; the propagation fix)

Mirror the PR #19 dashboard fix in `overviewSlide.ts`. The second KPI row's two storage cards change source from the unreliable per-VM columns to the VM-data storage-role group:

- `Provisioned` (`o.provisionedMib`) → **VM storage used** = `vmStorage.usedMib` (~49.9 TiB)
- `Used storage` (`o.usedStorageMib`) → **VM storage capacity** = `vmStorage.capacityMib` (~110.5 TiB)

Changes:
- `OverviewData` gains `vmStorage: { usedMib: number; capacityMib: number } | null`.
- `builder.ts` passes `view.storage.byRole.find((g) => g.role === 'vmdata') ?? null` (mapped to `{ usedMib, capacityMib }`).
- Card values guard `null` → em-dash `—` (never a fabricated 0), via `vmStorage ? pptxMemMib(vmStorage.usedMib, locale) : '—'`.
- The other four cards in the row (avg CPU, avg mem, physical cores, host memory) are unchanged.
- New i18n keys `overview.vmStorageUsed` / `overview.vmStorageCapacity` (pptx namespace) in all four locales.

### Fix 2 — Filesystem fill risk (engine + slide)

**Engine** (`fsFillRisk.ts`): exclude partition rows whose FS type (lower-cased, trimmed) is one of `squashfs`, `iso9660`, `erofs` **before** any counting. Applied once at the top so every downstream figure — `overThreshold`, `overThresholdCount`, `totalMounts`, and `totalVms` (distinct VMs among remaining partitions) — reflects only real, monitorable filesystems. This corrects the web Protection view, the HTML report, and the PPTX alike.

**Slide** (`fsFillSlide.ts`): lower `TOP_N` to a value that fits one slide (target ~12 data rows; verify against the ~4.3" content area at the table's real row height), and add a factual remainder footer when truncated: "`+ {{count}} more mounts over threshold`" (the KPI already shows the total). No "see HTML report" pointer (HTML is also capped).

### Fix 3 — Backup coverage overlap (slide-level)

`backupCoverageSlide.ts`: replace the vertical `curY` stacking with a **two-column side-by-side** layout (the slide is 12.33" wide):
- Left half (`x = M`, `w ≈ CONTENT_W * 0.48`): "VMs without successful backup" — sub-heading + table, capped to ~12 rows, with the same "`+ {{count}} more`" footer (178 uncovered → top ~12 + remainder).
- Right half (`x ≈ M + CONTENT_W * 0.52`, `w ≈ CONTENT_W * 0.46`): "Operational health" — sub-heading + per-type table.
- Both columns start at the same `y` below the KPI row. The vertical collision is structurally impossible once the tables no longer stack.

### Fix 4 — Network diagram blur (slide-level, INTERIM — superseded by Spec 2)

`networkSlide.ts`: in the `oversized` branch, **stop calling `addChartImage` with the raster**. Render the four KPI cards (unchanged) and, in the area below, a clear centered note: "Full network diagram available in the HTML report." (the report genuinely inlines the full SVG, so the pointer is truthful). Non-oversized diagrams continue to render as today. This is ~3 lines and is explicitly replaced by Spec 2's topology tree.

## Cross-cutting

- **i18n:** new pptx-namespace keys in all four locales (`en`/`fr`/`de`/`it`): `overview.vmStorageUsed`, `overview.vmStorageCapacity`, `protection.fsFill.more`, `protection.backupCoverage.more`. The `keyParity.test.ts` gate enforces identical paths. The "`{{count}}`" footers are formatted in the slide via a manual `.replace('{{count}}', pptxNumber(remainder, locale))` (the export worker only resolves a fixed token set).
- **Tests:** extend `fsFillRisk.test.ts` (squashfs/iso9660/erofs excluded from counts + list); extend `pptx/builder.test.ts` (overview shows the VM-storage labels and not the old `Provisioned`/0-GiB storage values; fsFill/backup slides emit a remainder footer when truncated). No overlap assertion is feasible in jsdom; correctness is verified by the side-by-side structure + manual deck inspection.
- **Engines stay pure** (Zod only at the parser boundary); `fsFillRisk.ts` remains a pure function. Coverage gate ≥75% on `engines/`.

## Acceptance criteria

Re-exporting the real workbook to PPTX:
1. **Estate overview** shows "VM storage used ≈ 49.9 TiB" and "VM storage capacity ≈ 110.5 TiB" — never "Provisioned 3.1 TiB" / "Used storage 0 GiB".
2. **FS fill risk** lists no `squashfs`/`iso9660`/`erofs` rows; the "over threshold" KPI reflects only real filesystems; the table fits within one slide; a remainder footer appears only when truncated.
3. **Backup coverage** renders the two tables side-by-side with no overlap; the uncovered table shows the top rows + a remainder footer.
4. **Network** (oversized) shows the KPI cards + the HTML-report note, with no blurry embedded image.
5. Gates green: `npm run typecheck`, `biome check`, full Vitest suite (incl. updated `fsFillRisk` + `builder` tests), `npm run build`, `check:bundle-size`, `keyParity`. Privacy invariant intact (no new network calls).
