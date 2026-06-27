# PPTX Rendition Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-export of the real cv4pve workbook to PPTX shows correct VM-storage KPIs, a noise-free fit-to-slide FS-fill table, side-by-side (non-overlapping) backup tables, and a legible network slide — propagating fixes the web/HTML side already has.

**Architecture:** Four self-contained fixes against the existing pure PPTX engine (`src/engines/export/pptx/`). One engine change (`fsFillRisk.ts` filter) plus four slide-level changes (`overviewSlide.ts`, `fsFillSlide.ts`, `backupCoverageSlide.ts`, `networkSlide.ts`) and one shared layout helper (`_layout.ts: addMoreFooter`). New i18n keys land in all four locales' `pptx.json`. No new runtime deps, no network calls, engines stay pure.

**Tech Stack:** TypeScript (strict), pptxgenjs 4, Vitest, react-i18next (en/fr/de/it), Biome.

## Global Constraints

- Engines are **pure functions** — no React/Zustand/DOM; Zod only at the parser boundary. `fsFillRisk.ts` stays pure.
- Coverage gate **≥75%** on `engines/`.
- i18n keys land in **all four** locales (`en`/`fr`/`de`/`it`); `src/i18n/keyParity.test.ts` enforces identical key paths per namespace. **No pre-formatted numbers in strings; no editorial verbs** ("recommend/should/poor/good").
- The export strings bag is assembled in `src/hooks/useExport.ts` from **only** the `report` and `pptx` i18n namespaces (flattened, dotted). New slide-facing keys therefore live in **`pptx.json`** (NOT `protection.json`).
- The export worker resolves only a fixed token set; the `{{count}}` footer token is substituted **in the slide** via `String.replace`, never by the i18n interpolator.
- Branded units (`MiB`) — never raw multipliers. Convert branded values to plain `number` with `Number(...)` at the slide/builder boundary (existing pattern).
- Commit prefix `<type>(NN-NN): …`. **Squash merge is forbidden** (standing user constraint). Lint via `npx @biomejs/biome check .` (NOT `npm run lint` — RTK intercepts it). Test-file type errors surface only under full `npm run typecheck` (app + `tsconfig.test.json`), not `rtk tsc`.
- Privacy invariant intact: no new `fetch`/network calls; no dataset rows persisted.
- Branch: `feat/pptx-rendition-fixes`.

## Reference facts (verified against the codebase)

- Slide geometry: `SLIDE = { w: 13.333, h: 7.5, margin: 0.5 }`; `M = 0.5`; `CONTENT_W = SLIDE.w - 2*M = 12.333`.
- `addHeader(...)` always returns `1.35` (content-start y). `addKpiRow(...)` returns `y + 1.05 + 0.25` (card height 1.05 + 0.25 gap). So after a header + one KPI row, content starts at `1.35 + 1.30 = 2.65`. Usable bottom ≈ `SLIDE.h - M = 7.0`. Available vertical content area ≈ `7.0 - 2.65 = 4.35"`.
- `view.storage.byRole` is a `StorageRoleGroup[]`; the `vmdata` group exposes branded `usedMib` / `capacityMib`. `GlobalDashboard.tsx:74` already uses `view.storage.byRole.find((g) => g.role === 'vmdata') ?? null` — mirror it.
- Only `overviewSlide.ts` emits the literal labels "Provisioned" / "Used storage" in the whole deck (verified by grep). After Fix 1, neither appears in an export.
- `Snapshot.proxmoxPartitions` / `proxmoxTasks` are **optional** (`?`) — test fixtures may add them by spreading the base `snap()`.
- A literal em-dash `'—'` already appears in slide source (`_layout.ts:163`), so using `'—'` in `overviewSlide.ts` is consistent and allowed (the non-ASCII grep-gate is scoped to `format.ts`).
- `pptxgenjs` writes each `addText` string as one contiguous `<a:t>` run, so `TextDecoder('latin1')` + `toContain('full phrase')` is the established deck-assertion idiom (`builder.test.ts`).

---

### Task 1: FS-fill engine — exclude pseudo-filesystems (Fix 2, engine half)

**Files:**
- Modify: `src/engines/aggregation/fsFillRisk.ts`
- Test: `src/engines/aggregation/fsFillRisk.test.ts`

**Interfaces:**
- Consumes: `ProxmoxPartitionRow` (`fsType: string`).
- Produces: `computeFsFillRisk(rows, threshold?)` unchanged signature; now ignores rows whose `fsType` (lower-cased, trimmed) ∈ `{squashfs, iso9660, erofs}` for **every** figure (`overThreshold`, `overThresholdCount`, `totalMounts`, `totalVms`). A new exported `const FS_FILL_PSEUDO_TYPES: ReadonlySet<string>`.

- [ ] **Step 1: Write the failing test**

Add to `src/engines/aggregation/fsFillRisk.test.ts` inside `describe('computeFsFillRisk', ...)`:

```ts
  it('excludes squashfs/iso9660/erofs from every figure', () => {
    const rows = [
      row({ vmId: '100', mountPoint: '/', fsType: 'ext4', usedFraction: 0.9 }),
      row({ vmId: '100', mountPoint: '/snap/core', fsType: 'squashfs', usedFraction: 1 }),
      row({ vmId: '101', mountPoint: '/cdrom', fsType: 'ISO9660', usedFraction: 1 }),
      row({ vmId: '102', mountPoint: '/boot', fsType: ' erofs ', usedFraction: 1 }),
    ]
    const r = computeFsFillRisk(rows, 0.8)
    // Only the ext4 row survives the filter.
    expect(r.totalMounts).toBe(1)
    expect(r.overThresholdCount).toBe(1)
    expect(r.totalVms).toBe(1)
    expect(r.overThreshold.every((m) => m.fsType.toLowerCase().trim() !== 'squashfs')).toBe(true)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engines/aggregation/fsFillRisk.test.ts -t "excludes squashfs"`
Expected: FAIL — `totalMounts` is `4` (filter not yet applied).

- [ ] **Step 3: Implement the filter**

In `src/engines/aggregation/fsFillRisk.ts`, add the pseudo-type set after `FS_FILL_DEFAULT_THRESHOLD`:

```ts
export const FS_FILL_DEFAULT_THRESHOLD = 0.8

/**
 * Read-only pseudo-filesystems that report 100% used BY DESIGN (snap/AppImage
 * `squashfs`, mounted ISOs `iso9660`, immutable-image `erofs`). They are not
 * monitorable fill risks, so they are excluded before any counting — otherwise
 * they dominate the "over threshold" count with false positives.
 */
export const FS_FILL_PSEUDO_TYPES: ReadonlySet<string> = new Set(['squashfs', 'iso9660', 'erofs'])
```

Then, at the top of `computeFsFillRisk`, filter once before the loop:

```ts
export const computeFsFillRisk = (
  rows: ProxmoxPartitionRow[],
  threshold = FS_FILL_DEFAULT_THRESHOLD,
): FsFillRisk => {
  const real = rows.filter((r) => !FS_FILL_PSEUDO_TYPES.has(r.fsType.toLowerCase().trim()))
  const vmIds = new Set<string>()
  const riskRows: FsRiskRow[] = []

  for (const r of real) {
```

And change `totalMounts: rows.length` to `totalMounts: real.length` in the return object.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engines/aggregation/fsFillRisk.test.ts`
Expected: PASS (all existing cases + the new one).

- [ ] **Step 5: Commit**

```bash
git add src/engines/aggregation/fsFillRisk.ts src/engines/aggregation/fsFillRisk.test.ts
git commit -m "fix(pptx): exclude squashfs/iso9660/erofs from FS-fill risk counts"
```

---

### Task 2: FS-fill slide — fit-to-slide cap + remainder footer + `addMoreFooter` helper (Fix 2, slide half)

**Files:**
- Modify: `src/engines/export/pptx/slides/_layout.ts` (add `addMoreFooter`)
- Modify: `src/engines/export/pptx/slides/fsFillSlide.ts`
- Modify: `src/i18n/locales/{en,fr,de,it}/pptx.json` (add `protection.fsFill.more`)
- Test: `src/engines/export/pptx/builder.test.ts`

**Interfaces:**
- Produces (`_layout.ts`): `addMoreFooter(s: PptxGenJS.Slide, label: string, remainder: number, locale: ExportLocale, box: Box): void` — renders `label` with its literal `{{count}}` token replaced by the locale-formatted `remainder`, as a muted italic footer in `box`. `Box = { x, y, w, h }` (already exported from `_layout.ts`).
- Consumes (`fsFillSlide.ts`): `addMoreFooter`, the `FsFillRisk` shape (`overThreshold: FsRiskRow[]`).

- [ ] **Step 1: Add the shared footer helper to `_layout.ts`**

In `src/engines/export/pptx/slides/_layout.ts`, widen the format import and add the helper. Change the import line:

```ts
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
```

Add this function after `addNote` (before the `export { CONTENT_W, M }` line):

```ts
/** A truncation footer ("+ N more …") below a capped table. `label` carries a
 *  literal `{{count}}` token, replaced here with the locale-formatted
 *  `remainder` (the export worker resolves only a fixed token set, so the
 *  substitution happens in the slide). Muted + italic so it reads as metadata,
 *  not data. */
export function addMoreFooter(
  s: PptxGenJS.Slide,
  label: string,
  remainder: number,
  locale: ExportLocale,
  box: Box,
): void {
  s.addText(pptxSafeFormat(label.replace('{{count}}', pptxNumber(remainder, locale))), {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    color: PPTX_COLORS.inkMuted,
    fontFace: 'Arial',
    fontSize: 10,
    italic: true,
  })
}
```

- [ ] **Step 2: Add the i18n key to all four locales**

In each of `src/i18n/locales/{en,fr,de,it}/pptx.json`, add a top-level `"protection"` object (none exists yet) immediately after the `"overview"` block. Use these per-locale values:

`en/pptx.json`:
```json
  "protection": {
    "fsFill": { "more": "+ {{count}} more mounts over threshold" }
  },
```
`fr/pptx.json`:
```json
  "protection": {
    "fsFill": { "more": "+ {{count}} montages supplémentaires au-dessus du seuil" }
  },
```
`de/pptx.json`:
```json
  "protection": {
    "fsFill": { "more": "+ {{count}} weitere Mounts über dem Schwellenwert" }
  },
```
`it/pptx.json`:
```json
  "protection": {
    "fsFill": { "more": "+ {{count}} altri montaggi oltre la soglia" }
  },
```

(Each `protection` object will gain `backupCoverage.more` in Task 4. Adding `fsFill.more` to all four locales now keeps `keyParity` green for this commit.)

- [ ] **Step 3: Lower `TOP_N` and render the footer in `fsFillSlide.ts`**

In `src/engines/export/pptx/slides/fsFillSlide.ts`:

Change the import to pull in `addMoreFooter`:
```ts
import { addHeader, addKpiRow, addMoreFooter, CONTENT_W, M } from './_layout'
```

Change the cap:
```ts
const TOP_N = 12
```

Replace the `s.addTable([hdr, ...rows], {...})` block (the final statement) so it caps a named `shown` slice and appends the footer when truncated:

```ts
  const shown = risk.overThreshold.slice(0, TOP_N)
  const rows = shown.map((r) => [
    cell(r.node),
    cell(r.vmName || r.vmId),
    cell(r.mountPoint),
    cell(r.fsType),
    cell(pptxNumber(Math.round(r.totalGb), locale), { align: 'right' }),
    cell(r.usedPct !== null ? pct(r.usedPct) : '—', { align: 'right' }),
  ])

  const rowH = 0.26
  const tableY = y2 + 0.05
  s.addTable([hdr, ...rows], {
    x: M,
    y: tableY,
    w: CONTENT_W,
    colW: [
      CONTENT_W * 0.15,
      CONTENT_W * 0.22,
      CONTENT_W * 0.28,
      CONTENT_W * 0.13,
      CONTENT_W * 0.11,
      CONTENT_W * 0.11,
    ],
    rowH,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
    autoPage: false,
  })

  const remainder = risk.overThreshold.length - shown.length
  if (remainder > 0) {
    addMoreFooter(
      s,
      strings['protection.fsFill.more'] ?? '+ {{count}} more mounts over threshold',
      remainder,
      locale,
      { x: M, y: tableY + (shown.length + 1) * rowH + 0.06, w: CONTENT_W, h: 0.3 },
    )
  }
```

(Delete the previous `const rows = risk.overThreshold.slice(0, TOP_N).map(...)` and the old `rowH: 0.26` inline literal — they are replaced by the block above.)

- [ ] **Step 4: Write the failing footer test**

In `src/engines/export/pptx/builder.test.ts`, add imports near the top (after the existing imports):

```ts
import { addBackupCoverageSlide } from './slides/backupCoverageSlide'
import { addFsFillSlide } from './slides/fsFillSlide'
import type { FsFillRisk, FsRiskRow } from '@/engines/aggregation/fsFillRisk'
import type { BackupCoverage } from '@/engines/aggregation/backupCoverage'
```

Add a slide-render helper and a `FsRiskRow` factory near the other top-level test helpers (after `isZip`):

```ts
async function renderSlideText(fn: (p: PptxGenJS) => void): Promise<string> {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 })
  pptx.layout = 'WIDE'
  fn(pptx)
  const ab = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer
  return new TextDecoder('latin1').decode(new Uint8Array(ab))
}

const fsRow = (i: number): FsRiskRow => ({
  node: `pve${i % 3}`,
  vmId: String(100 + i),
  vmName: `vm-${i}`,
  vmType: 'qemu',
  mountPoint: `/data${i}`,
  fsType: 'ext4',
  totalGb: 100,
  usedGb: 95,
  usedPct: 95,
  overThreshold: true,
})

const fsRisk = (n: number): FsFillRisk => ({
  overThreshold: Array.from({ length: n }, (_, i) => fsRow(i)),
  overThresholdCount: n,
  totalMounts: n,
  totalVms: n,
  threshold: 0.8,
})
```

Add the test (new `describe`):

```ts
describe('Fix 2 — FS-fill slide remainder footer', () => {
  it('shows the footer when over-threshold rows exceed the cap', async () => {
    const txt = await renderSlideText((p) => addFsFillSlide(p, fsRisk(15), {}, 'en'))
    expect(txt).toContain('more mounts over threshold')
    expect(txt).toContain('+ 3 more') // 15 − 12
  })

  it('omits the footer when rows fit', async () => {
    const txt = await renderSlideText((p) => addFsFillSlide(p, fsRisk(10), {}, 'en'))
    expect(txt).not.toContain('more mounts over threshold')
  })
})
```

- [ ] **Step 5: Run the test to verify it fails, then passes**

Run (before Step 3 edits would already be in place, so run after): `npx vitest run src/engines/export/pptx/builder.test.ts -t "FS-fill slide remainder footer"`
Expected: PASS. If you wrote the test first and reverted Step 3, it FAILS with `+ 3 more` not found.

- [ ] **Step 6: Verify key parity + typecheck**

Run: `npx vitest run src/i18n/keyParity.test.ts && npm run typecheck`
Expected: PASS — `pptx` namespace parity holds across all four locales; no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/engines/export/pptx/slides/_layout.ts src/engines/export/pptx/slides/fsFillSlide.ts src/engines/export/pptx/builder.test.ts src/i18n/locales/en/pptx.json src/i18n/locales/fr/pptx.json src/i18n/locales/de/pptx.json src/i18n/locales/it/pptx.json
git commit -m "fix(pptx): cap FS-fill table to one slide with a remainder footer"
```

---

### Task 3: Estate-overview storage KPIs — VM-data datastore figures (Fix 1)

**Files:**
- Modify: `src/engines/export/pptx/slides/overviewSlide.ts`
- Modify: `src/engines/export/pptx/builder.ts:94-103`
- Modify: `src/i18n/locales/{en,fr,de,it}/pptx.json` (add `overview.vmStorageUsed`, `overview.vmStorageCapacity`)
- Test: `src/engines/export/pptx/builder.test.ts`

**Interfaces:**
- Produces (`overviewSlide.ts`): `OverviewData` gains `vmStorage: { usedMib: number; capacityMib: number } | null`.
- Consumes (`builder.ts`): `view.storage.byRole.find((g) => g.role === 'vmdata')` → maps branded MiB to plain numbers.

- [ ] **Step 1: Extend `OverviewData` and the two storage cards in `overviewSlide.ts`**

In `src/engines/export/pptx/slides/overviewSlide.ts`, add the field to the interface:

```ts
export interface OverviewData {
  globals: GlobalSummary
  insights: OperationalInsights
  osBreakdown: OsBreakdown
  /** VM-data datastore used/capacity (from `view.storage.byRole` vmdata group),
   *  in MiB. `null` when no vmdata storage role is present → cards show "—".
   *  Replaces the unreliable per-VM `Provisioned`/`Used storage` columns. */
  vmStorage: { usedMib: number; capacityMib: number } | null
}
```

Replace the last two cards of the second KPI row (the `overview.provisioned` and `overview.usedStorage` entries) with:

```ts
      {
        label: strings['overview.vmStorageUsed'] ?? 'VM storage used',
        value: d.vmStorage ? pptxMemMib(d.vmStorage.usedMib, locale) : '—',
      },
      {
        label: strings['overview.vmStorageCapacity'] ?? 'VM storage capacity',
        value: d.vmStorage ? pptxMemMib(d.vmStorage.capacityMib, locale) : '—',
      },
```

(The other four cards — avg CPU, avg mem, physical cores, host memory — are unchanged. `const o = d.insights` stays; `o.provisionedMib`/`o.usedStorageMib` are simply no longer read here.)

- [ ] **Step 2: Pass `vmStorage` from `builder.ts`**

In `src/engines/export/pptx/builder.ts`, change the `addOverviewSlide(...)` call (currently lines 94-103) to compute and pass the vmdata group:

```ts
  const vmRole = view.storage.byRole.find((g) => g.role === 'vmdata')
  addOverviewSlide(
    pptx,
    {
      globals: view.globals,
      insights: view.operationalInsights,
      osBreakdown: view.osBreakdown,
      vmStorage: vmRole
        ? { usedMib: Number(vmRole.usedMib), capacityMib: Number(vmRole.capacityMib) }
        : null,
    },
    strings,
    locale,
  )
```

- [ ] **Step 3: Add the two i18n keys to all four locales**

In each `pptx.json`, append to the existing `"overview"` object (after `"usedStorage"`; remember to add a comma after `"usedStorage"`'s value):

`en`:
```json
    "vmStorageUsed": "VM storage used",
    "vmStorageCapacity": "VM storage capacity"
```
`fr`:
```json
    "vmStorageUsed": "Stockage VM utilisé",
    "vmStorageCapacity": "Capacité stockage VM"
```
`de`:
```json
    "vmStorageUsed": "VM-Speicher belegt",
    "vmStorageCapacity": "VM-Speicherkapazität"
```
`it`:
```json
    "vmStorageUsed": "Storage VM usato",
    "vmStorageCapacity": "Capacità storage VM"
```

(Keep `overview.provisioned` / `overview.usedStorage` keys — the spec leaves the shared `OperationalInsights` fields and their keys in place; the overview slide just stops displaying them.)

- [ ] **Step 4: Write the failing test**

In `src/engines/export/pptx/builder.test.ts`, add inside `describe('buildPptx — golden structural snapshot', ...)`:

```ts
  it('Fix 1 — overview shows VM-storage KPIs, not per-VM Provisioned/Used storage', async () => {
    const a = snap('a', 3, TODAY)
    const { view, trends } = buildExportView(a, [a], MODE, TODAY)
    const ab = await buildPptx(view, trends, strings, 'en')
    const txt = new TextDecoder('latin1').decode(new Uint8Array(ab))
    expect(txt).toContain('VM storage used')
    expect(txt).toContain('VM storage capacity')
    expect(txt).not.toContain('Provisioned')
    expect(txt).not.toContain('Used storage')
  })
```

(The base `snap()` fixture has `storages: []`, so `vmStorage` is `null` and the cards render `'—'` — but the **labels** still prove the propagation, and the absence of the old labels proves the swap.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engines/export/pptx/builder.test.ts -t "Fix 1"`
Expected: PASS.

- [ ] **Step 6: Run the full typecheck (OverviewData is a shared type)**

Run: `npm run typecheck`
Expected: PASS — every `addOverviewSlide` caller now supplies `vmStorage` (only `builder.ts` constructs `OverviewData`; verify no other construction site exists with `git grep -n "OverviewData"`).

- [ ] **Step 7: Commit**

```bash
git add src/engines/export/pptx/slides/overviewSlide.ts src/engines/export/pptx/builder.ts src/engines/export/pptx/builder.test.ts src/i18n/locales/en/pptx.json src/i18n/locales/fr/pptx.json src/i18n/locales/de/pptx.json src/i18n/locales/it/pptx.json
git commit -m "fix(pptx): overview storage KPIs use VM-data datastore used/capacity"
```

---

### Task 4: Backup-coverage slide — side-by-side tables + remainder footer (Fix 3)

**Files:**
- Modify: `src/engines/export/pptx/slides/backupCoverageSlide.ts` (full rewrite of the body below `addKpiRow`)
- Modify: `src/i18n/locales/{en,fr,de,it}/pptx.json` (add `protection.backupCoverage.more`)
- Test: `src/engines/export/pptx/builder.test.ts`

**Interfaces:**
- Consumes: `addMoreFooter` (Task 2), `BackupCoverage` (`vzdump.uncoveredGuests: GuestBackupStatus[]` with `{ vmid, vmName }`; `operationalHealth.taskTypes: TaskTypeSummary[]`).

- [ ] **Step 1: Rewrite the slide for a two-column layout**

Replace the entire contents of `src/engines/export/pptx/slides/backupCoverageSlide.ts` with:

```ts
/**
 * Pack B — Backup coverage & operational health: vzdump task summary,
 * uncovered VMs, per-type task health. KPI band + two side-by-side native
 * pptxgenjs tables (the slide is 12.33" wide). Side-by-side makes the prior
 * vertical-stack overlap structurally impossible. Brand-free, factual, neutral.
 * No editorial verbs, no numbers in strings.
 */
import type PptxGenJS from 'pptxgenjs'
import type { BackupCoverage } from '@/engines/aggregation/backupCoverage'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, addMoreFooter, CONTENT_W, M } from './_layout'

const TOP_N = 12

export function addBackupCoverageSlide(
  pptx: PptxGenJS,
  coverage: BackupCoverage,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(
    s,
    strings['protection.backupCoverage.heading'] ?? 'Backup coverage',
    strings['protection.backupCoverage.subtitle'] ?? 'vzdump tasks and operational health',
  )

  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['protection.backupCoverage.kpi.total'] ?? 'vzdump tasks',
        value: pptxNumber(coverage.vzdump.totalCount, locale),
      },
      {
        label: strings['protection.backupCoverage.kpi.success'] ?? 'Successful',
        value: pptxNumber(coverage.vzdump.successCount, locale),
      },
      {
        label: strings['protection.backupCoverage.kpi.failed'] ?? 'Failed',
        value: pptxNumber(coverage.vzdump.failedCount, locale),
      },
      {
        label: strings['protection.backupCoverage.kpi.coveredVmids'] ?? 'VMs with backup',
        value: pptxNumber(coverage.vzdump.coveredVmids, locale),
      },
      {
        label: strings['protection.backupCoverage.kpi.uncoveredCount'] ?? 'VMs without backup',
        value: pptxNumber(coverage.vzdump.uncoveredCount, locale),
      },
    ],
    y,
  )

  const cell = (text: string, opts: Record<string, unknown> = {}) => ({
    text: pptxSafeFormat(text),
    options: { fontFace: 'Arial', fontSize: 10, color: PPTX_COLORS.ink, ...opts },
  })
  const hdrCell = (text: string) => cell(text, { bold: true, color: PPTX_COLORS.inkMuted })

  // Two columns: left = uncovered guests, right = operational health. Both
  // start at the same y below the KPI row, so they cannot collide vertically.
  const leftX = M
  const leftW = CONTENT_W * 0.48
  const rightX = M + CONTENT_W * 0.52
  const rightW = CONTENT_W * 0.46
  const startY = y2
  const rowH = 0.24

  const subHead = (label: string, x: number, w: number): void => {
    s.addText(pptxSafeFormat(label), {
      x,
      y: startY,
      w,
      h: 0.28,
      color: PPTX_COLORS.ink,
      fontFace: 'Arial',
      fontSize: 11,
      bold: true,
    })
  }
  const tableY = startY + 0.32

  // LEFT — VMs without a successful backup (capped + remainder footer).
  subHead(
    strings['protection.backupCoverage.uncovered.heading'] ?? 'VMs without successful backup',
    leftX,
    leftW,
  )
  if (coverage.vzdump.uncoveredGuests.length === 0) {
    s.addText(
      pptxSafeFormat(
        strings['protection.backupCoverage.uncovered.none'] ??
          'All VMs have at least one successful backup.',
      ),
      {
        x: leftX,
        y: tableY,
        w: leftW,
        h: 0.3,
        color: PPTX_COLORS.inkMuted,
        fontFace: 'Arial',
        fontSize: 10,
      },
    )
  } else {
    const uncovHdr = [
      hdrCell(strings['protection.backupCoverage.col.vmName'] ?? 'VM'),
      hdrCell(strings['protection.backupCoverage.col.vmId'] ?? 'VM ID'),
    ]
    const shown = coverage.vzdump.uncoveredGuests.slice(0, TOP_N)
    const uncovRows = shown.map((g) => [cell(g.vmName), cell(g.vmid)])
    s.addTable([uncovHdr, ...uncovRows], {
      x: leftX,
      y: tableY,
      w: leftW,
      colW: [leftW * 0.7, leftW * 0.3],
      rowH,
      valign: 'middle',
      border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
      autoPage: false,
    })
    const remainder = coverage.vzdump.uncoveredGuests.length - shown.length
    if (remainder > 0) {
      addMoreFooter(
        s,
        strings['protection.backupCoverage.more'] ?? '+ {{count}} more guests without backup',
        remainder,
        locale,
        { x: leftX, y: tableY + (shown.length + 1) * rowH + 0.06, w: leftW, h: 0.3 },
      )
    }
  }

  // RIGHT — operational health per task type.
  subHead(
    strings['protection.backupCoverage.operationalHealth.heading'] ?? 'Operational health',
    rightX,
    rightW,
  )
  if (coverage.operationalHealth.taskTypes.length > 0) {
    const ohHdr = [
      hdrCell(strings['protection.backupCoverage.col.type'] ?? 'Type'),
      cell(strings['protection.backupCoverage.col.total'] ?? 'Total', {
        bold: true,
        color: PPTX_COLORS.inkMuted,
        align: 'right',
      }),
      cell(strings['protection.backupCoverage.col.ok'] ?? 'OK', {
        bold: true,
        color: PPTX_COLORS.inkMuted,
        align: 'right',
      }),
      cell(strings['protection.backupCoverage.col.failed'] ?? 'Failed', {
        bold: true,
        color: PPTX_COLORS.inkMuted,
        align: 'right',
      }),
    ]
    const ohRows = coverage.operationalHealth.taskTypes
      .slice(0, TOP_N)
      .map((t) => [
        cell(t.type),
        cell(pptxNumber(t.total, locale), { align: 'right' }),
        cell(pptxNumber(t.ok, locale), { align: 'right' }),
        cell(pptxNumber(t.failed, locale), { align: 'right' }),
      ])
    s.addTable([ohHdr, ...ohRows], {
      x: rightX,
      y: tableY,
      w: rightW,
      colW: [rightW * 0.46, rightW * 0.18, rightW * 0.18, rightW * 0.18],
      rowH,
      valign: 'middle',
      border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
      autoPage: false,
    })
  }
}
```

- [ ] **Step 2: Add the i18n key to all four locales**

In each `pptx.json`, add `backupCoverage.more` to the `protection` object created in Task 2 (so it becomes `protection: { fsFill: {...}, backupCoverage: { more: "…" } }`):

`en`: `"backupCoverage": { "more": "+ {{count}} more guests without backup" }`
`fr`: `"backupCoverage": { "more": "+ {{count}} autres invités sans sauvegarde" }`
`de`: `"backupCoverage": { "more": "+ {{count}} weitere Gäste ohne Sicherung" }`
`it`: `"backupCoverage": { "more": "+ {{count}} altri ospiti senza backup" }`

(Remember the comma after the `fsFill` object.)

- [ ] **Step 3: Write the failing test**

In `src/engines/export/pptx/builder.test.ts`, add a `BackupCoverage` factory after the `fsRisk` helper (Task 2):

```ts
const backupCov = (nUncovered: number): BackupCoverage => ({
  vzdump: {
    tasks: [],
    totalCount: 20,
    successCount: 18,
    failedCount: 2,
    coveredVmids: 5,
    uncoveredGuests: Array.from({ length: nUncovered }, (_, i) => ({
      vmid: String(200 + i),
      vmName: `guest-${i}`,
      lastSuccessAgeDays: null,
      covered: false,
    })),
    uncoveredCount: nUncovered,
    guestStatuses: [],
  },
  operationalHealth: {
    taskTypes: [{ type: 'vzdump', total: 20, ok: 18, failed: 2 }],
    totalTasks: 20,
    totalOk: 18,
    totalFailed: 2,
  },
})
```

Add the test:

```ts
describe('Fix 3 — backup-coverage side-by-side + footer', () => {
  it('shows both sub-headings and a remainder footer when uncovered exceeds the cap', async () => {
    const txt = await renderSlideText((p) => addBackupCoverageSlide(p, backupCov(15), {}, 'en'))
    expect(txt).toContain('VMs without successful backup')
    expect(txt).toContain('Operational health')
    expect(txt).toContain('more guests without backup')
    expect(txt).toContain('+ 3 more') // 15 − 12
  })

  it('omits the footer when uncovered fits', async () => {
    const txt = await renderSlideText((p) => addBackupCoverageSlide(p, backupCov(8), {}, 'en'))
    expect(txt).not.toContain('more guests without backup')
  })
})
```

- [ ] **Step 4: Run the test, key parity, typecheck**

Run: `npx vitest run src/engines/export/pptx/builder.test.ts -t "Fix 3" && npx vitest run src/i18n/keyParity.test.ts && npm run typecheck`
Expected: PASS on all three.

- [ ] **Step 5: Commit**

```bash
git add src/engines/export/pptx/slides/backupCoverageSlide.ts src/engines/export/pptx/builder.test.ts src/i18n/locales/en/pptx.json src/i18n/locales/fr/pptx.json src/i18n/locales/de/pptx.json src/i18n/locales/it/pptx.json
git commit -m "fix(pptx): render backup-coverage tables side-by-side to stop overlap"
```

---

### Task 5: Network slide — stop embedding the blurry oversized raster (Fix 4, interim)

**Files:**
- Modify: `src/engines/export/pptx/slides/networkSlide.ts`
- Test: `src/engines/export/pptx/builder.test.ts`

**Interfaces:**
- Consumes: existing `addNetworkSlide(pptx, networkPng, strings, locale, oversized, network)` signature — unchanged. Only the `oversized` branch body changes.

- [ ] **Step 1: Replace the oversized branch body**

In `src/engines/export/pptx/slides/networkSlide.ts`, replace the `if (oversized) { … } else { … }` block inside `if (networkPng && networkPng.length > 0)` with:

```ts
  if (networkPng && networkPng.length > 0) {
    if (oversized) {
      // INTERIM (superseded by Spec 2's topology tree): the upstream SVG is
      // extreme-portrait (e.g. 1762×14092). Rasterized into a wide-short slide
      // box it is an unreadable blur, so DO NOT embed it. The KPI cards above
      // carry the facts; point to the HTML report, which inlines the full SVG.
      addNote(
        s,
        strings['network.oversizedNote'] ?? 'Full network diagram available in the HTML report.',
        y,
      )
    } else {
      // Locked-safe PNG embed (Pitfall 1) — addChartImage always emits an
      // image/png data URI; PowerPoint renders it natively.
      addChartImage(s, networkPng, { x: M, y, w: CONTENT_W, h: SLIDE.h - y - M })
    }
  } else {
    addNote(s, strings['network.absent'] ?? 'No network diagram is included in this report.', y)
  }
```

(`addChartImage`, `SLIDE`, and `addNote` all remain imported and used; no import changes needed.)

- [ ] **Step 2: Write the failing test**

In `src/engines/export/pptx/builder.test.ts`, add inside `describe('buildPptx — golden structural snapshot', ...)` (it reuses the `wasmBytes` + `chartSvgToPng` already imported at the top):

```ts
  it('Fix 4 — oversized network slide omits the raster and shows the HTML-report note', async () => {
    const a = snap('a', 3, TODAY)
    const { view, trends } = buildExportView(a, [a], MODE, TODAY)
    const networkPng = await chartSvgToPng(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#0a0"/></svg>',
      40,
      40,
      wasmBytes,
    )
    const oversized = await buildPptx(view, trends, strings, 'en', {
      networkPng,
      networkOversized: true,
    })
    const embedded = await buildPptx(view, trends, strings, 'en', { networkPng })
    // No embedded PNG media in the oversized deck → strictly smaller bytes.
    expect(oversized.byteLength).toBeLessThan(embedded.byteLength)
    const txt = new TextDecoder('latin1').decode(new Uint8Array(oversized))
    expect(txt).toContain('Full network diagram available in the HTML report.')
  })
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npx vitest run src/engines/export/pptx/builder.test.ts -t "Fix 4"`
Expected: PASS — the oversized deck is smaller (no media part) and carries the note.

- [ ] **Step 4: Commit**

```bash
git add src/engines/export/pptx/slides/networkSlide.ts src/engines/export/pptx/builder.test.ts
git commit -m "fix(pptx): stop embedding the blurry oversized network raster (interim)"
```

---

### Task 6: Full gate run + manual deck verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full quality gates**

```bash
npm run typecheck
npx @biomejs/biome check .
npm run test:run
npm run build
npm run check:bundle-size
```

Expected: all green. (`npm run lint` is intercepted by RTK — use the `biome check` form above. If the real cv4pve workbook is staged and `--coverage` is run, use `npm run test:coverage -- --testTimeout=60000` per the realfile-timeout gotcha.)

- [ ] **Step 2: Coverage gate on engines**

```bash
npm run test:coverage -- --testTimeout=60000
```

Expected: `engines/` ≥75% (the `fsFillRisk.ts` filter is covered by Task 1's test).

- [ ] **Step 3: Manual deck inspection (acceptance criteria)**

Run `npm run dev`, drop the real cv4pve export (`…/scratchpad/report/report.xlsx`), export PPTX, and confirm against the spec's acceptance criteria:
1. **Estate overview** shows "VM storage used ≈ 49.9 TiB" and "VM storage capacity ≈ 110.5 TiB" — never "Provisioned 3.1 TiB" / "Used storage 0 GiB".
2. **FS fill risk** lists no `squashfs`/`iso9660`/`erofs` rows; the table fits one slide; a remainder footer appears only when truncated.
3. **Backup coverage** renders the two tables side-by-side with no overlap; the uncovered table shows top rows + a remainder footer.
4. **Network** (oversized) shows the KPI cards + the HTML-report note, no blurry image.

- [ ] **Step 4: Final confirmation**

If anything in Step 3 fails, return to the owning task. Otherwise the spec is fully implemented across commits from Tasks 1–5. (No squash merge — preserve the per-fix commit history.)

---

## Self-Review

**1. Spec coverage**

| Spec item | Task |
|---|---|
| Fix 1 — overview storage KPIs (`OverviewData.vmStorage`, builder mapping, `—` guard, new keys) | Task 3 |
| Fix 2 — engine `squashfs`/`iso9660`/`erofs` exclusion before all counting | Task 1 |
| Fix 2 — slide `TOP_N`→~12 + remainder footer (no HTML pointer) | Task 2 |
| Fix 3 — backup two-column side-by-side + capped uncovered + footer | Task 4 |
| Fix 4 — network oversized branch stops embedding raster, shows HTML note | Task 5 |
| i18n: `overview.vmStorageUsed/Capacity`, `protection.fsFill.more`, `protection.backupCoverage.more` in all four locales | Tasks 2, 3, 4 |
| `{{count}}` substituted in-slide via `.replace` (not the worker) | `addMoreFooter` (Task 2) |
| Tests: `fsFillRisk.test.ts` (pseudo-FS excluded); `builder.test.ts` (overview labels; fsFill/backup footers) | Tasks 1, 2, 3, 4 (+ Fix 4 in 5) |
| Engines pure; coverage ≥75%; keyParity; typecheck/biome/build/bundle-size | Tasks 1, 6 |
| Out of scope: HTML renderer, cluster-detail per-VM storage, `OperationalInsights` field removal, network topology tree | Untouched (verified) |

**2. Placeholder scan:** No TBD/TODO; every code step carries full content.

**3. Type consistency:** `addMoreFooter(s, label, remainder, locale, box)` — defined in Task 2, consumed identically in Tasks 2 and 4. `OverviewData.vmStorage: { usedMib: number; capacityMib: number } | null` — defined in Task 3, constructed once in `builder.ts` (Task 3). `FsFillRisk`/`FsRiskRow`/`BackupCoverage`/`GuestBackupStatus`/`TaskTypeSummary` shapes used in test factories match their engine definitions (`fsFillRisk.ts`, `backupCoverage.ts`). `TOP_N = 12` in both `fsFillSlide.ts` and `backupCoverageSlide.ts`.

## Execution note

This plan is four independent fixes (Tasks 1–5) plus a verification pass (Task 6). Task 2 must land before Task 4 (the shared `addMoreFooter` helper). Tasks 1, 3, 5 are order-independent. Subagent-driven execution should respect the Task 2 → Task 4 ordering; otherwise tasks can be reviewed and merged in any order.
