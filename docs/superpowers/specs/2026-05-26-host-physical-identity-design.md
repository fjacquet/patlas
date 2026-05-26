# vatlas → Host Physical Identity (serial / service tag) in Web + PPTX

- **Date:** 2026-05-26
- **Status:** Approved (design); pending implementation plan
- **Scope:** Surface each ESXi host's physical identity — **Serial / Service tag**, **Model**, **Vendor** — in the web host-inventory table and in a new dedicated PPTX slide, to support a datacenter move / hardware-replacement preparation ("find and physically isolate this box in the rack").

## Goal

A user who is preparing a physical move or hardware refresh can read, per ESXi
host, the serial / service tag printed on the chassis plus the model and
vendor, both **on screen** (host inventory table, sortable/filterable, with CSV
export) and **in the PPTX deck** (a new per-host table slide). The serial is the
anchor a datacenter technician uses to locate the exact box; model + vendor
shorten the search ("Dell PowerEdge R640 + service tag XXXXXX").

The data already exists in the RVTools workbook — this is an **extraction +
display** feature, not a new data source.

Non-goals: rack / location / power-feed data (RVTools does not export it);
asset-database enrichment; any "obsolete / replace this" verdict (factual only);
the HTML report (no per-host table exists there and it is out of the requested
scope).

## Constraints (binding)

- **Factual, brand-free (UI-SPEC / project discipline):** serial, model, vendor
  are plain facts. No editorial verbs, no verdict colors. Empty values render
  the `—` sentinel — never a blank that reads as "0 hosts" and never a guess.
- **Privacy invariant (ADR-0001/0004):** all three fields come from the parsed
  workbook held in memory; nothing is persisted, no network call is introduced.
  The feature is inert with respect to the runtime network guard.
- **Engineering principles (KISS/DRY/functional):** pure parser + pure
  aggregation pass-through; no new `useMemo` (the single `useEstateView` memo is
  untouched); columns are pure config; the PPTX slide is a pure sync function.
- **Branded-units / sentinel discipline:** these are string fields, so no unit
  branding applies; the only discipline is empty → `—` on display, raw value in
  CSV (the existing two-path display-vs-CSV rule in `esxColumns.ts`).
- **i18n parity gate:** every new key lands in **en / fr / de / it** or
  `keyParity.test.ts` fails the build. DE/IT remain pending native review
  (existing project risk) — new technical terms inherit that caveat.
- **Coverage gate (engines/ ≥ 75 %):** parser coalescing and the `perEsx`
  pass-through get unit tests.

## RVTools source columns

The `vHost` sheet carries the data already; the parser currently drops it:

- **`Serial number`** — RVTools ≥ 3.11, SMBIOS system serial (most universal).
- **`Service tag (serial #)`** — all versions; the value printed on Dell pull-tabs.
- (`OEM specific string` exists too but is not used — too vendor-noisy.)

`model` and `vendor` are **already parsed** into `VHostRow` (and carried to
`EsxAggregate`) but are **displayed nowhere** today.

## Architecture

### 1. Parser (the only genuinely new extraction)

`mapColumns` resolves one field → one column, so it cannot do the per-row
"prefer Serial number, else Service tag" fallback the use case wants. Solution:
map **two** raw aliases and coalesce per row in the normalizer.

- `src/engines/parser/adapters/rvtools.ts`, `VHOST_COLS`:
  - `serial: ['serial number', 'serial no', 'serial']`
  - `serviceTag: ['service tag (serial #)', 'service tag', 'servicetag']`
- `adaptRvtoolsVHost`, per row:
  `serialNumber = readString(serial) || readString(serviceTag)`
  → `Serial number` wins; falls back to `Service tag`; `''` if both absent
  (never `undefined`). Case/whitespace tolerant via the existing
  `readString`/normalized-header machinery.
- `src/types/vhost.ts` — `VHostRow` gains `serialNumber: string`
  (`model` / `vendor` already present).

### 2. Aggregation (pass-through, zero logic)

- `src/types/estate.ts` — `EsxAggregate` gains `serialNumber: string`
  (`model` / `vendor` / `esxVersion` / `faultDomain` already present).
- `src/engines/aggregation/perEsx.ts` — add `serialNumber: h.serialNumber` to
  the row map (alongside the already-copied `model` / `vendor`). No
  re-aggregation, no new memo.

### 3. Web — three columns in the existing host table (`EsxTable`)

- `src/components/inventory/columns/esxColumns.ts` — add three `ColumnDef`s:
  `serialNumber`, `model`, `vendor`. Each `cell` renders `—` when the raw value
  is empty (display path); the CSV path reads the raw accessor unchanged (the
  existing two-path discipline).
- `esxDefaultVisible` — add **all three** (`serialNumber`, `model`, `vendor`):
  they are the point of the feature and the user confirmed all three visible by
  default. `hostName` stays the non-hideable identity column; the rest of the
  default set is unchanged.
- **CSV export** — embeds the three columns automatically (TanStack CSV path
  reads the accessor). This CSV is the artifact handed to datacenter techs; no
  extra export work needed.
- i18n: `inventory.col.serialNumber`, `inventory.col.model`,
  `inventory.col.vendor` in en / fr / de / it.

### 4. PPTX — new dedicated "Physical inventory" slide

- New file `src/engines/export/pptx/slides/physicalInventorySlide.ts`, built on
  the `monsterSlide` pattern: navy `addHeader`, `addKpiRow`
  (KPIs: total hosts · hosts with a serial), then a native `s.addTable`.
- Columns: **Host · Cluster · Serial / Service tag · Model · Vendor**.
- `autoPage: true` + `autoPageRepeatHeader: true` — the **complete** host list
  spills across as many slides as needed (a move needs every node, not a
  top-N). The navy header band appears only on the first slide of the run;
  continuation slides repeat the table header row. Acceptable tradeoff.
- Empty serial / model / vendor cells render `—` (via the shared cell factory).
- Provenance footer: "Source: RVTools — vHost (Serial number / Service tag,
  Model, Vendor)".
- **Conditional emission:** only when at least one host has a non-empty
  `serialNumber` (mirrors the rightsizing / monster conditional-emit pattern).
  Registered in `src/engines/export/pptx/builder.ts` **immediately after** the
  inventory summary slide.
- Export strings: new keys in the `pptx` namespace (slide title, the five column
  headers, the two KPI labels, the footer) wired into the `ExportStrings`
  collector, in en / fr / de / it.

## Data flow

`vHost` sheet → `adaptRvtoolsVHost` coalesces `Serial number` / `Service tag`
into `VHostRow.serialNumber` → `perEsx` copies it onto `EsxAggregate` →
`useEstateView` (unchanged) exposes `view.hosts` → **web**: `EsxTable` renders
the three columns + CSV; **PPTX**: `builder` emits `physicalInventorySlide` from
`view.hosts` when any serial is present. No persistence, no network, ever.

## Components / files touched

- `src/types/vhost.ts` — `VHostRow.serialNumber`.
- `src/engines/parser/adapters/rvtools.ts` — `VHOST_COLS` (serial + serviceTag),
  coalesce in `adaptRvtoolsVHost`.
- `src/types/estate.ts` — `EsxAggregate.serialNumber`.
- `src/engines/aggregation/perEsx.ts` — copy `serialNumber`.
- `src/components/inventory/columns/esxColumns.ts` — three columns + default-visible.
- `src/i18n/locales/{en,fr,de,it}/inventory.json` — three `col.*` keys.
- `src/engines/export/pptx/slides/physicalInventorySlide.ts` — **new**.
- `src/engines/export/pptx/builder.ts` — register slide (conditional, post-inventory).
- `src/i18n/locales/{en,fr,de,it}/pptx.json` — slide strings + `ExportStrings` wiring.
- Tests — parser coalescing; `perEsx` pass-through; PPTX slide emit/skip; keyParity.

## Out of scope (explicit)

- **HTML report** — no per-host table exists there (top-16 clusters only) and
  the request was web + PPTX. Consistent with rightsizing / monsters exclusion.
- **Rack / location / OEM-string** — not exported by RVTools; physical anchor is
  Serial/Service tag + Model + Cluster.
- **Any hardware lifecycle verdict** — factual identity only.

## Testing strategy

- **Parser unit:** `Serial number` wins; falls back to `Service tag` when blank;
  `''` when both absent; case/whitespace tolerance; pre-3.11 export (no
  `Serial number` column) still yields the Service tag value.
- **Aggregation unit:** `serialNumber` traverses `perEsx` to `EsxAggregate`
  verbatim.
- **PPTX:** slide emits when ≥1 host has a serial; skipped when none; the table
  contains one data row per host and the `—` sentinel for empty fields.
- **i18n:** `keyParity.test.ts` green across the four locales (inventory + pptx).
- **Gates:** no bundle-size or supply-chain impact (zero new dependency); confirm
  both gates still pass.

## Open questions

None blocking. The precedence detail (prefer `Serial number`, fall back to
`Service tag`) is fixed; whether to additionally surface `OEM specific string`
is deferred (currently: no, too vendor-noisy).
