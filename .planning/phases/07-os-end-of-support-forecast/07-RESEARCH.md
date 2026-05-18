# Phase 7: OS End-of-Support Forecast - Research

**Researched:** 2026-05-17
**Domain:** Build-time lifecycle-catalogue bundling + OS-string normalization + ESXi build classification + lifecycle bucketing, in a 100% client-side React/TS app with a runtime no-network privacy guard
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-00:** Calc-from-real-data + factual-presentation. Buckets are **date facts, not advice** — no editorial verbs ("should/recommend/poor/good/better/worse-as-judgement/at-risk-as-judgement", high/med/low confidence words). "At-risk"/"overdue" are neutral time-bucket labels only. Privacy/in-memory invariant, single `useMemo` (`useEstateView`) — EOS projection composes inside `buildEstateView`, **NO new memo** — EN/FR parity, no `localStorage` of dataset rows, em-dash sentinel for "not determinable". Every value derived only from parsed RVTools columns + the bundled catalogue; never fabricated.
- **D-01:** `endoflife.date` catalogue is **bundled and Zod-validated**, **zero runtime fetch**. Bundling mechanism (committed JSON snapshot via explicit `sync:eos`-style script vs CI build-step fetch) is **Claude's discretion**, decided on determinism-vs-freshness. Hard constraint either way: no network at app runtime; static import validated by Zod at the build/validation boundary only (engines stay pure).
- **D-02:** If `endoflife.date` is unreachable at refresh/build: **use last good snapshot, surface staleness** — a third-party outage MUST NEVER block a vatlas deploy. CI **warns** maintainer when snapshot >90 days old; never blocks deploy. A refresh-script may exit non-zero to prevent committing a bad snapshot; the normal validate-only CI deploy still succeeds. Exact failure semantics are planner's call within "outage never blocks deploy".
- **D-03:** Freshness UX: EOS view **always** shows "EOS catalogue verified: YYYY-MM-DD"; when >90 days old it additionally shows a neutral caption ("catalogue may be outdated" — factual, no verb), EN/FR parity. CI separately warns the maintainer.
- **D-04:** **Single EOL date model** — endoflife.date's primary standard-support EOL date only; **do NOT** model paid extended-support tiers (RHEL ELS / Windows ESU). Past standard EOL but under paid ESU still buckets as **overdue**.
- **D-05:** View placement (5th ViewToggle segment vs Dashboard section vs drill) is **Claude's discretion** — if a segment, reuse the shipped `fieldset`+`aria-pressed` `ViewToggle` idiom; do NOT build a new nav component.
- **D-06:** Bucket definition (discrete non-overlapping vs cumulative ≤+N) is **Claude's discretion**, within: must include explicit **overdue** bucket + first-class **unknown-OS** bucket; counts must **reconcile to the entity total** (nothing silently dropped); cleanest map to drill + Phase-2 ECharts chart; factual labels only.
- **D-07:** **Reference date for bucketing = TODAY (workbook-load date), not snapshot-capture date.** "Overdue" = EOL strictly before today. Surface "as of {today}". User-accepted tradeoff: same workbook → different buckets on different days; do not silently substitute capture-date.
- **D-08:** Drill = **reuse the shipped P3 inventory `DataTable` + drill idiom** for bucket→affected-entity list — no new table component.
- **D-09a:** ESXi build→support-state classification placement (EOS view only vs also augmenting P5 Hosts column) is **Claude's discretion**, within: P7 owns classification; **do NOT regress P5's plain-text Hosts view** (if augmented, regression-gate it); factual, no verdict.
- **D-09b:** Whether ESX hosts share one unified timeline with VM OSes or sit in a separate ESXi-lifecycle section is **Claude's discretion**; hard constraint: **never conflate host vs VM cardinality into a single misleading total**.
- **D-09c:** ESXi granularity = patch + major per EOS-04, but **derive only from catalogue fields actually present**; classify against major-version EOL and, where exposed, patch/update-level EOL; em-dash sentinel when a level isn't determinable; never fabricate.
- **D-10:** **Unknown-OS bucket is first-class** — a peer bucket beside overdue / time-horizon buckets, own count and drill. Counts always reconcile to the entity total; unmatched OSes never silently dropped.
- **D-11:** Unknown-OS drill MUST surface the **actual raw unrecognized OS strings with occurrence counts**. Exact presentation (peer-drill list vs adjacent diagnostics) is **Claude's discretion**; aggregated-count-only is NOT acceptable.
- **D-12:** **Minor-4 locked:** OS-string matching is **case-insensitive and whitespace-normalized**, but the **original RVTools OS string is preserved verbatim** for display in drills and the unknown-OS list.

### Claude's Discretion

Bundling mechanism (D-01); exact build-failure semantics within outage-never-blocks (D-02); view placement segment-vs-section (D-05); bucket scheme discrete-vs-cumulative (D-06); drill wiring (D-08); ESXi placement & unified-vs-separate & granularity finalization (D-09a/b/c); unknown-OS presentation (D-11). All within locked factual/privacy/reconcile constraints.

### Deferred Ideas (OUT OF SCOPE)

- Extended/paid support tiers (RHEL ELS, Windows ESU) — explicitly NOT modeled in P7 (D-04).
- EOS evolution across snapshots / trend of at-risk counts → Phase 8.
- HTML/PPTX export of the EOS forecast → Phase 10 (P7 makes the view export-ready via the shared `EstateView` shape; does not generate the artifact).
- Snapshot-capture-date as bucket reference — rejected for P7 (D-07 uses load-date).
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EOS-01 | EOS forecast view with at-risk counts at +3, +6, +9, +12 months | Bucketing engine §"Lifecycle Bucketing"; cumulative scheme recommendation; ECharts calendar/heatmap via shipped `<Chart>` |
| EOS-02 | "Overdue" bucket for entities on already-EOS OSes | `eolFrom < today` partition member; reconciliation §"Lifecycle Bucketing" |
| EOS-03 | Click a bucket to drill into the affected entity list | Reuse P3 `DataTable` (`objectKind: 'vm'\|'esx'`); §"Integration" |
| EOS-04 | ESX hosts classified by build → support state, incl. patch + major | ESXi classifier §"ESXi Build→Support-State"; v1 schema confirms **major-only** EOL — patch level → em-dash sentinel (D-09c) |
| EOS-05 | "Unknown OS" bucket — never silently dropped | First-class unknown bucket; raw-string capture §"OS-String Normalizer"; reconciliation invariant |
| EOS-06 | `lastVerified` date on the catalogue (refreshed at CI build time) | Build-time constant baked into the snapshot; §"Catalogue Bundling"; freshness UX D-03 |

The `.planning/REQUIREMENTS.md` coverage table currently maps EOS-01..06 to **"Phase 5"** — this is **stale**. The planner MUST reconcile it to **Phase 7** in the coverage table (and flip the EOS-0x checkboxes when the phase ships, per the manual ROADMAP-progress gotcha in CLAUDE.md).
</phase_requirements>

## Summary

Phase 7 adds a pure `src/engines/eos/` module plus a new EOS view, with **zero runtime network**. All seven research questions resolved with HIGH confidence — the endoflife.date v1 API was queried live during this research and its schema is fully documented below, and the real RVTools OS-string space was harvested directly from the three real fixtures in `tests/fixtures/`.

Key findings: (1) endoflife.date **v1 is GA and stable** (`schema_version: 1.2.1`, served at `https://endoflife.date/api/v1/products/{slug}/`), with the canonical EOL field being `releases[].eolFrom` (ISO `YYYY-MM-DD`) plus a derived `releases[].isEol` boolean — this is the **single standard-support EOL date** D-04 mandates, and the paid-tier fields (`eoesFrom`/`isEoes`) are present but **deliberately ignored** per D-04. (2) ESXi v1 exposes **major-version EOL only** (`8.0 → eolFrom 2027-10-11`, `7.0 → 2025-10-02`); there is **no patch/build-level EOL** — so D-09c's patch level resolves to the **em-dash sentinel** for ESXi, while the build string is still surfaced factually (this is a confirmed catalogue fact, not a gap to fill). (3) The real RVTools fixtures contain **45 distinct `osConfig` + 44 distinct `osTools` strings** — a vCenter-dropdown vocabulary (`"Microsoft Windows Server 2022 (64-bit)"`, `"Red Hat Enterprise Linux 8 (64-bit)"`, `"CentOS 7 (64-bit)"`, `"Debian GNU/Linux 12 (64-bit)"`) — and only **4 distinct ESX Version strings** (all `VMware ESXi 8.0.3 build-NNNNNNNN`). The <5% unknown-OS target is achievable with a small regex bank because the input space is a finite controlled vocabulary, not free text.

**Primary recommendation:** Use a **committed JSON snapshot regenerated by an explicit `npm run sync:eos` script** (determinism over auto-freshness — D-01/D-02 favor reproducible builds; the CI deploy only validates the committed snapshot and never fetches, so a third-party outage is structurally incapable of blocking deploy). Build the normalizer as a **product-slug + version-extractor regex bank** that composes with (does not duplicate) `osFamily.ts`, mapping each normalized `(slug, version)` to the bundled catalogue's `releases[].eolFrom`. Attach an `eos` projection to `EstateView` inside the existing `buildEstateView` pass (no new memo). Add a 5th `'eos'` ViewToggle segment (proven twice: P5 'hosts', P6 'planning').

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch + freeze endoflife.date catalogue | Build-time tooling (`scripts/sync-eos.mjs`) | — | The ONLY place a network call is allowed; output is a committed static JSON. Runtime never fetches (privacy guard throws). |
| Zod-validate the bundled catalogue | Build/validation boundary | — | Mirrors the parser-boundary Zod rule; engines stay pure (no Zod in `engines/eos/`). |
| OS-string → `(slug, version)` normalization | Pure engine (`src/engines/eos/`) | — | Deterministic pure function; Vitest-gated ≥75%; composes with `osFamily.ts`. |
| `(slug, version)` → EOL date lookup | Pure engine (`src/engines/eos/`) | — | Pure map over the bundled catalogue data structure passed in as an argument (engine never imports the JSON directly — the boundary does). |
| ESXi build/version → support-state | Pure engine (`src/engines/eos/`) | — | Same purity contract; consumes `vhost.esxVersion` text. |
| Lifecycle bucketing + reconciliation | Pure engine (`src/engines/eos/`), composed in `buildEstateView` | `useEstateView` (single memo) | The `eos` projection is a field on `EstateView`; no second memo (D-00). |
| EOS view (bucket strip, chart, drill, freshness lines) | React presenter (App view-state branch) | shipped `ViewToggle`/`Chart`/`DataTable` | Presenter only — no computation in components. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | `^4.4.3` (already in repo) | Validate the bundled catalogue at the build/validation boundary | Project's boundary-validation tool; mirrors `src/engines/parser/schemas.ts`. `[VERIFIED: package.json]` |
| ECharts + `echarts-for-react` | `^6.0.0` / `^3.0.6` (shipped P2 `<Chart>`) | Calendar/heatmap forecast timeline, SVG renderer | Shipped P2 infra; single `option` prop; SVG mandated project-wide. `[VERIFIED: CLAUDE.md + src/components/Chart.tsx exists]` |
| `@tanstack/react-table` + `react-virtual` (via shipped `DataTable`) | shipped P3 | Bucket→entity drill | D-08 reuse; `objectKind: 'vm' \| 'esx'` already supported. `[VERIFIED: src/components/inventory/DataTable.csv.test.tsx]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node built-in `fetch` (Node 24) | runtime: build only | `scripts/sync-eos.mjs` to fetch the catalogue | Build-time only; CI uses Node 24 (`.github/workflows/static.yml`). Never shipped to the browser. `[VERIFIED: static.yml node-version: '24']` |

No new runtime dependencies. The catalogue snapshot is committed JSON; the only new "tooling dep" is a `scripts/sync-eos.mjs` using Node's built-in `fetch` (zero npm deps, mirroring `scripts/check-supply-chain.mjs`'s bare-Node style).

**Installation:** none — no `npm install`. (Adding a network/HTTP client lib would be unnecessary; Node 24 `fetch` is built in. `[VERIFIED: Node 24 has global fetch]`)

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Committed JSON snapshot + `npm run sync:eos` | CI build-step fetch (fetch at every deploy) | **Rejected as default.** CI fetch couples every deploy to a third-party's uptime; D-02 says outage must never block deploy, and the cleanest structural guarantee of that is "deploy never fetches at all". Snapshot is deterministic, reviewable in PR diff, reproducible offline. The maintainer runs `sync:eos` deliberately; CI only validates. |
| endoflife.date v1 API | endoflife.date legacy v0 (`/api/{product}.json`) | v0 still works but is **superseded**; v1 (`schema_version 1.2.1`) is GA, richer (`isEol`/`isMaintained`/`eolFrom`/labels). Use v1. `[VERIFIED: live query 2026-05-17]` |

**Version verification (endoflife.date API, queried live 2026-05-17):**

- `https://endoflife.date/api/v1/` → `{"schema_version":"1.2.1", ... "result":[{products},{categories},{tags}]}` `[VERIFIED: live curl]`
- `https://endoflife.date/api/v1/products/` → `total: 455` products `[VERIFIED: live curl]`
- Each product: `https://endoflife.date/api/v1/products/{slug}/` → `{ schema_version, generated_at, result: { name, releases: [...] } }` `[VERIFIED: live curl]`

## Architecture Patterns

### System Architecture Diagram

```
BUILD TIME (network allowed — the only place):
  maintainer runs `npm run sync:eos`
        │
        ▼
  scripts/sync-eos.mjs  ──fetch──▶  endoflife.date/api/v1/products/{slug}/   (curated slug list)
        │                                   │
        │  on success                       │  on outage / non-2xx / bad shape
        ▼                                   ▼
  write src/engines/eos/catalogue.json   exit non-zero, DO NOT overwrite
  with { lastVerified: <today ISO>,         (last-good snapshot stays committed —
          products: { slug: {releases} } }   D-02: refresh fails, deploy unaffected)
        │
        ▼
  git commit catalogue.json  (reviewable diff in PR)

CI DEPLOY (NO network — validate only):
  catalogue.json ──Zod parse──▶ EosCatalogue   (build/validation boundary)
        │                            │ invalid → build fails (bad commit caught)
        │                            ▼ valid
        │                       freshness step: if (today - lastVerified) > 90d
        │                          → echo "::warning::EOS catalogue is N days old"
        │                            (WARN ONLY — never `exit 1`, D-02)
        ▼
  vite build bundles catalogue.json as a static import

APP RUNTIME (NO network — privacy guard throws on any non-same-origin fetch):
  parsed Snapshot (vinfo[].osConfig/osTools, vhost[].esxVersion)
        │
        ▼  inside useEstateView's single useMemo → buildEstateView(...)
  ┌─────────────────────────────────────────────────────────────┐
  │ engines/eos/ (pure, Zod-free):                                │
  │  normalizeOs(rawOsString) ──▶ (slug, version) | null          │
  │       (regex bank; composes with osFamily.ts)                 │
  │  lookupEol((slug,version), catalogue) ──▶ eolFrom Date | null │
  │  classifyEsxi(esxVersion, catalogue) ──▶ {major eol, patch=—} │
  │  bucketEntities(rows, today) ──▶ disjoint partition           │
  │       overdue ∪ ≤+3 ∪ ≤+6 ∪ ≤+9 ∪ ≤+12 ∪ beyond ∪ unknown    │
  │  + rawUnknownStrings: Map<verbatim, count>                    │
  └─────────────────────────────────────────────────────────────┘
        │
        ▼  EstateView.eos = { buckets, drillRows, rawUnknown, lastVerified }
  EOS view (presenter): freshness lines · bucket strip · <Chart> · DataTable drill
```

### Recommended Project Structure

```
src/engines/eos/
├── catalogue.json          # committed snapshot: { lastVerified, products }
├── catalogueSchema.ts      # Zod schema (boundary-only; the ONLY Zod in eos/)
├── catalogue.ts            # load+parse boundary: parses catalogue.json → typed EosCatalogue (Zod here, once)
├── normalizeOs.ts          # pure: rawOs → { slug, version } | null  (composes osFamily.ts)
├── classifyEsxi.ts         # pure: esxVersion → { majorEol, patchEol: null }
├── bucketEos.ts            # pure: (rows, catalogue, today) → EosProjection
├── normalizeOs.test.ts     # RHEL-8-4-variants + Oracle-3-variants + <5% fixture
├── classifyEsxi.test.ts
├── bucketEos.test.ts
└── fixtures/
    └── real-os-strings.ts  # the 50+ harvested strings (see "Code Examples")

scripts/sync-eos.mjs        # build-time fetcher (Node fetch, bare, like check-supply-chain.mjs)
src/components/eos/EosView.tsx   # presenter (App view-state branch)
```

Coverage note: `vitest.config.ts` already gates `src/engines/**/*.ts` at 75% lines/functions/branches/statements globally. **No config change needed** — `src/engines/eos/` is auto-gated the moment files land. `catalogue.json` is data, not `.ts`, so it does not enter coverage. `[VERIFIED: vitest.config.ts L21-33]`

### Pattern 1: Zod only at the catalogue boundary (mirrors parser)

**What:** `catalogue.ts` is the single place `catalogue.json` is read and Zod-validated, exactly like `src/engines/parser/schemas.ts` validates parsed rows. `normalizeOs.ts`/`bucketEos.ts`/`classifyEsxi.ts` are pure and Zod-free and receive the already-typed `EosCatalogue` as an argument.
**When to use:** always for this phase (D-01 hard constraint; engines-stay-pure invariant).

```typescript
// src/engines/eos/catalogueSchema.ts  — Source: schema VERIFIED live from endoflife.date/api/v1 2026-05-17
import { z } from 'zod'

const Release = z.object({
  name: z.string(),                              // e.g. "8", "8.0", "2022"
  label: z.string(),                             // e.g. "Windows Server 2022 (LTSC)"
  releaseDate: z.string().nullable(),            // "YYYY-MM-DD" | null
  isEol: z.boolean(),                            // derived by endoflife.date as of generated_at
  eolFrom: z.string().nullable(),                // "YYYY-MM-DD" | null — THE standard-support EOL (D-04)
  isMaintained: z.boolean(),
  // eoesFrom / isEoes (paid extended support) intentionally NOT in the schema — D-04 single-date model
})
const Product = z.object({ name: z.string(), releases: z.array(Release) })
export const EosCatalogueSchema = z.object({
  lastVerified: z.string(),                      // "YYYY-MM-DD" — build-time constant injected by sync-eos.mjs
  products: z.record(z.string(), Product),       // { "rhel": {...}, "windows-server": {...}, ... }
})
export type EosCatalogue = z.infer<typeof EosCatalogueSchema>
```

### Pattern 2: Normalizer = product-slug detector + version extractor (DRY-composed with osFamily.ts)

**What:** `osFamily.ts` already does the windows/linux/other 3-way split (it is NOT the EOS normalizer — its own header says so). The EOS normalizer is a finer classifier that returns an endoflife.date `(slug, version)` pair. It should **call `classifyOsFamily` first** as a coarse gate / fallback signal (DRY — do not re-implement the windows/linux regexes), then run a slug-specific regex bank.
**When to use:** every VM OS string and the ESXi version string.

```typescript
// src/engines/eos/normalizeOs.ts  (pattern sketch — pure, Zod-free)
// Match order matters: most specific slug first; "Other ... Linux" and "Other (64-bit)"
// must FALL THROUGH to unknown (they carry no version → not classifiable → first-class unknown, D-10).
const RULES: { slug: string; re: RegExp; ver: (m: RegExpMatchArray) => string | null }[] = [
  // RHEL — 4 variants seen / specified: "Red Hat Enterprise Linux 8 (64-bit)",
  // "RHEL 8 (64-bit)", "Red Hat Enterprise Linux 8.10", "redhat..." (case-insensitive, D-12)
  { slug: 'rhel',           re: /red\s*hat\s*enterprise\s*linux\s*(\d+)|^rhel\s*(\d+)/i, ver: m => m[1] ?? m[2] },
  // Oracle Linux — 3 variants: "Oracle Linux 8", "Oracle Enterprise Linux 8", "Oracle Linux Server 8.10"
  { slug: 'oracle-linux',   re: /oracle\s*(?:enterprise\s*)?linux(?:\s*server)?\s*(\d+)/i, ver: m => m[1] },
  { slug: 'centos',         re: /cent\s*os\s*(\d+)/i,                       ver: m => m[1] },   // "CentOS 7 (64-bit)" — "4/5/6/7" multi-form → take last? (see Pitfall 3)
  { slug: 'almalinux',      re: /alma\s*linux/i,                            ver: () => null },  // no version in fixture → unknown unless version present
  { slug: 'rocky-linux',    re: /rocky\s*linux/i,                           ver: () => null },
  { slug: 'debian',         re: /debian\s*gnu\/?linux\s*(\d+)/i,            ver: m => m[1] },
  { slug: 'ubuntu',         re: /ubuntu/i,                                  ver: () => null },  // RVTools rarely carries Ubuntu version → likely unknown (see Pitfall 3)
  { slug: 'sles',           re: /suse\s*linux\s*enterprise\s*(\d+)/i,       ver: m => m[1] },
  { slug: 'windows-server', re: /windows\s*server\s*(\d{4}(?:\s*r2)?)/i,    ver: m => m[1].replace(/\s+/,' ') },
  { slug: 'windows',        re: /windows\s*(\d+|xp|vista|2000)/i,           ver: m => m[1] }, // desktop
  { slug: 'esxi',           re: /esxi\s*(\d+\.\d+)/i,                        ver: m => m[1] },  // also handles "VMware ESXi 6.5 or later" guest-OS rows
]
export function normalizeOs(raw: string): { slug: string; version: string | null } | null {
  const norm = raw.replace(/\s+/g, ' ').trim()        // whitespace-normalize, matching only (D-12: raw preserved by caller)
  for (const r of RULES) { const m = norm.match(r.re); if (m) return { slug: r.slug, version: r.ver(m) } }
  return null                                          // → first-class unknown bucket (D-10), raw kept verbatim
}
```

### Pattern 3: Disjoint partition for reconciliation, cumulative tiles for display (Open Item 2)

**What:** The engine produces a **disjoint partition** (`overdue | ≤+3 | (+3,+6] | (+6,+9] | (+9,+12] | beyond12 | unknown`) whose counts sum exactly to the entity total. The bucket-strip UI displays **cumulative** tiles (`Within 3 / 6 / 9 / 12 months`) derived from the disjoint partition. The reconciliation line is computed from the **disjoint** partition, never the cumulative sum (cumulative double-counts by design — overlapping windows).
**When to use:** the `bucketEos` engine output shape.

```typescript
// EosProjection shape (the new EstateView.eos field)
interface EosProjection {
  reference: { today: string; lastVerified: string }   // D-07 + D-03 (both surfaced)
  // disjoint partition — sums to vmTotal (+ esxTotal if hosts unified split-by-kind)
  partition: { overdue: Row[]; w3: Row[]; w3to6: Row[]; w6to9: Row[]; w9to12: Row[]; beyond12: Row[]; unknown: Row[] }
  // cumulative display counts (presentation overlay; NOT used for reconciliation)
  cumulative: { overdue: number; le3: number; le6: number; le9: number; le12: number; unknown: number }
  rawUnknown: { osString: string; count: number }[]     // D-11 — verbatim, occurrence-counted, NEVER aggregated-only
  esxi: { /* split by kind — D-09b: host counts NEVER summed with VM counts */ }
}
```

### Anti-Patterns to Avoid

- **Importing `catalogue.json` inside a pure engine function.** The JSON import + Zod parse happen ONCE in `catalogue.ts` (the boundary). `bucketEos`/`normalizeOs` receive the typed catalogue as a parameter. Importing JSON into the pure engine breaks the engines-stay-pure / Zod-only-at-boundary invariant.
- **A second `useMemo` for the EOS projection.** It composes inside the existing `buildEstateView` single pass (D-00; grep-gated single-memo invariant).
- **Summing ESXi host count + VM count into one bucket total** (D-09b). If a unified timeline is chosen, the count in each tile/label is split by entity kind ("VMs: n · ESXi hosts: m").
- **Coloring buckets as a verdict** (G1 lesson — UI-SPEC §Color). No red/orange/green; "overdue" is a neutral position label.
- **Fabricating an ESXi patch-level EOL.** The v1 catalogue has none — patch level → em-dash sentinel (D-09c). Never invent a date.
- **Modeling `eoesFrom`/RHEL ELS/Windows ESU.** D-04: single standard-support EOL only. An OS past `eolFrom` but under paid ESU still buckets **overdue**.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Windows/Linux/other coarse split | A new family classifier | `classifyOsFamily` in `src/engines/aggregation/osFamily.ts` | Already shipped, tested; DRY — compose, don't duplicate (CONTEXT D-00). |
| Bucket→entity table (sort/filter/columns/CSV) | A bespoke EOS table | Shipped P3 `DataTable` + `ColumnPicker` with `objectKind: 'vm'\|'esx'` | D-08; 4th-context reuse of a DRY-justified primitive. |
| Forecast timeline chart | A new chart wrapper / raw ECharts import | Shipped P2 `<Chart>` (single `option` prop, SVG inherited) | `src/components/Chart.tsx` is the ONLY ECharts import site project-wide. |
| Top-level nav for the EOS view | A new nav component | Extend `ViewToggle` `AppView` union + `VIEWS` array with `'eos'` | Proven twice (P5 'hosts', P6 'planning'); keep `role="group"`+`aria-pressed`+arrow-wraparound verbatim. |
| Catalogue date formatting | Inline `toLocaleDateString` | A new locale-aware date helper added to `src/utils/format.ts` | **`utils/format.ts` has NO date formatter today** (verified — only number/GHz/MiB/percent). Add `fmtDate(iso, locale)` there (DRY-compose, don't inline; no pre-formatted dates in i18n strings). |
| HTTP client for the sync script | `axios`/`node-fetch` | Node 24 built-in global `fetch` | CI is Node 24; zero deps; mirrors `check-supply-chain.mjs` bare-Node style. |
| Catalogue schema validation | Hand-rolled shape checks | Zod (already a dep) at the `catalogue.ts` boundary | Mirrors `parser/schemas.ts`; consistent boundary-validation pattern. |

**Key insight:** Almost everything this phase needs is already shipped (chart, table, nav, family classifier, store, single-memo bridge). The genuinely new code is small and pure: a regex bank, a date-math bucketer, an ESXi classifier, a Zod schema, and a build-time fetch script. The risk is **not** missing libraries — it is OS-string-variant coverage and the no-runtime-network discipline.

## Runtime State Inventory

> Greenfield feature for vatlas (no rename/refactor). One build-time-state item is worth flagging:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `src/engines/eos/catalogue.json` — a NEW committed build artifact carrying `lastVerified` + per-product releases. Not user data; not a privacy concern (public lifecycle dates, no workbook content). | Commit it; regenerate via `npm run sync:eos`. Review the diff in PR. |
| Live service config | None — vatlas makes zero runtime calls; `endoflife.date` is contacted ONLY by the maintainer-run `sync:eos` script, never by CI deploy or the app. | None. |
| OS-registered state | None. | None — verified, no OS-level registration. |
| Secrets/env vars | None — endoflife.date API is public, unauthenticated (verified: live curl with no headers succeeded). | None. |
| Build artifacts | `catalogue.json` is the only new build-time input; `vite build` bundles it as a static import. No stale-artifact risk (it is source-controlled, not generated into `dist/` separately). | None beyond committing it. |

## Common Pitfalls

### Pitfall 1: ESXi patch-level EOL does not exist in the catalogue

**What goes wrong:** EOS-04 asks for "patch-level and major-version" classification; a planner may assume endoflife.date exposes per-build EOL and design a lookup that silently returns `null` or, worse, fabricates a date.
**Why it happens:** The requirement text implies patch granularity; the catalogue only has major-version `eolFrom`.
**How to avoid:** Confirmed via live query — ESXi v1 `releases` are `["9.0","8.0","7.0","6.7",...]` with `eolFrom` per major (`8.0 → 2027-10-11`, `7.0 → 2025-10-02`); there is **no** patch/build EOL field (the `latest` object is "newest build", not an EOL). D-09c explicitly anticipates this: classify against **major-version EOL**, and for patch/update level emit the **em-dash sentinel** (never a fabricated date). The build string (`build-24674464`) is still surfaced **factually as plain text** (do not regress P5's plain-text presentation, D-09a). `[VERIFIED: live curl /api/v1/products/esxi/ 2026-05-17]`
**Warning signs:** Any code path that maps an ESXi build number to a date. There is no such mapping in the data.

### Pitfall 2: RVTools OS strings are a controlled vocabulary, not free text — but versionless "Other" forms are real

**What goes wrong:** Treating the OS column as arbitrary free text leads to over-engineering; conversely, assuming every string carries a version leads to mis-bucketing.
**Why it happens:** RVTools emits the vCenter guest-OS dropdown vocabulary. Harvested real space (from the 3 real fixtures + sample): 45 distinct `osConfig`, 44 distinct `osTools`. Dominant forms are `"Microsoft Windows Server YYYY (64-bit)"`, `"Red Hat Enterprise Linux N (64-bit)"`, `"CentOS N (64-bit)"`, `"Debian GNU/Linux N (64-bit)"`, `"SUSE Linux Enterprise N (64-bit)"`, `"Ubuntu Linux (64-bit)"`. But there are genuinely **versionless / un-mappable** forms that MUST land in the first-class unknown bucket, not be force-fit: `"Other (64-bit)"`, `"Other 3.x or later Linux (64-bit)"`, `"Other 2.6.x Linux (64-bit)"`, `"VMware Photon OS (64-bit)"`, `"FreeBSD (32-bit)"`, `"FortiManager-VM64 v7.4.6-build2588 ..."`, `"Microsoft Windows 2000"`. `osTools` can also be empty → fall back to `osConfig` (mirror `classifyOsFamily`'s `(osConfig||osTools)` precedence, but note `VmDisplayRow.os` uses `osTools||osConfig`).
**How to avoid:** Regex bank keyed on slug; anything that does not match a slug-with-resolvable-version → unknown (D-10), raw string preserved verbatim (D-12), occurrence-counted (D-11). Target <5% unknown on a ≥50-string fixture (success criterion 5) — achievable because the matchable forms (Windows Server, RHEL, CentOS, Debian, SLES) dominate the count distribution; the unknown residue is the long tail of "Other ... Linux" and appliance strings, which is the correct, honest result.
**Warning signs:** A regex that tries to extract a version from `"Other 3.x or later Linux (64-bit)"` (`3.x` is not a catalogue version). `"Ubuntu Linux (64-bit)"` has no version in RVTools → it is **legitimately unknown** for EOL purposes (endoflife.date Ubuntu keys on `24.04` etc., which RVTools does not provide) — count it unknown, do not guess.

### Pitfall 3: CentOS "4/5/6/7" multi-version strings

**What goes wrong:** `"CentOS 4/5 (64-bit)"`, `"CentOS 4/5/6/7 (64-bit)"`, `"CentOS 4/5/6 (64-bit)"` are real (harvested). A naive `\d+` captures `4`.
**Why it happens:** vCenter collapses several guest-OS generations into one dropdown entry.
**How to avoid:** This is a planner decision (D-06-adjacent). Recommended: a multi-version string is **not determinable to a single EOL** → treat as **unknown** (honest; never silently pick the oldest or newest — that would fabricate a verdict, violating D-00). Surface it verbatim in the unknown list so the maintainer sees the signal. Document the choice in the plan.
**Warning signs:** A bucket count that moves depending on whether you read the first or last digit of `4/5/6/7`.

### Pitfall 4: Wall-clock-coupled buckets must be computed from `today`, not capture date

**What goes wrong:** Reusing the snapshot's `capturedAt` (which the codebase already extracts, `parser/captureDate.ts`) as the bucketing reference.
**Why it happens:** It is the "more reproducible" choice and is right there in the data.
**How to avoid:** D-07 is explicit and user-accepted: reference = **TODAY (workbook-load date)**. "Overdue" = `eolFrom < today`. The view must surface "Forecast computed as of {today}" so the wall-clock coupling is honest. `today` enters the engine as an injected parameter (pure function — do NOT call `new Date()` inside the engine; pass it in from the boundary so tests are deterministic).
**Warning signs:** `new Date()` inside `bucketEos.ts`; a test that breaks tomorrow.

### Pitfall 5: A third-party outage blocking the deploy

**What goes wrong:** A CI step fetches endoflife.date at deploy time; endoflife.date is down; the GitHub Pages deploy fails.
**Why it happens:** "Freshness" instinct → fetch at build.
**How to avoid:** D-02 hard rule. The recommended architecture makes this **structurally impossible**: CI deploy NEVER fetches; it only Zod-validates the committed `catalogue.json` and emits a `::warning::` (never `exit 1`) if `today - lastVerified > 90d`. The `sync:eos` script (maintainer-run, not in the deploy path) MAY `exit 1` on fetch failure / bad shape so a bad snapshot is never committed — but that failure is local/PR-time, decoupled from deploy.
**Warning signs:** Any `curl`/`fetch` to `endoflife.date` inside `.github/workflows/static.yml`'s build job.

### Pitfall 6: ESXi guest-OS rows vs real ESXi hosts

**What goes wrong:** `osConfig`/`osTools` themselves sometimes contain `"VMware ESXi 6.5 or later"`, `"VMware ESXi 6.x"`, `"VMware ESXi 8.0 or later"` (harvested — these are nested-ESXi *VMs*). Counting these as "ESXi hosts" conflates VM and host cardinality (violates D-09b).
**Why it happens:** Nested virtualization shows ESXi as a guest OS string on a VM row.
**How to avoid:** ESXi-host classification consumes **`vhost.esxVersion`** (the real host), never the VM `osConfig`. A VM whose guest OS is "VMware ESXi …" is just a VM — bucket it by its (likely unknown / versionless) guest string, in the VM partition, never in the host count.
**Warning signs:** An ESXi host count that exceeds the `vHost` row count.

## Code Examples

### endoflife.date v1 — real records (VERIFIED live 2026-05-17)

```jsonc
// GET https://endoflife.date/api/v1/products/esxi/  → result.releases[ ... ]
{ "name": "8.0", "label": "8.0", "releaseDate": "2022-10-11",
  "isEol": false, "eolFrom": "2027-10-11", "isMaintained": true,
  "latest": { "name": "8.0", "date": "...", "link": "..." }, "custom": { "technicalGuidance": "2032-10-11" } }
{ "name": "7.0", "label": "7.0", "releaseDate": "2020-04-02",
  "isEol": true,  "eolFrom": "2025-10-02", "isMaintained": false }
// NOTE: releases are MAJOR versions only ("9.0","8.0","7.0","6.7","6.5","6.0","5.5","5.1","5.0").
// No patch/build-level EOL field anywhere. (D-09c → patch level = em-dash sentinel.)

// GET .../products/rhel/  → result.releases[0]
{ "name": "10", "label": "10 (Upcoming ELS)", "releaseDate": "2025-05-20",
  "isEoas": false, "eoasFrom": "2030-05-31",        // end-of-active-support (NOT used — D-04)
  "isEol": false,  "eolFrom": "2035-05-31",         // ← THE date P7 uses (standard support end)
  "isEoes": false, "eoesFrom": "2038-05-31",        // end-of-extended (paid ELS) — IGNORED (D-04)
  "isMaintained": true }
// rhel releases: ["10","9","8","7","6","5","4"]  → keyed by MAJOR ("8" matches RHEL 8.x)

// GET .../products/windows-server/  → release sample
{ "name": "2025", "label": "Windows Server 2025 (LTSC)", "isEol": false, "eolFrom": "2034-10-10", ... }
// windows-server releases keyed by year: ["2025","2022","2019","2016","2012-r2","2012","2008-r2",...] (20 total)

// GET .../products/oracle-linux/  releases: ["10","9","8","7","6","5"]  (keyed by MAJOR)
//   uses isEol/eolFrom (+ isEoes/eoesFrom which we ignore)
// centos releases ["8","7","6","5"]; debian ["13","12","11","10",...]; sles ["16.0","15.7",...,"12.x","11.x"]
```

### Real OS-string fixture (harvested from `tests/fixtures/` — put in `src/engines/eos/fixtures/real-os-strings.ts`)

```typescript
// 50+ REAL distinct strings harvested 2026-05-17 from the three real RVTools
// fixtures + rvtools-sample.xlsx (vInfo "OS according to the configuration file"
// + "OS according to the VMware Tools"). Drives the <5%-unknown assertion
// (success criterion 5) and the RHEL-8 / Oracle-Linux variant tests (criterion 6).
export const REAL_OS_STRINGS = [
  // Windows Server (matchable → windows-server)
  'Microsoft Windows Server 2022 (64-bit)', 'Microsoft Windows Server 2019 (64-bit)',
  'Microsoft Windows Server 2016 or later (64-bit)', 'Microsoft Windows Server 2016 (64-bit)',
  'Microsoft Windows Server 2012 (64-bit)', 'Microsoft Windows Server 2008 R2 (64-bit)',
  'Microsoft Windows Server 2025 (64-bit)', 'Microsoft Windows 2000 Server',
  // Windows desktop (matchable → windows)
  'Microsoft Windows 10 (64-bit)', 'Microsoft Windows 11 (64-bit)', 'Microsoft Windows 7 (64-bit)',
  'Microsoft Windows 8 (64-bit)', 'Microsoft Windows 2000',
  // RHEL — the FOUR variants the success criterion + Oracle-3 test target.
  // RVTools real space gives osConfig "Red Hat Enterprise Linux 8 (64-bit)"
  // and osTools "Red Hat Enterprise Linux 8.10" (see rvtools.test.ts L85-86,
  // canary.test.ts L44-45). The 4 RHEL-8 forms the test must cover:
  'Red Hat Enterprise Linux 8 (64-bit)', 'Red Hat Enterprise Linux 8.10',
  'RHEL 8 (64-bit)', 'redhat enterprise linux 8',          // case-insensitive (D-12)
  'Red Hat Enterprise Linux 7 (64-bit)', 'Red Hat Enterprise Linux 9 (64-bit)',
  'Red Hat Enterprise Linux 6 (64-bit)',
  // Oracle Linux — the THREE variants the success criterion targets:
  'Oracle Linux 8', 'Oracle Enterprise Linux 8', 'Oracle Linux Server 8.10',
  // CentOS (incl. real multi-version forms → unknown per Pitfall 3)
  'CentOS 7 (64-bit)', 'CentOS 8 (64-bit)', 'CentOS 4/5 (64-bit)',
  'CentOS 4/5/6/7 (64-bit)', 'CentOS 4/5/6 (64-bit)', 'CentOS 6 (64-bit)',
  // Debian / SUSE / Ubuntu (Debian+SLES matchable; Ubuntu versionless → unknown)
  'Debian GNU/Linux 10 (64-bit)', 'Debian GNU/Linux 12 (64-bit)', 'Debian GNU/Linux 6 (64-bit)',
  'Debian GNU/Linux 11 (64-bit)', 'Debian GNU/Linux 7 (64-bit)', 'Debian GNU/Linux 8 (64-bit)',
  'Debian GNU/Linux 9 (64-bit)', 'Debian GNU/Linux 5 (64-bit)',
  'SUSE Linux Enterprise 11 (64-bit)', 'SUSE Linux Enterprise 12 (64-bit)',
  'SUSE Linux Enterprise 15 (64-bit)', 'SUSE openSUSE (64-bit)',
  'Ubuntu Linux (64-bit)',
  // Legitimately UNKNOWN long tail (must reconcile into the unknown bucket, D-10):
  'Other (64-bit)', 'Other (32-bit)', 'Other Linux (64-bit)',
  'Other 3.x or later Linux (64-bit)', 'Other 2.6.x Linux (64-bit)',
  'Other 3.x Linux (64-bit)', 'Other 4.x or later Linux (64-bit)',
  'Other 4.x Linux (64-bit)', 'Other 5.x Linux (64-bit)',
  'VMware Photon OS (64-bit)', 'VMware ESXi 6.5 or later', 'VMware ESXi 6.x',
  'VMware ESXi 8.0 or later', 'FreeBSD (32-bit)', 'FreeBSD Pre-11 versions (32-bit)',
  'Rocky Linux (64-bit)', 'AlmaLinux (64-bit)',
  'FortiManager-VM64 v7.4.6-build2588 241218 (GA.M)',
  'FortiAnalyzer-VM64 v7.4.8-build2744 250926 (GA.M)',
] as const
// ESX Version strings (vHost "ESX Version") — all four real fixtures are 8.0.3:
export const REAL_ESX_VERSIONS = [
  'VMware ESXi 8.0.3 build-24674464', 'VMware ESXi 8.0.3 build-24859861',
  'VMware ESXi 8.0.3 build-24784735', 'VMware ESXi 8.0.3 build-24585383',
] as const  // → classify to esxi major "8.0" (eolFrom 2027-10-11); patch level → em-dash
```

### Integration: attach `eos` to EstateView inside the existing single pass

```typescript
// src/engines/aggregation/estateView.ts  — add ONE field, NO new memo (D-00).
// catalogue is parsed ONCE at the boundary (catalogue.ts) and passed in.
import { buildEosProjection } from '@/engines/eos/bucketEos'
import { loadEosCatalogue } from '@/engines/eos/catalogue'   // Zod boundary (module-level, parsed once)
// ... inside buildEstateView, in the SAME loop family as the existing
// `for (const vm of merged.vinfo)` classifyOsFamily pass (rides existing iteration):
const eos = buildEosProjection({
  vinfo: merged.vinfo,            // raw osConfig/osTools preserved verbatim per row (D-12)
  vhost: merged.vhost,            // esxVersion text (D-09b: counted as a DISTINCT entity kind)
  catalogue: loadEosCatalogue(),  // typed EosCatalogue (Zod already ran at boundary)
  today: new Date(),              // D-07 — load-date reference (inject; never call new Date() in the pure bucketer)
})
return { ...existingFields, eos }   // EstateView gains `eos: EosProjection`
// EMPTY_VIEW gains `eos: <frozen empty projection>` (mirror existing trends:null / plannedView:null idiom)
```

### App view-state branch (mirror P6 'planning' exactly)

```tsx
// src/components/ViewToggle.tsx — EXTEND (verbatim P5/P6 pattern):
export type AppView = 'dashboard' | 'inventory' | 'hosts' | 'planning' | 'eos'
const VIEWS = ['dashboard','inventory','hosts','planning','eos'] as const
// keep <fieldset role="group"> + biome-ignore + aria-pressed + arrow wraparound UNCHANGED.
// add i18n key nav.eos to BOTH en/ and fr/ (EN/FR parity).

// src/App.tsx — add ONE branch (mirror the 'planning' branch at L42-43):
// ... activeView === 'planning' ? (<PlanningView />)
//   : activeView === 'eos'      ? (<EosView />)
//   : (<GlobalDashboard />)
```

### CI freshness warning (warn-only — never blocks deploy, D-02)

```yaml
# .github/workflows/static.yml — add AFTER "Type check", BEFORE "Build".
# Pure read of the committed snapshot; NO network. exit 0 always.
- name: EOS catalogue freshness (warn >90d — never blocks, D-02)
  run: |
    lv=$(node -p "require('./src/engines/eos/catalogue.json').lastVerified")
    age=$(( ( $(date -u +%s) - $(date -u -d "$lv" +%s) ) / 86400 ))
    echo "EOS catalogue lastVerified=$lv (age ${age}d)"
    if [ "$age" -gt 90 ]; then echo "::warning::EOS catalogue is ${age} days old (>90) — run npm run sync:eos"; fi
    exit 0
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| endoflife.date legacy v0 (`/api/{product}.json`, flat `cycle`/`eol` keys) | v1 API `/api/v1/products/{slug}/`, `releases[].eolFrom` + `isEol` + labels, `schema_version` field | v1 GA (current `1.2.1`, queried 2026-05-17) | Use v1; richer + versioned schema; v0 superseded. |
| Runtime fetch of a lifecycle API | Build-time-baked, Zod-validated, source-controlled snapshot | This phase (privacy invariant) | No runtime network is structurally enforced (P1 guard throws); freshness is a maintainer/CI concern, not a runtime one. |

**Deprecated/outdated:**

- endoflife.date v0 endpoints — still served but superseded by v1; do not target v0.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The RHEL "4 variants" in success criterion 6 are the forms `{Red Hat Enterprise Linux 8 (64-bit)` / `Red Hat Enterprise Linux 8.10` / `RHEL 8 (64-bit)` / case-insensitive `redhat...`}. CONTEXT/ROADMAP name "RHEL 8's four variants" without enumerating them; the codebase shows the first two as real (`rvtools.test.ts`, `canary.test.ts`). | Code Examples, normalizeOs | LOW — the regex bank handles all four regardless; the test fixture should assert all four normalize to `(rhel, 8)`. Planner should confirm the exact 4 forms with the user if a precise list is contractually required. |
| A2 | Oracle Linux "3 variants" = `{Oracle Linux N` / `Oracle Enterprise Linux N` / `Oracle Linux Server N}`. No Oracle Linux strings appear in the harvested fixtures (none present) — these are the standard RVTools/vCenter Oracle forms from training knowledge, not verified in-repo. | Code Examples, normalizeOs | MEDIUM — Oracle Linux is absent from the 3 real fixtures, so the variant test is synthetic. Confirm the 3 forms with the user or add an Oracle-bearing fixture. The slug `oracle-linux` IS verified live (releases `["10","9","8",...]`). |
| A3 | CentOS multi-version forms (`4/5/6/7`) and versionless Ubuntu should bucket as **unknown** rather than guess a version. | Pitfall 3, Pitfall 2 | LOW — this is the honest/factual choice (D-00) and keeps reconciliation correct; but it does increase the unknown-bucket count. Planner should confirm this counts toward (not against) the <5% target interpretation, or treat the <5% target as measured on *resolvable* strings. **Flag for discuss-phase.** |
| A4 | <5% unknown is measured over the harvested ≥50-string fixture treating each *distinct* string once (not weighted by occurrence). | Validation Architecture | MEDIUM — weighting by occurrence (Windows Server dominates counts) makes <5% trivially easier; per-distinct-string is stricter. ROADMAP says "fixture of 50+ real OS strings" (suggests per-string). Planner should lock the denominator definition. **Flag for discuss-phase.** |

## Open Questions

1. **Exact RHEL-8 four-variant list (A1)** — known: 2 forms appear in repo tests; unclear: the canonical 4. Recommendation: planner enumerates the 4 in the test fixture and the plan; if the user has a contractual list, confirm in discuss-phase.
2. **Oracle Linux absent from real fixtures (A2)** — known: slug verified, 3 forms are standard; unclear: real RVTools Oracle strings. Recommendation: synthetic test acceptable for criterion 6; optionally request an Oracle-bearing workbook.
3. **<5%-unknown denominator (A4)** + **multi-version CentOS → unknown (A3)** — known: honest choice is "unknown"; unclear: whether the <5% target is per-distinct-string or occurrence-weighted, and whether deliberately-unknown forms count against it. Recommendation: planner locks the metric definition; surface both numbers in the test output for transparency.
4. **ESXi placement (D-09a/b)** — Claude's discretion. Recommendation: classify in `engines/eos/`, surface in the EOS view as a **separate ESXi-lifecycle sub-section** with its own count (never summed with VMs, D-09b); do NOT augment the P5 Hosts column in P7 (avoids a P5 regression-gate burden; revisitable later). Planner finalizes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `endoflife.date/api/v1` (public, unauth) | `npm run sync:eos` (build-time only) | ✓ | schema_version 1.2.1 | Last-good committed `catalogue.json` (D-02) |
| Node global `fetch` | `scripts/sync-eos.mjs` | ✓ | Node 24 (CI) / local Node 18+ | — (built in) |
| Zod | catalogue boundary | ✓ | ^4.4.3 (package.json) | — |
| Shipped `<Chart>` / `DataTable` / `ViewToggle` | EOS view | ✓ | P2/P3 shipped | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** endoflife.date reachability at sync-time — fallback is the committed last-good snapshot (D-02); never blocks deploy.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.2` |
| Config file | `vitest.config.ts` (coverage `include: ['src/engines/**/*.ts', ...]`, global thresholds 75/75/75/75) |
| Quick run command | `npx vitest run src/engines/eos` |
| Full suite command | `npm run test:run` (CI: `npm run test:run` + coverage gate) |

`src/engines/eos/` is **auto-gated at ≥75%** by the existing `src/engines/**/*.ts` coverage include — **no `vitest.config.ts` change needed** (EOS-06 satisfied structurally; verified L21-33). `catalogue.json` is data, not `.ts` — outside coverage.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EOS-01/02/03 | disjoint partition reconciles to entity total; +3/6/9/12 + overdue + unknown present | unit | `npx vitest run src/engines/eos/bucketEos.test.ts` | ❌ Wave 0 |
| EOS-04 | `VMware ESXi 8.0.3 build-N` → major `8.0` eol `2027-10-11`; patch level → em-dash; `7.0` → overdue | unit | `npx vitest run src/engines/eos/classifyEsxi.test.ts` | ❌ Wave 0 |
| EOS-05 | unmatched OS → unknown bucket; raw string verbatim (D-12) + occurrence count (D-11); nothing dropped | unit | `npx vitest run src/engines/eos/normalizeOs.test.ts` | ❌ Wave 0 |
| EOS-06 (crit. 6) | RHEL-8 four variants all → `(rhel,8)`; Oracle-Linux three variants all → `(oracle-linux,8)` | unit | `npx vitest run src/engines/eos/normalizeOs.test.ts` | ❌ Wave 0 |
| crit. 5 | `<5%` unknown on `REAL_OS_STRINGS` (≥50 harvested) — assert and print both per-string + weighted | unit | `npx vitest run src/engines/eos/normalizeOs.test.ts` | ❌ Wave 0 |
| EOS-06 freshness | `lastVerified` parsed; >90d → caption; CI warn-only | unit + CI | `npx vitest run src/engines/eos/catalogue.test.ts` | ❌ Wave 0 |
| D-12 | original RVTools string preserved verbatim through matching | unit | included in `normalizeOs.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/engines/eos`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** full suite green + coverage gate (`npm run test:coverage`) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/engines/eos/fixtures/real-os-strings.ts` — the harvested ≥50-string + ESX fixture (content provided above; copy verbatim)
- [ ] `src/engines/eos/normalizeOs.test.ts` — RHEL-8×4, Oracle-Linux×3, <5%-unknown, D-12 verbatim, multi-version-CentOS→unknown (A3)
- [ ] `src/engines/eos/classifyEsxi.test.ts` — 8.0.3 build → major 8.0; 7.0 → overdue; patch em-dash
- [ ] `src/engines/eos/bucketEos.test.ts` — disjoint partition reconciliation == total; today injected (deterministic); host/VM split (D-09b)
- [ ] `src/engines/eos/catalogue.test.ts` — Zod accepts a real snapshot; rejects malformed; `lastVerified` >90d boundary
- [ ] A small committed `catalogue.json` (or a test fixture catalogue) so engine tests don't need network
- Framework install: none — Vitest already wired.

## Security Domain

> `security_enforcement` not explicitly false in config; included. This phase's only security-relevant surface is supply-chain/privacy.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | endoflife.date is public/unauth; no secrets. |
| V3 Session Management | no | No sessions; client-only. |
| V4 Access Control | no | Read-only derived view. |
| V5 Input Validation | yes | Zod validates `catalogue.json` at the boundary; malformed/poisoned snapshot → build fails (not silently trusted). RVTools OS strings already Zod-trimmed at the parser boundary. |
| V6 Cryptography | no | No crypto; no secrets. |
| V10 Malicious Code / Supply Chain | yes | `catalogue.json` is a committed, PR-reviewable artifact; `sync:eos` fetches over HTTPS from a single known host; no new npm runtime dep (no new supply-chain surface). The privacy guard (P1) ensures the app itself never fetches it at runtime. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Poisoned/tampered catalogue snapshot | Tampering | Zod schema validation at the boundary (build fails on bad shape); committed JSON reviewed in PR diff; single trusted HTTPS source. |
| Runtime exfiltration via a "freshness fetch" | Information disclosure | Architecturally impossible: P1 privacy guard throws on any non-same-origin fetch; D-01 mandates zero runtime network; CI deploy never fetches. |
| Stale lifecycle data presented as current | Repudiation (misleading) | `lastVerified` always surfaced (D-03); >90d neutral caption; CI warn. Factual, not hidden. |

## Sources

### Primary (HIGH confidence)

- endoflife.date v1 API — **queried live 2026-05-17**: `/api/v1/` (`schema_version 1.2.1`), `/api/v1/products/` (`total 455`), `/api/v1/products/{esxi,rhel,oracle-linux,windows-server,windows,centos,debian,ubuntu,sles,almalinux,rocky-linux}/` — exact field names (`releases[].name/label/releaseDate/isEol/eolFrom/isMaintained`, paid-tier `isEoes/eoesFrom`), ESXi major-only granularity, product slugs + release keying.
- Repo (grep/Read, this session): `src/engines/aggregation/osFamily.ts`, `estateView.ts`, `src/types/{vinfo,vhost,estate}.ts`, `src/components/ViewToggle.tsx`, `src/App.tsx`, `src/hooks/useEstateView.ts`, `src/utils/format.ts` (no date helper), `vitest.config.ts` (coverage include + thresholds), `.github/workflows/static.yml`, `scripts/check-supply-chain.mjs`, `package.json`.
- RVTools OS-string space — **harvested live 2026-05-17** via SheetJS from `tests/fixtures/RVTools_export_all_2026-01-07…`, `…2026-01-14…`, `…2026-04-17…-MOM-vCenter.xlsx`, `rvtools-sample.xlsx` (45 distinct osConfig, 44 distinct osTools, 4 distinct ESX Version).
- `07-CONTEXT.md` (D-00..D-12), `07-UI-SPEC.md`, `.planning/REQUIREMENTS.md` (EOS-01..06; stale Phase-5 coverage row), `.planning/ROADMAP.md` Phase 7.

### Secondary (MEDIUM confidence)

- WebFetch of endoflife.date ESXi page (corroborated by the live curl — agreement increases confidence to HIGH on ESXi granularity).

### Tertiary (LOW confidence)

- Oracle Linux RVTools string forms (A2) — training knowledge; not present in the real fixtures (flagged in Assumptions Log).

## Metadata

**Confidence breakdown:**

- endoflife.date schema / slugs / ESXi granularity: HIGH — live-queried, cross-checked WebFetch.
- OS-string space / normalizer feasibility: HIGH — harvested from the actual real fixtures.
- Bundling/CI architecture: HIGH — verified against the real `static.yml` + scripts pattern.
- Oracle-Linux variant forms: MEDIUM — slug verified live; exact RVTools strings not in-repo (A2).
- <5%-unknown metric definition: MEDIUM — depends on a denominator decision (A3/A4) the planner must lock.

**Research date:** 2026-05-17
**Valid until:** 2026-06-16 (30 days — endoflife.date v1 schema is stable; dates shift but the *schema* and *slugs* are durable. Re-run `sync:eos` for current dates at build time.)
