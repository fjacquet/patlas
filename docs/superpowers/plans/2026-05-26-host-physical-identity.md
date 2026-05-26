# Host Physical Identity (serial / service tag) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface each ESXi host's physical identity (Serial / Service tag + Model + Vendor) in the web host-inventory table and a new auto-paginated PPTX slide, to support a datacenter move / hardware-replacement preparation.

**Architecture:** Pure parser extension — coalesce the RVTools `vHost` `Serial number` / `Service tag (serial #)` columns into one `VHostRow.serialNumber` field, validate it at the Zod boundary, carry it through the `perEsx` aggregation onto `EsxAggregate`, then display it (web columns + CSV) and emit a dedicated PPTX table slide. No new dependency, no network, no persistence. `model` / `vendor` already exist on the types but are displayed nowhere — this also surfaces them.

**Tech Stack:** TypeScript (strict), Zod 4 (parser boundary), TanStack React Table, pptxgenjs 4, react-i18next (en/fr/de/it), Vitest.

**Spec:** `docs/superpowers/specs/2026-05-26-host-physical-identity-design.md`

---

## Key facts the engineer must know before starting

- **RVTools source columns** (`vHost` sheet): `Serial number` (RVTools ≥ 3.11) and `Service tag (serial #)` (all versions). Precedence: prefer `Serial number`, fall back to `Service tag`, `''` if neither present.
- **The codebase convention is "required string, `''` when absent, never `undefined`."** All `VHostRow` / `EsxAggregate` string fields follow this (`faultDomain`, `model`, `vendor`, `esxVersion`). `serialNumber` follows the same rule — it is a **required** field, NOT optional. Adding a required field breaks every fixture's typecheck; Task 3 fixes them all.
- **Two-path display vs CSV** (`esxColumns.ts` doc): a column's `cell` renderer is the **display** path; the CSV export bypasses `cell` and reads the **raw** accessor (`row.getValue`). So a `cell` returning `value || '—'` shows `—` on screen but exports the raw `''` to CSV — exactly what we want.
- **`npm run typecheck` vs vitest:** vitest (esbuild) strips types and does NOT typecheck, so a test file with a missing field still *runs*. The full typecheck only happens under `npm run typecheck` (app + `tsconfig.test.json`). Per CLAUDE.md, `rtk tsc` only checks the app project — use `npm run typecheck` for the gate.
- **Lint:** run `npx @biomejs/biome check .` directly — `npm run lint` is intercepted by RTK and prints a bogus parse error.
- **Bundle-size gate reads `dist/` without building** — run `npm run build` first.
- **i18n parity gate** (`src/i18n/keyParity.test.ts`): every key added to `en/<ns>.json` MUST exist in `fr/`, `de/`, `it/` for the same namespace, or the test fails the build.
- **Export string bag:** `src/hooks/useExport.ts` flattens the entire `pptx` i18n resource bundle into a flat `Record<string,string>` keyed by dotted path (e.g. `physical.title`). Adding a top-level `physical` object to `pptx.json` auto-surfaces as `physical.*` in the slide's `strings` bag — **no collector wiring needed.**
- **Commit signing:** never pass `--no-gpg-sign` / `-c commit.gpgsign=false`. End commit messages with the `Co-Authored-By` trailer.
- **Commit prefix convention:** `<type>(NN-NN): …`. This feature has no GSD phase id; use a short scope like `feat(hwid-NN): …` where NN is the task number.

---

## File Structure

**Modified:**
- `src/types/vhost.ts` — add `serialNumber: string` to `VHostRow`.
- `src/engines/parser/schemas.ts` — add `serialNumber: z.string().trim()` to `VHostRowSchema`.
- `src/engines/parser/adapters/rvtools.ts` — add `serial` + `serviceTag` aliases to `VHOST_COLS`; coalesce in `adaptRvtoolsVHost`.
- `src/types/estate.ts` — add `serialNumber: string` to `EsxAggregate`.
- `src/engines/aggregation/perEsx.ts` — copy `serialNumber: h.serialNumber`.
- `src/components/inventory/columns/esxColumns.ts` — three columns + extend `esxDefaultVisible`.
- `src/i18n/locales/{en,fr,de,it}/inventory.json` — `col.serialNumber` / `col.model` / `col.vendor`.
- `src/i18n/locales/{en,fr,de,it}/pptx.json` — new `physical` object.
- `src/engines/export/pptx/builder.ts` — register the new slide (conditional, after inventory).
- Many `*.test.ts(x)` fixtures — add `serialNumber: ''` (Task 3).

**Created:**
- `src/engines/export/pptx/slides/physicalInventorySlide.ts` — the new slide.

---

### Task 1: Parser — extract & coalesce `serialNumber`

**Files:**
- Modify: `src/types/vhost.ts`
- Modify: `src/engines/parser/schemas.ts:92-105` (`VHostRowSchema`)
- Modify: `src/engines/parser/adapters/rvtools.ts:151-181` (`VHOST_COLS`) and `:375-394` (`adaptRvtoolsVHost`)
- Test: `src/engines/parser/adapters/rvtools.test.ts`

- [ ] **Step 1: Write the failing test**

Add this block inside `src/engines/parser/adapters/rvtools.test.ts` (the file already imports `describe`, `expect`, `it` and `adaptRvtoolsVHost`; if `adaptRvtoolsVHost` is not yet imported there, add it to the existing import from `./rvtools`). A `ParsedSheet` is `{ headers: string[]; rows: Record<string, unknown>[] }` — match the shape already used by other tests in this file.

```ts
describe('adaptRvtoolsVHost — serial / service tag', () => {
  const base = {
    Host: 'esx-1',
    Cluster: 'C1',
    '# CPU': 2,
    '# Cores': 24,
    Speed: 2600,
    '# Memory': 524288,
  }

  it('prefers Serial number over Service tag', () => {
    const rows = adaptRvtoolsVHost({
      headers: ['Host', 'Cluster', '# CPU', '# Cores', 'Speed', '# Memory', 'Serial number', 'Service tag (serial #)'],
      rows: [{ ...base, 'Serial number': 'SN-AAA', 'Service tag (serial #)': 'ST-BBB' }],
    })
    expect(rows[0]?.serialNumber).toBe('SN-AAA')
  })

  it('falls back to Service tag when Serial number is blank', () => {
    const rows = adaptRvtoolsVHost({
      headers: ['Host', 'Cluster', '# CPU', '# Cores', 'Speed', '# Memory', 'Serial number', 'Service tag (serial #)'],
      rows: [{ ...base, 'Serial number': '   ', 'Service tag (serial #)': 'ST-BBB' }],
    })
    expect(rows[0]?.serialNumber).toBe('ST-BBB')
  })

  it('falls back to Service tag on a pre-3.11 export (no Serial number column)', () => {
    const rows = adaptRvtoolsVHost({
      headers: ['Host', 'Cluster', '# CPU', '# Cores', 'Speed', '# Memory', 'Service tag (serial #)'],
      rows: [{ ...base, 'Service tag (serial #)': 'ST-CCC' }],
    })
    expect(rows[0]?.serialNumber).toBe('ST-CCC')
  })

  it('is the empty string when neither column is present', () => {
    const rows = adaptRvtoolsVHost({
      headers: ['Host', 'Cluster', '# CPU', '# Cores', 'Speed', '# Memory'],
      rows: [{ ...base }],
    })
    expect(rows[0]?.serialNumber).toBe('')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/engines/parser/adapters/rvtools.test.ts`
Expected: FAIL — `serialNumber` does not exist on the returned row (TS may also flag it, but vitest runs anyway; the assertions fail with `undefined`).

- [ ] **Step 3: Add `serialNumber` to the `VHostRow` type**

In `src/types/vhost.ts`, add this field immediately after the `vendor` field (line 38) and before `esxVersion`:

```ts
  /** RVTools `vHost.Serial number` (≥3.11) with fallback to
   *  `Service tag (serial #)` — the chassis serial a technician reads to
   *  physically locate the box. '' when absent. Plain text, no verdict. */
  serialNumber: string
```

- [ ] **Step 4: Add `serialNumber` to the Zod schema**

In `src/engines/parser/schemas.ts`, inside `VHostRowSchema` (the `z.object({…})` at line 92), add this line immediately after `vendor: z.string().trim(),`:

```ts
  serialNumber: z.string().trim(),
```

(The schema is typed `z.ZodType<VHostRow>`; without this line the file stops compiling once Step 3 lands — that is the intended lock-step.)

- [ ] **Step 5: Add the column aliases**

In `src/engines/parser/adapters/rvtools.ts`, inside `VHOST_COLS` (lines 151-181), add these two entries immediately after the `vendor: ['vendor'],` line:

```ts
  // Physical chassis identity for move/replacement prep. Two raw columns so
  // the normalizer can coalesce per row (Serial number wins, Service tag is
  // the fallback). Longest/most-specific spelling first.
  serial: ['serial number', 'serial no', 'serial'],
  serviceTag: ['service tag (serial #)', 'service tag', 'servicetag'],
```

- [ ] **Step 6: Coalesce in the adapter**

In `src/engines/parser/adapters/rvtools.ts`, inside the `adaptRvtoolsVHost` row map (the object literal returned for each `VHostRow`, lines 380-392), add this line immediately after `vendor: readString(readCol(row, cols.vendor)),`:

```ts
        serialNumber:
          readString(readCol(row, cols.serial)) || readString(readCol(row, cols.serviceTag)),
```

(`readString` returns a trimmed string or `''`; `'' || x` yields `x`, giving the per-row fallback. `readCol` returns `null` for an absent column, which `readString` maps to `''`.)

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run test:run -- src/engines/parser/adapters/rvtools.test.ts`
Expected: PASS — all four new assertions green.

- [ ] **Step 8: Commit**

```bash
rtk git add src/types/vhost.ts src/engines/parser/schemas.ts src/engines/parser/adapters/rvtools.ts src/engines/parser/adapters/rvtools.test.ts
rtk git commit -m "feat(hwid-01): parse vHost serial number / service tag

Coalesce RVTools Serial number -> Service tag into VHostRow.serialNumber;
extend the Zod boundary schema and the column-alias map.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Aggregation — carry `serialNumber` onto `EsxAggregate`

**Files:**
- Modify: `src/types/estate.ts` (`EsxAggregate`)
- Modify: `src/engines/aggregation/perEsx.ts:38-60`
- Test: `src/engines/aggregation/perEsx.test.ts`

- [ ] **Step 1: Add `serialNumber` to the `perEsx.test.ts` factory and write the failing test**

In `src/engines/aggregation/perEsx.test.ts`, add `serialNumber: ''` to the `host()` factory defaults, immediately after `vendor: '',` (line 19):

```ts
  serialNumber: '',
```

Then add this test inside the `describe('perEsx', …)` block:

```ts
  it('carries serialNumber / model / vendor through verbatim', () => {
    const d = first(
      perEsx([host({ serialNumber: 'SN-123', model: 'PowerEdge R640', vendor: 'Dell Inc.' })], [], 'configured'),
    )
    expect(d.serialNumber).toBe('SN-123')
    expect(d.model).toBe('PowerEdge R640')
    expect(d.vendor).toBe('Dell Inc.')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/engines/aggregation/perEsx.test.ts`
Expected: FAIL — `d.serialNumber` is `undefined` (the field is not yet copied).

- [ ] **Step 3: Add `serialNumber` to the `EsxAggregate` type**

In `src/types/estate.ts`, inside `interface EsxAggregate`, add this field immediately after `vendor: string` and before `esxVersion: string`:

```ts
  /** RVTools chassis serial / service tag (P-HWID; '' when absent). Factual
   *  physical-identity field for move/replacement prep — NO verdict. */
  serialNumber: string
```

- [ ] **Step 4: Copy it in `perEsx`**

In `src/engines/aggregation/perEsx.ts`, inside the returned object literal, add this line immediately after `vendor: h.vendor,` (line 57):

```ts
      serialNumber: h.serialNumber,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- src/engines/aggregation/perEsx.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/types/estate.ts src/engines/aggregation/perEsx.ts src/engines/aggregation/perEsx.test.ts
rtk git commit -m "feat(hwid-02): carry serialNumber onto EsxAggregate via perEsx

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Make every test fixture compile with the new required field

Tasks 1 and 2 added a **required** `serialNumber` to `VHostRow` and `EsxAggregate`. vitest runs without typechecking, so prior tasks' tests passed — but `npm run typecheck` is now red across every fixture that builds one of these objects. This task makes the whole project typecheck again. The edit is mechanical and identical everywhere: add `serialNumber: '',`.

**Files (VHostRow fixtures — add `serialNumber: ''` next to the existing `vendor` / `esxVersion` line):**
- `src/components/dr/DrSimPanel.test.tsx`
- `src/components/rightsizing/RightSizingView.test.tsx`
- `src/components/monstervm/MonsterVmView.test.tsx`
- `src/components/inventory/InventoryTree.test.tsx`
- `src/components/inventory/columns/columns.test.ts`
- `src/components/hosts/EsxDetail.test.tsx`
- `src/components/hosts/HostsView.test.tsx`
- `src/engines/aggregation/aggregateClusters.test.ts`
- `src/engines/aggregation/sizing.test.ts`
- `src/engines/aggregation/estateView.test.ts`
- `src/engines/aggregation/perCluster.test.ts`
- `src/engines/drSim/runScenario.test.ts`
- `src/engines/parser/parserEdges.test.ts`
- `src/engines/trends/buildTrendSeries.test.ts`
- `src/engines/snapshotMerge/mergeSnapshotsToEstate.test.ts`
- `src/engines/export/html/renderReport.test.tsx`
- `src/engines/export/html/assembleHtml.test.ts`
- `src/engines/export/chartBundle.test.ts`
- `src/engines/export/buildExportView.test.ts`
- `src/engines/eos/bucketEos.test.ts`
- `src/hooks/useEstateView.test.ts`

**Files (EsxAggregate fixtures — add `serialNumber: ''` next to the existing `vendor` / `poweredOnVms` line):**
- `src/components/dr/DrSimPanel.test.tsx`
- `src/components/inventory/InventoryTree.test.tsx`
- `src/components/hosts/EsxDetail.test.tsx`
- `src/engines/trends/buildTrendSeries.test.ts`

(`perEsx.test.ts` was handled in Task 2; `builder.test.ts` is handled in Task 5.)

- [ ] **Step 1: Run typecheck to see the full failure list**

Run: `npm run typecheck`
Expected: FAIL — many `TS2741: Property 'serialNumber' is missing` errors, one per fixture literal, across the files listed above.

- [ ] **Step 2: Add the field to each flagged literal**

For every `VHostRow` object literal (each contains the run `faultDomain: … model: … vendor: … esxVersion: …`), add this line immediately after the `vendor:` line:

```ts
  serialNumber: '',
```

For every `EsxAggregate` object literal (each ends with `poweredOnVms: …`), add the same line immediately after the `vendor:` line:

```ts
  serialNumber: '',
```

Many of these files use a single local factory function (e.g. a `host(over)` / `aggregate(over)` helper) — editing the factory's defaults once fixes all its call sites. Let the typecheck errors from Step 1 drive exactly which literals need the line; do not add it anywhere a full `VHostRow` / `EsxAggregate` is not being constructed.

- [ ] **Step 3: Run typecheck to verify it is clean**

Run: `npm run typecheck`
Expected: PASS — zero errors (app + test projects).

- [ ] **Step 4: Run the full test suite (nothing should have changed behaviorally)**

Run: `npm run test:run`
Expected: PASS — all suites green (the added `''` defaults change no assertions).

- [ ] **Step 5: Commit**

```bash
rtk git add -A
rtk git commit -m "test(hwid-03): add serialNumber to all VHostRow/EsxAggregate fixtures

Mechanical: the new required field on VHostRow/EsxAggregate broke fixture
typecheck. Default to '' everywhere (no behavioral change).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Web — three columns in the host table + i18n

**Files:**
- Modify: `src/components/inventory/columns/esxColumns.ts`
- Modify: `src/i18n/locales/en/inventory.json` (and `fr`, `de`, `it`)
- Test: `src/components/inventory/columns/columns.test.ts`

- [ ] **Step 1: Write the failing test**

`columns.test.ts` already imports `esxColumns` and `esxDefaultVisible` (it builds a `VHostRow`/`EsxAggregate` fixture; Task 3 added `serialNumber: ''` there). Add this block:

```ts
describe('esxColumns — physical identity', () => {
  it('exposes serialNumber, model and vendor columns', () => {
    const ids = esxColumns.map((c) => c.id)
    expect(ids).toContain('serialNumber')
    expect(ids).toContain('model')
    expect(ids).toContain('vendor')
  })

  it('makes all three visible by default', () => {
    expect(esxDefaultVisible).toContain('serialNumber')
    expect(esxDefaultVisible).toContain('model')
    expect(esxDefaultVisible).toContain('vendor')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/components/inventory/columns/columns.test.ts`
Expected: FAIL — the three ids are not present.

- [ ] **Step 3: Add the three column definitions**

In `src/components/inventory/columns/esxColumns.ts`, add these three entries to the `esxColumns` array, immediately after the `vmsAboveReadinessWarning` column object (the last entry, before the closing `]`):

```ts
  {
    accessorKey: 'serialNumber',
    id: 'serialNumber',
    header: 'inventory.col.serialNumber',
    // Display path shows the em-dash sentinel for an unreported serial; the
    // CSV export reads the RAW accessor ('') — two-path discipline.
    cell: (ctx) => ctx.getValue<string>() || '—',
  },
  {
    accessorKey: 'model',
    id: 'model',
    header: 'inventory.col.model',
    cell: (ctx) => ctx.getValue<string>() || '—',
  },
  {
    accessorKey: 'vendor',
    id: 'vendor',
    header: 'inventory.col.vendor',
    cell: (ctx) => ctx.getValue<string>() || '—',
  },
```

- [ ] **Step 4: Make them visible by default**

In the same file, extend the `esxDefaultVisible` tuple by adding the three ids before the closing `] as const` (after `'vcpuAllocated',`):

```ts
  'serialNumber',
  'model',
  'vendor',
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- src/components/inventory/columns/columns.test.ts`
Expected: PASS.

- [ ] **Step 6: Add the i18n keys (all four locales)**

In each of the four files, add three keys inside the existing `col` object (place them after the `vmsAboveReadinessWarning` key).

`src/i18n/locales/en/inventory.json`:
```json
    "serialNumber": "Serial / Service tag",
    "model": "Model",
    "vendor": "Vendor",
```

`src/i18n/locales/fr/inventory.json`:
```json
    "serialNumber": "N° de série / Service tag",
    "model": "Modèle",
    "vendor": "Constructeur",
```

`src/i18n/locales/de/inventory.json`:
```json
    "serialNumber": "Seriennummer / Service-Tag",
    "model": "Modell",
    "vendor": "Hersteller",
```

`src/i18n/locales/it/inventory.json`:
```json
    "serialNumber": "Numero di serie / Service tag",
    "model": "Modello",
    "vendor": "Produttore",
```

(Note: a `col.host` / `col.hostName` already exist; `col.cluster` already exists — do not duplicate. The three keys above are new.)

- [ ] **Step 7: Run the parity gate**

Run: `npm run test:run -- src/i18n/keyParity.test.ts`
Expected: PASS — the three keys exist identically in en/fr/de/it.

- [ ] **Step 8: Commit**

```bash
rtk git add src/components/inventory/columns/esxColumns.ts src/components/inventory/columns/columns.test.ts src/i18n/locales/en/inventory.json src/i18n/locales/fr/inventory.json src/i18n/locales/de/inventory.json src/i18n/locales/it/inventory.json
rtk git commit -m "feat(hwid-04): show serial / model / vendor columns in host table

Three default-visible columns on EsxTable (em-dash sentinel on display,
raw value in CSV) + i18n keys in en/fr/de/it.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: PPTX — new "Physical inventory" slide

**Files:**
- Create: `src/engines/export/pptx/slides/physicalInventorySlide.ts`
- Modify: `src/engines/export/pptx/builder.ts:24-32` (import), `:124-126` (registration)
- Modify: `src/i18n/locales/en/pptx.json` (and `fr`, `de`, `it`)
- Test: `src/engines/export/pptx/builder.test.ts`

- [ ] **Step 1: Add `serialNumber` to the `builder.test.ts` host fixture and write the failing test**

In `src/engines/export/pptx/builder.test.ts`, add `serialNumber: ''` to the `hostRow()` factory defaults, immediately after `vendor: '',` (line 47):

```ts
  serialNumber: '',
```

Then add this test inside the `describe('buildPptx — golden structural snapshot', …)` block:

```ts
  it('P-HWID: a view with host serials adds exactly one physical-inventory slide', async () => {
    const a = snap('a', 6, new Date('2026-01-01'))
    const withSerials: Snapshot = {
      ...a,
      vhost: a.vhost.map((h, i) => ({ ...h, serialNumber: `SN-${i}` })),
    }
    const ex = buildExportView(withSerials, [withSerials], MODE, TODAY)
    expect(ex.view.hosts.some((h) => h.serialNumber !== '')).toBe(true)
    const ab = await buildPptx(ex.view, ex.trends, strings, 'en')
    expect(slideCount(ab)).toBe(15) // 14 baseline + 1 physical inventory

    // No serials anywhere ⇒ slide omitted (baseline).
    const exNone = buildExportView(a, [a], MODE, TODAY)
    expect(exNone.view.hosts.every((h) => h.serialNumber === '')).toBe(true)
    expect(slideCount(await buildPptx(exNone.view, exNone.trends, strings, 'en'))).toBe(14)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/engines/export/pptx/builder.test.ts`
Expected: FAIL — the deck still has 14 slides for the serial case (slide not yet emitted).

- [ ] **Step 3: Create the slide**

Create `src/engines/export/pptx/slides/physicalInventorySlide.ts`:

```ts
/**
 * P-HWID — Physical inventory: a NATIVE pptxgenjs table of every host's
 * chassis identity (Serial / Service tag, Model, Vendor) for a move /
 * replacement prep. Auto-paginated so the COMPLETE host list spills across
 * as many slides as needed (a move needs every node, not a top-N). Native
 * table → text renders (the resvg trap only hits rasterized chart images).
 * Brand-free, factual; '' renders the em-dash sentinel, never a blank.
 */
import type PptxGenJS from 'pptxgenjs'
import type { EsxAggregate } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

export function addPhysicalInventorySlide(
  pptx: PptxGenJS,
  hosts: ReadonlyArray<EsxAggregate>,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['physical.title'] ?? 'Physical inventory — serial / service tag')
  const withSerial = hosts.filter((h) => h.serialNumber !== '').length
  const y2 = addKpiRow(
    s,
    [
      { label: strings['physical.hosts'] ?? 'Hosts', value: pptxNumber(hosts.length, locale) },
      {
        label: strings['physical.withSerial'] ?? 'Hosts with serial',
        value: pptxNumber(withSerial, locale),
      },
    ],
    y,
  )

  const cell = (text: string, opts: Record<string, unknown> = {}) => ({
    text: pptxSafeFormat(text),
    options: { fontFace: 'Arial', fontSize: 11, color: PPTX_COLORS.ink, ...opts },
  })
  const head = (text: string, opts: Record<string, unknown> = {}) =>
    cell(text, { bold: true, color: PPTX_COLORS.inkMuted, ...opts })

  const header = [
    head(strings['physical.colHost'] ?? 'Host'),
    head(strings['physical.colCluster'] ?? 'Cluster'),
    head(strings['physical.colSerial'] ?? 'Serial / Service tag'),
    head(strings['physical.colModel'] ?? 'Model'),
    head(strings['physical.colVendor'] ?? 'Vendor'),
  ]
  const dataRows = hosts.map((h) => [
    cell(h.hostName),
    cell(h.cluster),
    cell(h.serialNumber || '—'),
    cell(h.model || '—'),
    cell(h.vendor || '—'),
  ])

  s.addTable([header, ...dataRows], {
    x: M,
    y: y2 + 0.1,
    w: CONTENT_W,
    colW: [
      CONTENT_W * 0.26,
      CONTENT_W * 0.2,
      CONTENT_W * 0.24,
      CONTENT_W * 0.18,
      CONTENT_W * 0.12,
    ],
    rowH: 0.28,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
    autoPage: true,
    autoPageRepeatHeader: true,
    autoPageHeaderRows: 1,
    autoPageSlideStartY: 0.5,
  })

  s.addText(
    pptxSafeFormat(
      strings['physical.footer'] ??
        'Source: RVTools — vHost (Serial number / Service tag, Model, Vendor)',
    ),
    {
      x: M,
      y: 7.0,
      w: CONTENT_W,
      h: 0.3,
      fontFace: 'Arial',
      fontSize: 10,
      color: PPTX_COLORS.inkMuted,
      margin: 0,
    },
  )
}
```

- [ ] **Step 4: Register the slide in the builder**

In `src/engines/export/pptx/builder.ts`, add the import alongside the other slide imports (after the `addOverviewSlide` import, keeping alphabetical-ish grouping is fine):

```ts
import { addPhysicalInventorySlide } from './slides/physicalInventorySlide'
```

Then, immediately after the `addInventorySlide(pptx, view, png('osDonut'), strings, locale)` call (line 124) and before `return pptx.write(…)`, add:

```ts
  // P-HWID: physical inventory (serial / service tag) — conditional: only
  // when at least one host reports a serial; otherwise omitted (no empty
  // page). Auto-paginates across slides for large estates.
  if (view.hosts.some((h) => h.serialNumber !== '')) {
    addPhysicalInventorySlide(pptx, view.hosts, strings, locale)
  }
```

- [ ] **Step 5: Run the builder test to verify it passes**

Run: `npm run test:run -- src/engines/export/pptx/builder.test.ts`
Expected: PASS — 15 slides with serials, 14 without. The other slide-count assertions in this file are unchanged because their fixtures have `serialNumber: ''` (slide omitted).

- [ ] **Step 6: Add the PPTX i18n strings (all four locales)**

In each `pptx.json`, add a new top-level `physical` object (sibling of `inventory`, `monster`, etc.). `useExport` flattens this to `physical.title`, `physical.colHost`, … automatically.

`src/i18n/locales/en/pptx.json`:
```json
  "physical": {
    "title": "Physical inventory — serial / service tag",
    "hosts": "Hosts",
    "withSerial": "Hosts with serial",
    "colHost": "Host",
    "colCluster": "Cluster",
    "colSerial": "Serial / Service tag",
    "colModel": "Model",
    "colVendor": "Vendor",
    "footer": "Source: RVTools — vHost (Serial number / Service tag, Model, Vendor)"
  },
```

`src/i18n/locales/fr/pptx.json`:
```json
  "physical": {
    "title": "Inventaire physique — n° de série / service tag",
    "hosts": "Hôtes",
    "withSerial": "Hôtes avec n° de série",
    "colHost": "Hôte",
    "colCluster": "Cluster",
    "colSerial": "N° de série / Service tag",
    "colModel": "Modèle",
    "colVendor": "Constructeur",
    "footer": "Source : RVTools — vHost (Serial number / Service tag, Model, Vendor)"
  },
```

`src/i18n/locales/de/pptx.json`:
```json
  "physical": {
    "title": "Physisches Inventar — Seriennummer / Service-Tag",
    "hosts": "Hosts",
    "withSerial": "Hosts mit Seriennummer",
    "colHost": "Host",
    "colCluster": "Cluster",
    "colSerial": "Seriennummer / Service-Tag",
    "colModel": "Modell",
    "colVendor": "Hersteller",
    "footer": "Quelle: RVTools — vHost (Serial number / Service tag, Model, Vendor)"
  },
```

`src/i18n/locales/it/pptx.json`:
```json
  "physical": {
    "title": "Inventario fisico — numero di serie / service tag",
    "hosts": "Host",
    "withSerial": "Host con numero di serie",
    "colHost": "Host",
    "colCluster": "Cluster",
    "colSerial": "Numero di serie / Service tag",
    "colModel": "Modello",
    "colVendor": "Produttore",
    "footer": "Fonte: RVTools — vHost (Serial number / Service tag, Model, Vendor)"
  },
```

(Place the new object so the JSON stays valid — e.g. right after the `inventory` object, with a trailing comma on the preceding `}` if needed.)

- [ ] **Step 7: Run the parity gate**

Run: `npm run test:run -- src/i18n/keyParity.test.ts`
Expected: PASS — the `physical.*` keys exist identically in en/fr/de/it.

- [ ] **Step 8: Commit**

```bash
rtk git add src/engines/export/pptx/slides/physicalInventorySlide.ts src/engines/export/pptx/builder.ts src/engines/export/pptx/builder.test.ts src/i18n/locales/en/pptx.json src/i18n/locales/fr/pptx.json src/i18n/locales/de/pptx.json src/i18n/locales/it/pptx.json
rtk git commit -m "feat(hwid-05): dedicated PPTX physical-inventory slide

Auto-paginated native table (Host/Cluster/Serial/Model/Vendor); emits only
when a host reports a serial. pptx strings in en/fr/de/it.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Full gate run + visual deck verification

**Files:** none (verification only).

- [ ] **Step 1: Typecheck (app + tests)**

Run: `npm run typecheck`
Expected: PASS — zero errors.

- [ ] **Step 2: Lint (Biome directly — NOT `npm run lint`)**

Run: `npx @biomejs/biome check .`
Expected: PASS (or auto-fixable import ordering only — if it reports fixable issues, run `npx @biomejs/biome check --write .` and re-run).

- [ ] **Step 3: Full test suite + engines coverage**

Run: `npm run test:coverage -- --testTimeout=60000`
Expected: PASS; `engines/` stays ≥ 75 % (the new parser/aggregation/slide code is covered by Tasks 1, 2, 5).

- [ ] **Step 4: Supply-chain gate**

Run: `npm run check:supply-chain`
Expected: PASS — no new dependency was added; the `xlsx` pin is untouched.

- [ ] **Step 5: Bundle-size gate (build first — it reads `dist/`)**

Run: `npm run build && npm run check:bundle-size`
Expected: PASS — the echarts chunk is unaffected (no charting change).

- [ ] **Step 6: Visual deck check (per the user's standing "verify deck visually" preference)**

Load a real RVTools workbook in `npm run dev`, confirm the host table shows the three new columns and the CSV export carries them, then export the PPTX and render it (`soffice --headless --convert-to pdf <file>.pptx` → Read the PDF) to confirm the Physical inventory slide renders the table text correctly and paginates for large host counts.
Expected: the slide reads cleanly, columns aligned, `—` shown for hosts with no serial, footer present.

- [ ] **Step 7: Commit any lint auto-fixes (if Step 2 wrote changes)**

```bash
rtk git add -A
rtk git commit -m "chore(hwid-06): lint autofix + gate pass

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-Review notes

- **Spec coverage:** parser extraction (Task 1) ✓ · aggregation pass-through (Task 2) ✓ · three default-visible web columns + CSV + i18n (Task 4) ✓ · auto-paginated conditional PPTX slide + 4-locale strings (Task 5) ✓ · HTML report untouched (no task — correctly out of scope) ✓ · tests/gates (Tasks 1,2,4,5,6) ✓. The spec said "serial visible by default, model/vendor opt-in" but the user amended to **all three default-visible** — Task 4 reflects the amendment.
- **Hidden requirement caught during planning:** `VHostRowSchema` (Zod, `z.ZodType<VHostRow>`) must gain `serialNumber` or the parser file stops compiling — covered in Task 1 Step 4. Not in the original spec.
- **Required-field churn:** Task 3 makes the whole project typecheck after the required field lands; `serialNumber` is required (`''` sentinel) to match the codebase convention, not optional.
- **Type consistency:** field name `serialNumber` is identical across `VHostRow`, `VHostRowSchema`, `EsxAggregate`, `perEsx`, the column id/i18n key, and the slide. The PPTX string namespace is `physical.*` consistently in the slide and all four `pptx.json` files.
