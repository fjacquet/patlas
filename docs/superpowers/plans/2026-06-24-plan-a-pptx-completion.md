# Plan A — PPTX Completion (branding + three Proxmox-native slides) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the user-facing "vatlas" branding in the generated deck/exports and add three deck slides for the new Proxmox-native metrics (Snapshot Sprawl, Storage Content, Cluster Health).

**Architecture:** Each new slide is a pure builder function in `src/engines/export/pptx/slides/`, reading one existing `EstateView` slice (no new engine work), modeled exactly on `monsterSlide.ts`/`rightSizingSlide.ts` (KPI band + native pptxgenjs shapes/table; never rasterized SVG). Slides register in `builder.ts` after `addMonsterSlide` and before `addEosSlide`, each gated on a non-empty condition. New keys land in the `pptx` i18n namespace across all four locales.

**Tech Stack:** TypeScript (strict), pptxgenjs 4, react-i18next, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-24-pptx-eos-network-design.md` (Plan A section).

## Global Constraints

- Engines pure (no React/DOM/Zustand; Zod only at the parser boundary). No new engine work in this plan — slides read existing `EstateView` slices.
- PPTX visuals use **native pptxgenjs shapes/text, not rasterized SVG** (resvg-no-font: rasterized SVG text vanishes). Follow the `monsterSlide`/`rightSizingSlide` pattern exactly.
- i18n keys in all four locales (`en`/`fr`/`de`/`it`); `src/i18n/keyParity.test.ts` enforces identical key paths; the `terminology` test forbids VMware tokens (no "vCenter"/"ESXi"/"RVTools"/"VM" framing — use Proxmox terms); no pre-formatted numbers in strings; no editorial verbs ("recommend/should/poor/good").
- No user-facing export string may contain "vatlas" (Task 1 adds a grep gate).
- No NUL bytes in `.ts`/`.tsx` (verify targeted edits).
- Commit prefix `feat(pA-NN): …` / `fix(pA-NN): …`. Signed commits (never `--no-gpg-sign`).
- Run the FULL `npm run typecheck` (app + `tsconfig.test.json`), not just `rtk tsc`, after any shared-type touch.
- Biome: run `npx @biomejs/biome check .` (NOT `npm run lint` — RTK intercepts it). Format with `--write` before committing.

## Reference facts (from codebase recon — use verbatim)

- `addMonsterSlide(pptx: PptxGenJS, monsters: MonsterEstate, strings: ExportStrings, locale: ExportLocale): void` — KPI count via `addKpiRow(s, [...], y)`, then `s.addTable([header, ...dataRows], {...})`. Top-N rows. Emit guard in `builder.ts`: `if (view.monsters.count > 0) addMonsterSlide(...)`.
- `addRightSizingSlide(pptx, sizing: EstateSizing, strings, locale): void` — KPI row + native `s.addShape('roundRect', {...})` bars. Emit guard: `if (view.sizing.hasUsageData) addRightSizingSlide(...)`.
- Deck builder: `src/engines/export/pptx/builder.ts`, `buildPptx(view: EstateView, trends, strings, locale, opts)`. Current tail order: … `addContentionAnnex` (conditional) → right-sizing (conditional) → monster (conditional) → `addEosSlide(pptx, view.eos, png('eosBar'), strings, locale)` → planned → trends → inventory → physical. **Insert the three new slides between the monster block and `addEosSlide`.**
- Slice shapes (already on `EstateView`):
  - `view.snapshotSprawl: SnapshotSprawl { rows: SnapshotSprawlRow[]; count: number; guestsWithSnapshots: number; totalSizeMib: number; oldestAgeDays: number | null }`; `SnapshotSprawlRow { guestName; guestId; guestType: 'qemu'|'lxc'; node; name; ageDays: number|null; sizeMib: number; includeRam: boolean }` (rows oldest-first).
  - `view.storageContent: StorageContentHealth { byContent: { content; count; totalSizeMib }[]; byStorage: { storage; count; totalSizeMib }[]; backups: { rows: BackupFileRow[]; count; guestsCovered; totalSizeMib; newestAgeDays: number|null; oldestAgeDays: number|null }; totalSizeMib; fileCount }` (byContent/byStorage sorted size desc).
  - `view.clusterHealth: ClusterHealth { ha: { resources: ProxmoxHaResourceRow[]; managedCount; quorumStatus: string|null; fencingStatus: string|null; services: ProxmoxHaStatusRow[] }; backups: { jobs: ProxmoxBackupJobRow[]; jobCount; enabledCount; guestsCovered } }`.
- `ExportStrings` is the flattened `pptx` namespace (dot keys, e.g. `strings['eos.title']`); slide code reads `strings['x.y'] ?? 'English fallback'`. New nested keys in `pptx.json` flow into `ExportStrings` automatically. Verify the assembly file (grep `ExportStrings` / `pptx` namespace loader) during Task 1 and note its path in the report.
- Branded MiB→GiB conversion: use the existing `gibToMib`/`mib` helpers and the same GiB formatting other slides use (`fmtInt`/locale formatter). NEVER raw `* 1.048576` (ADR-0010). Snapshot/Storage sizes are `number` MiB — divide by 1024 only via the project's existing unit/format helpers; read `monsterSlide.ts` for the exact GiB-format call it uses for vRAM.

---

### Task 1: Branding — remove user-facing "vatlas"

**Files:**
- Modify: `src/engines/export/pptx/slides/titleSlide.ts:114` (the `t('generated', 'Generated by vatlas — factual estate synthesis')` default)
- Modify: `src/hooks/useExport.ts:23-33` (`exportFilename` — `vatlas_${vc}_${iso}.${ext}` → `patlas_…`)
- Modify: `src/components/inventory/DataTable.tsx:135` (`vatlas-${objectKind}-…csv` → `patlas-…`)
- Modify: `src/pwa/registerSW.ts:18-19` (stale `/vatlas/` comment → `/patlas/`)
- Modify: `src/i18n/locales/{en,fr,de,it}/pptx.json` — the `title.generated` value if it contains "vatlas"
- Test: `src/hooks/useExport.test.ts` (create if absent) and a repo-wide grep gate

**Interfaces:**
- Consumes: `exportFilename(vCenterLabel: string, snapshotCount: number, capturedAt: Date, ext: 'html'|'pptx'): string` (existing export).
- Produces: nothing new; behavioral change only (filenames now `patlas_…`).

- [ ] **Step 1: Write the failing test** — `src/hooks/useExport.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { exportFilename } from './useExport'

describe('exportFilename', () => {
  it('uses the patlas_ prefix (not vatlas)', () => {
    const name = exportFilename('pve-prod', 1, new Date('2026-06-24T00:00:00Z'), 'pptx')
    expect(name).toBe('patlas_pve-prod_2026-06-24.pptx')
    expect(name).not.toContain('vatlas')
  })

  it('uses multi for >1 snapshot', () => {
    expect(exportFilename('ignored', 3, new Date('2026-06-24T00:00:00Z'), 'html')).toBe(
      'patlas_multi_2026-06-24.html',
    )
  })
})
```

- [ ] **Step 2: Run it, verify it fails** — `npm run test:run -- useExport.test` → FAIL (`exportFilename` returns `vatlas_…`).

- [ ] **Step 3: Make the edits**
  - `useExport.ts`: change the return template to `` `patlas_${vc}_${iso}.${ext}` ``.
  - `DataTable.tsx:135`: change to `` a.download = `patlas-${objectKind}-${yyyymmdd(new Date())}.csv` ``.
  - `titleSlide.ts:114`: change the fallback default to `'Generated by patlas — factual estate synthesis'`.
  - `registerSW.ts:18-19`: change the comment `/vatlas/` → `/patlas/` (comment only; do not write the literal `/vatlas/` token anywhere — the grep gate in Step 5 would flag it).
  - `pptx.json` (all 4 locales): if `title.generated` contains "vatlas", change it to the patlas equivalent (keep each locale's existing wording, only swap the product name).

- [ ] **Step 4: Run tests** — `npm run test:run -- useExport.test` → PASS. Then `npm run test:run -- pptx` and `npm run test:run -- DataTable` → no regressions.

- [ ] **Step 5: Add the grep gate** — append to `src/hooks/useExport.test.ts` (or a small `src/branding.test.ts`) a test that fails if any user-facing export string contains the old product name. Build the search token at runtime so the gate does not match itself:

```typescript
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('no user-facing legacy brand string', () => {
  const token = ['v', 'atlas'].join('') // assembled so this test file is not a self-match
  const files = [
    'src/hooks/useExport.ts',
    'src/components/inventory/DataTable.tsx',
    'src/engines/export/pptx/slides/titleSlide.ts',
  ]
  for (const f of files) {
    it(`${f} contains no legacy product name`, () => {
      expect(readFileSync(f, 'utf8')).not.toContain(token)
    })
  }
})
```

- [ ] **Step 6: Verify and commit** — `npm run typecheck`, `npx @biomejs/biome check .` (run `--write` first if needed), `npm run test:run`. Then:

```bash
git add src/hooks/useExport.ts src/hooks/useExport.test.ts src/components/inventory/DataTable.tsx src/engines/export/pptx/slides/titleSlide.ts src/pwa/registerSW.ts src/i18n/locales/*/pptx.json
git commit -m "fix(pA-01): rebrand user-facing export strings vatlas→patlas"
```

---

### Task 2: `snapshotSprawlSlide`

**Files:**
- Create: `src/engines/export/pptx/slides/snapshotSprawlSlide.ts`
- Modify: `src/i18n/locales/{en,fr,de,it}/pptx.json` (add a `snapshotSprawl` key block)
- Test: extend `src/engines/export/pptx/builder.test.ts` (emit/omit via `slideCount` delta) — done in Task 5 when registered; this task's own test asserts the builder function runs and reads the slice.
- Test: `src/engines/export/pptx/slides/snapshotSprawlSlide.test.ts`

**Interfaces:**
- Consumes: `view.snapshotSprawl: SnapshotSprawl` (see Reference facts), `ExportStrings`, `ExportLocale`.
- Produces: `export function addSnapshotSprawlSlide(pptx: PptxGenJS, sprawl: SnapshotSprawl, strings: ExportStrings, locale: ExportLocale): void`.

**Content mapping (exact):**
- KPI band (4 tiles): snapshots = `sprawl.count`; guests w/ snapshots = `sprawl.guestsWithSnapshots`; total GiB = `sprawl.totalSizeMib` formatted as GiB; oldest days = `sprawl.oldestAgeDays ?? 0` (label "—" handled by formatter when null — match how other slides show a null metric; if unsure, render `0`).
- Native table: columns Guest | Node | Checkpoint | Age (days) | Size (GiB). Rows from `sprawl.rows` (already oldest-first), capped at a TOP_N constant = 18 (mirror `monsterSlide`'s TOP_N). Map: `guestName`, `node`, `name`, `ageDays ?? '—'`, `sizeMib`→GiB.
- i18n keys (nested under `snapshotSprawl`): `title`, `kpi.snapshots`, `kpi.guests`, `kpi.totalGib`, `kpi.oldestDays`, `col.guest`, `col.node`, `col.checkpoint`, `col.ageDays`, `col.sizeGib`. No VMware tokens, no editorial verbs, no embedded numbers.

- [ ] **Step 1: Read the template** — read `src/engines/export/pptx/slides/monsterSlide.ts` in full to learn the exact `pptx.addSlide()`, `addKpiRow`, `s.addTable`, title-text, `PPTX_COLORS`, and GiB-format calls. Reproduce that structure precisely; do not invent pptxgenjs helper names.

- [ ] **Step 2: Write the failing test** — `snapshotSprawlSlide.test.ts`:

```typescript
import PptxGenJS from 'pptxgenjs'
import { describe, expect, it } from 'vitest'
import type { SnapshotSprawl } from '@/engines/aggregation/snapshotSprawl'
import { addSnapshotSprawlSlide } from './snapshotSprawlSlide'

const strings = {} as Record<string, string> // fallbacks exercised

const sprawl: SnapshotSprawl = {
  rows: [
    { guestName: 'web-01', guestId: '100', guestType: 'qemu', node: 'pve1', name: 'pre-patch', ageDays: 42, sizeMib: 2048, includeRam: false },
  ],
  count: 1,
  guestsWithSnapshots: 1,
  totalSizeMib: 2048,
  oldestAgeDays: 42,
}

describe('addSnapshotSprawlSlide', () => {
  it('adds exactly one slide to the deck', () => {
    const pptx = new PptxGenJS()
    addSnapshotSprawlSlide(pptx, sprawl, strings, 'en')
    // pptxgenjs exposes the slide array internally; assert via write or slide count helper.
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })
})
```

(If `pptx.slides` is not accessible in the installed pptxgenjs, fall back to `await pptx.write({ outputType: 'arraybuffer' })` and count `ppt/slides/slideN.xml` via the `slideCount` helper copied from `builder.test.ts`. Read `builder.test.ts:84-88` for that helper.)

- [ ] **Step 3: Run it, verify it fails** — `npm run test:run -- snapshotSprawlSlide` → FAIL (module not found).

- [ ] **Step 4: Implement** `snapshotSprawlSlide.ts` following the monsterSlide structure with the Content mapping above. Add the `snapshotSprawl` key block to all four `pptx.json` files.

- [ ] **Step 5: Run tests** — `npm run test:run -- snapshotSprawlSlide` → PASS. Run `npm run test:run -- keyParity terminology` → PASS.

- [ ] **Step 6: Verify and commit** — `npm run typecheck`, `npx @biomejs/biome check .`. Then:

```bash
git add src/engines/export/pptx/slides/snapshotSprawlSlide.ts src/engines/export/pptx/slides/snapshotSprawlSlide.test.ts src/i18n/locales/*/pptx.json
git commit -m "feat(pA-02): snapshot sprawl deck slide"
```

---

### Task 3: `storageContentSlide`

**Files:**
- Create: `src/engines/export/pptx/slides/storageContentSlide.ts`
- Modify: `src/i18n/locales/{en,fr,de,it}/pptx.json` (add a `storageContent` key block)
- Test: `src/engines/export/pptx/slides/storageContentSlide.test.ts`

**Interfaces:**
- Consumes: `view.storageContent: StorageContentHealth`, `ExportStrings`, `ExportLocale`.
- Produces: `export function addStorageContentSlide(pptx: PptxGenJS, storage: StorageContentHealth, strings: ExportStrings, locale: ExportLocale): void`.

**Content mapping (exact):**
- KPI band (4 tiles): total GiB = `storage.totalSizeMib`→GiB; files = `storage.fileCount`; content types = `storage.byContent.length`; backups = `storage.backups.count`.
- Two native tables side-by-side or stacked (follow monsterSlide table mechanics; stacked is fine):
  - By content type: columns Content | Count | Size (GiB) from `storage.byContent` (already sorted desc), cap 12.
  - By storage: columns Storage | Count | Size (GiB) from `storage.byStorage` (already sorted desc), cap 12.
- i18n keys (nested under `storageContent`): `title`, `kpi.totalGib`, `kpi.files`, `kpi.contentTypes`, `kpi.backups`, `byContent.heading`, `byStorage.heading`, `col.content`, `col.storage`, `col.count`, `col.sizeGib`.

- [ ] **Step 1: Write the failing test** — `storageContentSlide.test.ts` (mirror Task 2's test shape with a minimal `StorageContentHealth` fixture: one `byContent` entry, one `byStorage` entry, `backups` with `rows: []`, `count: 0`, `guestsCovered: 0`, `totalSizeMib: 0`, `newestAgeDays: null`, `oldestAgeDays: null`, `totalSizeMib: 4096`, `fileCount: 3`). Assert one slide added.

- [ ] **Step 2: Run it, verify it fails** — `npm run test:run -- storageContentSlide` → FAIL.

- [ ] **Step 3: Implement** following monsterSlide structure + the Content mapping. Add the `storageContent` block to all four `pptx.json`.

- [ ] **Step 4: Run tests** — `npm run test:run -- storageContentSlide keyParity terminology` → PASS.

- [ ] **Step 5: Verify and commit** — `npm run typecheck`, `npx @biomejs/biome check .`. Then:

```bash
git add src/engines/export/pptx/slides/storageContentSlide.ts src/engines/export/pptx/slides/storageContentSlide.test.ts src/i18n/locales/*/pptx.json
git commit -m "feat(pA-03): storage content deck slide"
```

---

### Task 4: `clusterHealthSlide`

**Files:**
- Create: `src/engines/export/pptx/slides/clusterHealthSlide.ts`
- Modify: `src/i18n/locales/{en,fr,de,it}/pptx.json` (add a `clusterHealth` key block)
- Test: `src/engines/export/pptx/slides/clusterHealthSlide.test.ts`

**Interfaces:**
- Consumes: `view.clusterHealth: ClusterHealth`, `ExportStrings`, `ExportLocale`.
- Produces: `export function addClusterHealthSlide(pptx: PptxGenJS, health: ClusterHealth, strings: ExportStrings, locale: ExportLocale): void`.

**Content mapping (exact):**
- KPI band (4 tiles): quorum = `health.ha.quorumStatus ?? '—'` (text KPI; if the KPI helper is numeric-only, render quorum/fencing as a small text line instead — read `monsterSlide`/`rightSizingSlide` to see whether `addKpiRow` accepts string values; if not, put quorum/fencing as `s.addText` lines above the tables and keep numeric tiles for the counts); fencing = `health.ha.fencingStatus ?? '—'`; HA resources = `health.ha.managedCount`; backup jobs = `health.backups.jobCount`.
- Two native tables:
  - HA services: columns Service | Status from `health.ha.services` (use the row's service-name and status fields — read `ProxmoxHaStatusRow` in `src/types/snapshot.ts` for exact field names), cap 12.
  - Backup jobs: columns Job | Schedule | Enabled from `health.backups.jobs` (read `ProxmoxBackupJobRow` for exact fields — likely `id`/`schedule`/`enabled`), cap 12.
- i18n keys (nested under `clusterHealth`): `title`, `kpi.quorum`, `kpi.fencing`, `kpi.haResources`, `kpi.backupJobs`, `services.heading`, `jobs.heading`, `col.service`, `col.status`, `col.job`, `col.schedule`, `col.enabled`.

- [ ] **Step 1: Read row types** — read `ProxmoxHaStatusRow` and `ProxmoxBackupJobRow` in `src/types/snapshot.ts` to get exact field names for the tables; record them in the report.

- [ ] **Step 2: Write the failing test** — `clusterHealthSlide.test.ts` with a minimal `ClusterHealth` fixture (one `ha.services` row, one `backups.jobs` row, `quorumStatus: 'OK'`, `fencingStatus: 'OK'`, `managedCount: 1`, `resources: []`, `jobCount: 1`, `enabledCount: 1`, `guestsCovered: 1`). Assert one slide added.

- [ ] **Step 3: Run it, verify it fails** — `npm run test:run -- clusterHealthSlide` → FAIL.

- [ ] **Step 4: Implement** following monsterSlide structure + the Content mapping. Add the `clusterHealth` block to all four `pptx.json`.

- [ ] **Step 5: Run tests** — `npm run test:run -- clusterHealthSlide keyParity terminology` → PASS.

- [ ] **Step 6: Verify and commit** — `npm run typecheck`, `npx @biomejs/biome check .`. Then:

```bash
git add src/engines/export/pptx/slides/clusterHealthSlide.ts src/engines/export/pptx/slides/clusterHealthSlide.test.ts src/i18n/locales/*/pptx.json
git commit -m "feat(pA-04): cluster health deck slide"
```

---

### Task 5: Register the three slides in the deck + emit/omit gates + visual verification

**Files:**
- Modify: `src/engines/export/pptx/builder.ts` (import the three builders; call them after the monster block, before `addEosSlide`)
- Test: `src/engines/export/pptx/builder.test.ts` (emit/omit deltas)

**Interfaces:**
- Consumes: `addSnapshotSprawlSlide`, `addStorageContentSlide`, `addClusterHealthSlide` (Tasks 2-4).
- Produces: deck with the three slides inserted in fixed order when their data is non-empty.

**Emit conditions (exact):**
- Snapshot Sprawl: `if (view.snapshotSprawl.count > 0) addSnapshotSprawlSlide(pptx, view.snapshotSprawl, strings, locale)`
- Storage Content: `if (view.storageContent.fileCount > 0) addStorageContentSlide(pptx, view.storageContent, strings, locale)`
- Cluster Health: `if (view.clusterHealth.ha.services.length > 0 || view.clusterHealth.ha.managedCount > 0 || view.clusterHealth.backups.jobCount > 0) addClusterHealthSlide(pptx, view.clusterHealth, strings, locale)`

Insert these three blocks in this order immediately after the existing `if (view.monsters.count > 0) addMonsterSlide(...)` block and immediately before `addEosSlide(...)`.

- [ ] **Step 1: Write the failing tests** — in `builder.test.ts`, add a `describe('Plan A — new Proxmox slides')` using the existing `slideCount` helper and `buildExportView`. For each slide: build a view WITH the data (assert `slideCount` is baseline+N) and a view WITHOUT (assert baseline). Use the existing fixture builders in that file; populate `snapshotSprawl`/`storageContent`/`clusterHealth` via a snapshot fixture that carries `proxmoxSnapshots`/`proxmoxStorageContent`/`proxmoxHaStatus`+`proxmoxBackupJobs` rows so the aggregation produces non-empty slices. Read the top of `builder.test.ts` to see how snapshots are constructed, and read the three aggregation engines' tests for minimal row fixtures.

- [ ] **Step 2: Run them, verify they fail** — `npm run test:run -- builder.test` → FAIL (slide counts unchanged; new slides not registered).

- [ ] **Step 3: Implement** the registration in `builder.ts` (imports + the three guarded calls in order).

- [ ] **Step 4: Run tests** — `npm run test:run -- builder.test` → PASS. Then full `npm run test:run`.

- [ ] **Step 5: Visual verification (per the "verify deck visually" rule)** — generate a deck from the real report fixture and render it to confirm the three slides show legible native text:

```bash
# Build a deck from the real fixture via the existing test/dev path, then:
# soffice --headless --convert-to pdf <deck.pptx> --outdir <scratch>
# then Read the PDF pages for the three new slides.
```

Use the project's existing deck-generation test/dev entry (grep for how `builder.test.ts` or a dev script writes a `.pptx`); convert with `soffice`, Read the PDF, confirm Snapshot Sprawl / Storage Content / Cluster Health render with readable KPIs and tables (no missing text). Record the PDF path and a one-line visual confirmation in the report.

- [ ] **Step 6: Verify and commit** — `npm run typecheck`, `npx @biomejs/biome check .`, full `npm run test:run`. Then:

```bash
git add src/engines/export/pptx/builder.ts src/engines/export/pptx/builder.test.ts
git commit -m "feat(pA-05): register snapshot/storage/cluster slides with emit gates"
```

---

## Self-Review notes (author)

- Spec coverage: A1 branding → Task 1; A2 three slides → Tasks 2-4; registration + emit gates + visual verify → Task 5. ✅
- Correction vs spec: new slides insert before `addEosSlide` (not "before contentionAnnex"); `eosSlide` has no ESXi labels so no overlap with Plan B. ✅
- Open implementation detail flagged for implementer/reviewer: whether `addKpiRow` accepts string KPI values (Cluster Health quorum/fencing) — Task 4 instructs reading the template and falling back to `s.addText` lines if numeric-only. The reviewer should confirm the chosen rendering matches the native-shapes rule.
