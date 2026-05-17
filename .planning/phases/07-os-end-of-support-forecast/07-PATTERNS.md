# Phase 7: OS End-of-Support Forecast - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 14 new/modified
**Analogs found:** 14 / 14 (every file has a shipped P1–P6 analog — this phase is almost entirely DRY reuse)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/sync-eos.mjs` | config / build tool | file-I/O (fetch → write JSON) | `scripts/check-supply-chain.mjs` | role-match (bare-Node script idiom) |
| `src/engines/eos/catalogue.json` | data (committed artifact) | — (static input) | — (no analog — data file, not `.ts`) | no analog (expected) |
| `src/engines/eos/catalogueSchema.ts` | model / Zod schema | transform (boundary validation) | `src/engines/parser/schemas.ts` | exact (Zod-only-at-boundary) |
| `src/engines/eos/catalogue.ts` | service (load boundary) | transform (parse-once) | `src/engines/parser/schemas.ts` usage in parser | role-match |
| `src/engines/eos/normalizeOs.ts` | utility (pure engine) | transform (string → slug/version) | `src/engines/aggregation/osFamily.ts` | exact (compose, don't duplicate) |
| `src/engines/eos/classifyEsxi.ts` | utility (pure engine) | transform (version → support state) | `src/engines/aggregation/osFamily.ts` | role-match |
| `src/engines/eos/bucketEos.ts` | utility (pure engine) | batch / transform (rows → partition) | `src/engines/aggregation/estateView.ts` (the eos compose site) | role-match |
| `src/engines/eos/fixtures/real-os-strings.ts` | test fixture | — | RESEARCH.md §Code Examples (verbatim list provided) | exact (copy verbatim) |
| `src/engines/eos/normalizeOs.test.ts` | test | — | `src/engines/aggregation/osFamily.test.ts` | exact |
| `src/engines/eos/classifyEsxi.test.ts` | test | — | `src/engines/aggregation/osFamily.test.ts` | exact |
| `src/engines/eos/bucketEos.test.ts` | test | — | `src/engines/aggregation/estateView.test.ts` | role-match |
| `src/engines/eos/catalogue.test.ts` | test | — | `src/engines/aggregation/osFamily.test.ts` | role-match |
| `src/engines/aggregation/estateView.ts` (MOD) | service (assembler) | batch (single-pass compose) | itself — extend the existing `plannedView`/`drSim` field idiom | exact (self-pattern) |
| `src/types/estate.ts` (MOD) | model (type) | — | itself — `EstateView` `trends/plannedView` `T \| null` idiom | exact (self-pattern) |
| `src/components/ViewToggle.tsx` (MOD) | component (nav) | event-driven | itself — P5 'hosts' / P6 'planning' segment add | exact (self-pattern, proven 2×) |
| `src/components/eos/EosView.tsx` | component (view) | request-response (read-only presenter) | `src/components/hosts/HostsView.tsx` (+ `PlanningView.tsx`) | exact |
| `src/App.tsx` (MOD) | component (shell) | event-driven | itself — the `activeView === 'planning'` branch | exact (self-pattern) |
| `src/utils/format.ts` (MOD) | utility | transform (locale format) | itself — `fmtInt`/`fmtPercent` em-dash idiom (add `fmtDate`) | exact (self-pattern) |
| `src/i18n/locales/{en,fr}/eos.json` | config (i18n) | — | `src/i18n/locales/en/inventory.json` | exact |

## Pattern Assignments

### `src/engines/eos/catalogueSchema.ts` (Zod schema, build/validation boundary)

**Analog:** `src/engines/parser/schemas.ts`

**The rule the analog establishes** (`schemas.ts` lines 5-15): Zod is applied at exactly one boundary; engines downstream never re-validate. The eos schema is the *second* such boundary (the catalogue, mirroring the parser-row boundary).

**Schema-shape idiom to mirror** (`schemas.ts` lines 45-63 — `z.object` of typed fields, exported `z.ZodType<T>`-annotated const + inferred type):

```typescript
export const VInfoRowSchema: z.ZodType<VInfoRow> = z.object({
  vmName: z.string().trim().min(1),
  // ...
})
```

For eos, use the exact `EosCatalogueSchema`/`Release`/`Product` shape spelled out verbatim in **RESEARCH.md §Pattern 1 (lines 178-196)** — `releases[].eolFrom` is the single standard-support date (D-04); `eoesFrom`/`isEoes` deliberately absent from the schema. Add `export type EosCatalogue = z.infer<typeof EosCatalogueSchema>` (same inferred-type idiom).

**Critical:** this is the ONLY file in `src/engines/eos/` that imports `zod`. `normalizeOs.ts`/`classifyEsxi.ts`/`bucketEos.ts` stay Zod-free and receive the typed `EosCatalogue` as a parameter (RESEARCH Anti-Pattern: "Importing catalogue.json inside a pure engine").

---

### `src/engines/eos/catalogue.ts` (parse-once boundary)

**Analog:** the parser's use of `schemas.ts` (Zod runs once at the boundary, lines 5-9 of `schemas.ts` doc).

**Pattern:** import `catalogue.json` (static import) + `EosCatalogueSchema.parse(...)` ONCE at module scope; export the typed result via `loadEosCatalogue()`. RESEARCH.md §Integration (lines 403-415) shows the exact call site: `loadEosCatalogue()` is invoked inside `buildEstateView`, parsed once at module level. Never import the JSON into a pure engine.

---

### `src/engines/eos/normalizeOs.ts` (pure engine — regex bank)

**Analog:** `src/engines/aggregation/osFamily.ts`

**Header/purity idiom to mirror** (`osFamily.ts` lines 1-20):

```typescript
/**
 * OS-family classifier (DSH-04) — pure, no deps, Zod-free. ...
 * Prefers `osConfig` ... falls back to `osTools` ...
 */
import type { OsFamily } from '@/types/estate'
export function classifyOsFamily(osConfig: string, osTools: string): OsFamily {
  const s = (osConfig || osTools).toLowerCase()
  if (/windows|microsoft/.test(s)) return 'windows'
  // ...
  return 'other'   // a real, visible bucket — never thrown
}
```

**What to copy:** the *exact same shape* — pure function, no deps, `import type` only, lowercase-normalize then a regex cascade with a guaranteed terminal fallback (`return null` → first-class unknown, D-10). **Compose, don't duplicate:** `osFamily.ts` line 3 explicitly states it is *not* the EOS normalizer; `normalizeOs` should call `classifyOsFamily` as the coarse gate / fallback signal (RESEARCH §Pattern 2, "Don't Hand-Roll" row 1) and add a slug-specific `RULES` bank. Use the `RULES` array sketch verbatim from **RESEARCH.md §Pattern 2 (lines 205-225)**. Whitespace-normalize for *matching only*; the caller preserves the raw string verbatim (D-12).

---

### `src/engines/eos/classifyEsxi.ts` (pure engine — ESXi build → support state)

**Analog:** `src/engines/aggregation/osFamily.ts` (same purity/return-contract)

**Pattern:** pure `(esxVersion: string, catalogue: EosCatalogue) => { majorEol, patchEol: null }`. Confirmed catalogue fact (RESEARCH Pitfall 1, lines 280-284): endoflife.date ESXi exposes **major-version EOL only** — classify `VMware ESXi 8.0.3 build-N` against major `8.0` (`eolFrom 2027-10-11`); the patch level resolves to the **em-dash sentinel**, never a fabricated date. The em-dash-on-not-determinable contract is the same one `format.ts` enforces (lines 20-21) and `estateView.ts` uses for `datastoreCount` (lines 32-39).

---

### `src/engines/eos/bucketEos.ts` (pure engine — disjoint partition)

**Analog:** the eos-compose block in `src/engines/aggregation/estateView.ts` (the consumer) + the partition shape in RESEARCH.md §Pattern 3.

**Output shape to implement:** the `EosProjection` interface verbatim from **RESEARCH.md §Pattern 3 (lines 232-242)** — disjoint `partition` (sums to entity total — the reconcilable truth), `cumulative` (presentation overlay only), `rawUnknown: {osString,count}[]` (D-11, never aggregated-only), `esxi` split-by-kind (D-09b — host counts never summed with VM counts).

**Pitfall to encode (RESEARCH Pitfall 4, lines 298-302):** `today` is an **injected parameter** — do NOT call `new Date()` inside the bucketer (tests must be deterministic). The caller in `estateView.ts` injects it.

---

### `src/engines/aggregation/estateView.ts` — MODIFY (add `eos` field, NO new memo)

**Analog:** itself — the shipped `plannedView` / `drSim` / `trends` field idiom.

**Exact extension pattern** — mirror how `drSim`/`plannedView` ride the single pass (`estateView.ts` lines 212-248) and are added to the return object (lines 250-267):

```typescript
// existing pattern (lines 250-267): one return object, each forward-compat
// field added as `null` in EMPTY_VIEW (lines 290-307, e.g. `trends: null`,
// `plannedView: null`).
return { globals, clusters, hosts, /* ... */ plannedView, plannedDrSim }
```

Add `eos` exactly as RESEARCH.md §Integration (lines 403-415) prescribes: `import { buildEosProjection }` + `import { loadEosCatalogue }` at top; inside `buildEstateView`, in the **same loop family** as the existing `for (const vm of merged.vinfo)` `classifyOsFamily` pass (lines 108-126 — it rides this existing iteration, no second pass), compute `const eos = buildEosProjection({ vinfo, vhost, catalogue: loadEosCatalogue(), today: new Date() })`; `return { ...existingFields, eos }`. Add a frozen empty `eos` to `EMPTY_VIEW` (mirror `trends: null` / `EMPTY_INSIGHTS` Object.freeze idiom, lines 270-307).

**Anti-pattern (RESEARCH lines 245-247):** a second `useMemo` for eos — it composes inside the existing `buildEstateView` single pass (grep-gated single-memo invariant; see `useEstateView.ts` doc lines 14-41).

---

### `src/types/estate.ts` — MODIFY (add `eos` to `EstateView`)

**Analog:** itself — the `trends: TimelinePoint[] | null` / `plannedView: {...} | null` idiom (`estate.ts` lines 346-381).

**Pattern:** add `eos: EosProjection` (or `EosProjection | null` only if mirroring the `EMPTY_VIEW`-null idiom, lines 373-381). Document it with the same JSDoc style ("Produced inside the single `buildEstateView` pass — no second `useMemo`", lines 378-380).

---

### `src/components/ViewToggle.tsx` — MODIFY (add 5th `'eos'` segment)

**Analog:** itself — proven twice (P5 added `'hosts'`, P6 added `'planning'`).

**Exact two-line change** (`ViewToggle.tsx` lines 3-5):

```typescript
export type AppView = 'dashboard' | 'inventory' | 'hosts' | 'planning'   // → add | 'eos'
const VIEWS = ['dashboard', 'inventory', 'hosts', 'planning'] as const   // → add 'eos'
```

Keep EVERYTHING else verbatim: the `<fieldset role="group">` + `biome-ignore` comment (lines 48-49 — a CI grep gate asserts the literal `role="group"` presence), `<legend className="sr-only">`, the arrow-wraparound `move()`/`onKeyDown` (lines 31-45), `aria-pressed`, `bg-accent-500 text-surface-900` active styling, `h-10` button height. The segment label comes from `t(`nav.${view}`)` (line 70) — so add `nav.eos` to BOTH locale files (next pattern).

---

### `src/components/eos/EosView.tsx` (presenter — view-state branch)

**Analog:** `src/components/hosts/HostsView.tsx` (primary) + `src/components/planning/PlanningView.tsx` (error-boundary + empty-state)

**Shell skeleton to copy verbatim** (`HostsView.tsx` lines 25-37, 107-114):

```tsx
export function EosView() {
  const { t, i18n } = useTranslation('eos')   // new 'eos' namespace
  const loc = i18n.language
  const view = useEstateView('active')         // the SINGLE memo — presenter only
  // ... read view.eos; NO computation here
  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="flex flex-col gap-6">
        <section className="panel"> ... </section>
      </div>
    </main>
  )
}
const Stat = ({ label, value }: { label: string; value: string }) => ( /* lines 107-114 verbatim */ )
```

- **Bucket strip:** reuse the `Stat` label↔value composition (`HostsView.tsx` lines 107-114) inside native `<button>` tiles (UI-SPEC §Component Inventory). `font-mono tabular-nums` for every count (`HostsView.tsx` line 79).
- **Unknown-OS raw-string list:** copy the plain `<table className="w-full text-left text-sm">` + `<tbody className="font-mono tabular-nums">` + `break-all` cell idiom (`HostsView.tsx` lines 64-98; the `break-all` verbatim-string cell is line 85). This is the D-11 list, NOT the `DataTable` (UI-SPEC Open Item 3).
- **Empty-state + scoped error boundary:** if needed, copy the `if (!snapshot) return <main>...</main>` early-return (`PlanningView.tsx` lines 64-77) and the `<ErrorBoundary FallbackComponent={...}>` reading only `error.message` (`PlanningView.tsx` lines 21-32, 81).
- **Freshness/as-of lines:** neutral caption idiom `text-sm text-slate-500 dark:text-slate-400` (`PlanningView.tsx` line 71; `HostsView.tsx` line 65). Dates via the new `fmtDate` helper — never raw `toLocaleDateString` inline.

---

### Bucket → entity drill (inside `EosView.tsx`)

**Analog:** `src/components/inventory/DataTable.tsx` (D-08 — 4th-context reuse, no new table)

**Props contract to satisfy** (`DataTable.tsx` lines 22-28):

```typescript
export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  headerFor: (id: string) => string
  objectKind: 'vm' | 'esx' | 'datastore'   // CSV filename driver
}
```

Pass the selected bucket's affected entities as `data`, the existing VM/ESX `columns` defs from `src/components/inventory/columns/`, `objectKind: 'vm' | 'esx'`. Sorting/filter/column-visibility is the component's own `useState` — never a 2nd memo, never persisted (privacy). The unknown-OS bucket does NOT use this — it renders the raw-string list (UI-SPEC Open Item 3).

---

### Forecast timeline chart (inside `EosView.tsx`)

**Analog:** `src/components/Chart.tsx` (the ONLY ECharts import site project-wide)

**Contract** (`Chart.tsx` lines 43-60): pass a single `option: EChartsOption` prop; SVG renderer + Midnight Executive theme are injected by the wrapper (lines 92, 85) — no per-instance override. The option is built by a pure selector off `view.eos` (so the `chartPropsEqual` reference-equality memo, lines 62-74, short-circuits correctly). **Caveat:** `Chart.tsx` lines 27-36 currently `echarts.use([...])` registers only `BarChart/PieChart/GaugeChart` — calendar/heatmap series are NOT yet registered. The plan must add `HeatmapChart`/`CalendarComponent` to that `echarts.use([...])` array (still SVG-only, canvas stays excluded — VIZ-01) and the chart palette uses the neutral surface/primary ramp, NOT the util traffic-light tokens (UI-SPEC §Color).

---

### `src/App.tsx` — MODIFY (add `'eos'` view branch)

**Analog:** itself — the `activeView === 'planning' ? <PlanningView /> : ...` chain (`App.tsx` lines 38-45).

**Exact one-branch insertion** (mirror lines 42-43):

```tsx
) : activeView === 'planning' ? (
  <PlanningView />
) : activeView === 'eos' ? (        // ← add this branch
  <EosView />
) : (
  <GlobalDashboard />
```

Plus the `import { EosView } from './components/eos/EosView'` next to the existing view imports (lines 4-9).

---

### `src/utils/format.ts` — MODIFY (add `fmtDate`)

**Analog:** itself — `fmtInt` (lines 20-21), `fmtPercent` (lines 67-70) — the locale-param + em-dash-on-bad-input idiom.

**Pattern (verified — NO date helper exists today; RESEARCH "Don't Hand-Roll" row 5):**

```typescript
export const fmtDate = (iso: string, locale = 'fr-FR'): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale, { /* ... */ })
}
```

Mirror `fmtInt` exactly: `locale` parameter (callers pass `i18n.language`), em-dash sentinel on invalid input (never `0`/"N/A" — `format.ts` lines 14, 20-21). No pre-formatted dates in i18n strings (D-03/UI-SPEC §Typography); the view calls `fmtDate` and interpolates.

---

### `src/i18n/locales/{en,fr}/eos.json` (new namespace)

**Analog:** `src/i18n/locales/en/inventory.json`

**Structure to mirror** (`inventory.json` lines 1-45 — nested `nav`/`col`/`table` groups, `{{count}}` interpolation, no pre-formatted numbers):

```json
{ "nav": { "eos": "..." }, "view": { "heading": "..." }, "bucket": { ... }, "freshness": { ... }, "unknown": { ... } }
```

- Add `nav.eos` to the EXISTING `inventory.json` `nav` group (lines 2-8) too — `ViewToggle` reads `t('nav.${view}', { ns: 'inventory' })` (the `useTranslation('inventory')` at `ViewToggle.tsx` line 28). Add to BOTH `en/inventory.json` and `fr/inventory.json`.
- Create `en/eos.json` + `fr/eos.json` for the view's own strings (the `EosView` uses `useTranslation('eos')`).
- All copy is the factual contract in **UI-SPEC.md §Copywriting Contract (lines 100-117)** — no editorial verbs; "overdue"/"at-risk" are neutral time labels only; em-dash sentinel; EN/FR parity is a hard gate.

---

### `scripts/sync-eos.mjs` (build-time fetcher — maintainer-run, NOT in deploy path)

**Analog:** `scripts/check-supply-chain.mjs`

**Bare-Node idiom to mirror** (`check-supply-chain.mjs` lines 1-19, 74-75): shebang `#!/usr/bin/env node`, a top doc-comment explaining the privacy/security rationale, `import { readFileSync } from 'node:fs'` (zero npm deps), explicit `console.log('...: OK')` + `process.exit(exitCode)`. For sync-eos, add `import { writeFileSync } from 'node:fs'` and Node 24 global `fetch` (no HTTP client lib — RESEARCH "Don't Hand-Roll" row 6).

**Failure semantics (RESEARCH Pitfall 5, lines 304-308 + §Architecture diagram lines 108-122):** the script MAY `exit 1` on fetch failure / bad shape so a bad snapshot is never committed (local/PR-time). It writes `catalogue.json` with `{ lastVerified: <today ISO>, products: {...} }`. The CI **deploy** never runs this — it only Zod-validates the committed JSON + emits a `::warning::` (never `exit 1`) when `>90d` (RESEARCH §CI freshness, lines 432-442). This structurally satisfies D-02 (third-party outage cannot block deploy).

## Shared Patterns

### Purity / Zod-only-at-boundary

**Source:** `src/engines/parser/schemas.ts` (lines 5-15 doc), `src/engines/aggregation/osFamily.ts` (lines 1-9)
**Apply to:** all `src/engines/eos/*.ts` — `catalogueSchema.ts` is the ONLY Zod importer; `normalizeOs/classifyEsxi/bucketEos` are pure, dep-free, receive the typed catalogue as an argument. `import type` only for cross-module types.

### Single-memo / single-pass aggregation

**Source:** `src/hooks/useEstateView.ts` (lines 14-41 doc, 48-57), `src/engines/aggregation/estateView.ts` (lines 108-126, 250-267)
**Apply to:** the `eos` projection composes inside the existing `buildEstateView` pass on the existing `merged.vinfo` iteration; `EosView` is a pure presenter calling `useEstateView('active')` once. NO second `useMemo`, NO component-level recompute (grep-gated invariant).

### Em-dash "not determinable" sentinel

**Source:** `src/utils/format.ts` (lines 14, 20-21), `src/engines/aggregation/estateView.ts` (lines 32-39 datastore-count idiom), `src/components/hosts/HostsView.tsx` (line 33 `txt()` helper)
**Apply to:** ESXi patch-level EOL (D-09c — never fabricate), any non-computable lifecycle date, the new `fmtDate` on invalid input. Never `0`, never "N/A".

### Factual presentation / no-verdict (G1 lesson)

**Source:** `src/components/hosts/HostsView.tsx` (lines 22-24 doc — "NEVER a lifecycle verdict; Phase 7 owns ESXi support-state"), UI-SPEC §Color (lines 76-94), §Copywriting (lines 97-117)
**Apply to:** all bucket labels, captions, the chart palette (neutral surface/primary ramp, NOT util traffic-light), the accessible names. No editorial verbs; "overdue"/"at-risk" are neutral time labels only; no status color/icon. EN/FR parity is a hard gate.

### Privacy / no runtime network

**Source:** `scripts/check-supply-chain.mjs` (whole-file rationale), CLAUDE.md privacy invariant, RESEARCH Pitfall 5
**Apply to:** the catalogue is a build-time static import; the app NEVER fetches it at runtime (the P1 guard throws). `sync:eos` is maintainer-run, decoupled from the CI deploy job. No `localStorage` of bucket selection (ephemeral `useState`).

### View-state branch (no router)

**Source:** `src/App.tsx` (lines 38-45), `src/components/ViewToggle.tsx` (lines 3-5, proven P5/P6), `src/components/planning/PlanningView.tsx` (lines 34-49 doc)
**Apply to:** `'eos'` is a 5th `AppView`/`VIEWS` member + one `App.tsx` ternary branch + a `nav.eos` i18n key — verbatim with the P5 'hosts' / P6 'planning' precedent. No new nav component.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/engines/eos/catalogue.json` | data artifact | static input | A committed JSON data file (not `.ts`) — no code analog; content shape is fully specified by `catalogueSchema.ts` + RESEARCH §Pattern 1. Outside Vitest coverage (data, not source). |

All other 13 files have an exact or strong shipped analog.

## Metadata

**Analog search scope:** `src/engines/{aggregation,parser}/`, `src/components/{hosts,planning,inventory}/`, `src/components/{ViewToggle,Chart}.tsx`, `src/hooks/`, `src/utils/`, `src/types/`, `src/i18n/locales/`, `scripts/`
**Files scanned:** ~20 (read targeted; 14 analogs extracted)
**Pattern extraction date:** 2026-05-17
