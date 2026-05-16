# Phase 1: Foundation & Invariants — Research

**Researched:** 2026-05-15
**Domain:** Browser-only RVTools analytics foundation — parser-in-Web-Worker, privacy guard layer, branded units module, immutable Zustand snapshot store, drag-drop shell, i18n/theme/CI scaffolding (sibling of vsizer; first phase of vatlas)
**Confidence:** HIGH overall. The stack and architecture are direct ports of vsizer's shipped baseline; the four net-new pieces (Web Worker parser boundary, runtime fetch-guard, branded units module, multi-snapshot Zustand shape) are well-grounded in standard React 19 / Vite 8 / Zod 4 patterns. MEDIUM on a few specifics flagged inline (exact i18next-browser-languagedetector test-mode interplay; ECharts 6 vs 5 version landscape for Phase 2 — not Phase 1's problem but flagged).

## Summary

Phase 1 is a port-with-extensions of vsizer's foundation, plus four engineering inventions that vatlas must own. The port: copy vsizer's `tsconfig.*.json`, `biome.json`, `vitest.config.ts`, `src/i18n/`, `src/test/setup.ts`, the GitHub Pages CI workflow, the `useTheme` hook + FOUC script, the SheetJS-CDN-tarball dependency pinning approach, and the `engines/parser/` directory minus `detectSource.ts` / `adapters/liveoptics.ts` / `extractWorkbook.ts`. The inventions: (1) a Web Worker boundary at the parser edge that returns canonical typed rows — never the SheetJS `WorkBook` object; (2) a runtime `fetch`/`XHR`/`WebSocket`/`sendBeacon` guard installed in `src/main.tsx` before any other import, throwing on any non-same-origin attempt; (3) a `engines/units/` module with branded TS types `MiB`/`GiB`/`MHz`/`GHz`/`Bytes`/`Cores` plus the `BYTES_PER_MIB = 1_048_576` constant and converter functions, making "MB-is-MiB" and "MHz-vs-GHz" bugs unrepresentable; (4) a multi-snapshot Zustand store shaped as `snapshots: Map<id, Snapshot>` (immutable, append-only) — deliberately *not* caching aggregates the way vsizer's `datasetStore.ts` does, because vatlas's DR sim and EOS asOf-dependent views make store-side aggregate cache invalidation a foot-cannon.

The five hard correctness invariants this phase locks in for every later phase: (1) RVTools "MB" is base-2 MiB — never multiply by 1.048576 (ADR-0010 inherited verbatim from store-predict ADR-017); (2) all dataset rows live in memory only — refresh wipes everything, no `localStorage` / `sessionStorage` / `IndexedDB` / `OPFS` of `vinfo`/`vhost`/`vdatastore`/`vpartition` rows ever, only the locale code and theme preference may use `localStorage`; (3) no non-same-origin network requests anywhere — the runtime guard throws synchronously on any attempt, with a belt-and-suspenders CSP meta tag `connect-src 'self'`; (4) parsing runs in a Web Worker so a 30 MB / 10 k VM workbook never freezes the UI, with `XLSX.read(buf, { dense: true })` and eager raw-cell drop on the worker side; (5) every column header lookup is alias-driven, never positional, so RVTools 3.10/3.11/4.0/4.4 drift is absorbed.

**Primary recommendation:** Decompose into five plans tracking the natural seams. Plan 1 lays the bootstrap (Vite 8 + React 19 + TS strict + Tailwind v4 + Biome + Vitest + i18n + theme + drag-drop shell + CI + base path) — a deployable empty shell. Plan 2 lands the privacy guard layer (`src/privacy/fetchGuard.ts`, CSP meta tag, CI denylist of telemetry packages, `package.json` engine-denied list) before any business code runs. Plan 3 ships `engines/units/` + ADR-0010 inheritance + the MiB canary fixture. Plan 4 ports the parser into a Web Worker boundary with the extended adapter (OS column, vDatastore, vPartition) and the alias dictionary. Plan 5 implements the multi-snapshot Zustand store + snapshot-list sidebar UI shell and proves the end-to-end smoke on a real RVTools workbook from disk. Plans 1, 2, 3 are mostly independent; 4 depends on 3 (branded types); 5 depends on 4 (Snapshot type).

<user_constraints>

## User Constraints (from CONTEXT.md)

> No CONTEXT.md was produced for this phase (`workflow.skip_discuss: true` in config.json — Phase 1 went straight from roadmap to research). The constraint surface for the planner therefore comes from the binding documents that govern the whole project: PROJECT.md (constraints + key decisions), REQUIREMENTS.md (Phase 1 owns FND-01..05, PAR-01..05, PRV-01..03), and ROADMAP.md (Phase 1 detailed section). The user-supplied additional context in the spawn message also carries hard constraints, reproduced below verbatim.

### Locked Decisions

The following are **locked** by PROJECT.md, REQUIREMENTS.md, ROADMAP.md, and the durable engineering principles directive saved at `~/.claude/projects/-Users-fjacquet-Projects-rvtui/memory/`. The planner MUST honor them and MUST NOT propose alternatives.

- **Tech stack: vsizer's exact stack at current versions.** React 19 + TypeScript (strict) + Vite 8 + Tailwind v4 + Zustand 5 + react-i18next + Zod 4 + SheetJS (`xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` from the CDN tarball, **never** the npm `xlsx` package) + pptxgenjs 4 + Biome + Vitest + @testing-library/react + Apache ECharts via `echarts-for-react` (SVG renderer everywhere, tree-shaken). ECharts is NOT installed in Phase 1 — it belongs to Phase 2.
- **Engineering principles (binding):** KISS, DRY, functional programming. Pure-function engines, immutable data, no class hierarchies for domain logic, no copy-paste between phases. Engines compose via small typed functions. Saved as durable memory.
- **Privacy invariant:** no fetch ships workbook bytes; no telemetry of parsed contents; no `localStorage` of dataset rows. Refresh = data gone.
- **Deploy target:** GitHub Pages static site at `fjacquet.github.io/vatlas/` (same CI shape as vsizer: typecheck → lint → test → build → deploy). Vite `base: '/vatlas/'`.
- **Input format:** RVTools `.xlsx` only (no Live Optics, no `.zip` bundles in v1). The vsizer files `detectSource.ts`, `adapters/liveoptics.ts`, `extractWorkbook.ts`, and `fflate` dependency MUST NOT be ported.
- **Charting (when it lands in Phase 2):** Apache ECharts via `echarts-for-react`, SVG renderer everywhere, tree-shaken. Not in Phase 1.
- **MB-is-MiB:** RVTools "MB" values are base-2 mebibytes. Never multiply by 1.048576. Inherit store-predict ADR-017 verbatim as `docs/adr/0010-rvtools-mb-as-mib.md`.
- **vsizer reuse map for Phase 1** (per ROADMAP.md and ARCHITECTURE.md):
  - **Port unchanged:** `engines/parser/parseXlsx.ts`, `engines/parser/adapters/columnMap.ts`, `engines/parser/synthesizeOrphanClusters.ts`, `engines/parser/normalizeColumns.ts`.
  - **Port + extend:** `engines/parser/adapters/rvtools.ts` (add OS column, datastore/partition extraction), `engines/parser/schemas.ts` (add `VDatastoreRow`, `VPartitionRow` schemas + branded outputs).
  - **DROP entirely:** `engines/parser/detectSource.ts`, `engines/parser/adapters/liveoptics.ts`, `engines/parser/extractWorkbook.ts`.
  - **Port verbatim:** `biome.json`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `src/test/setup.ts`, `public/theme-init.js` (rename `vsizer-theme` → `vatlas-theme`), `useTheme.ts` (rename storage key).
  - **New for vatlas:** `engines/units/` (branded types module), Web Worker boundary, privacy guard, multi-snapshot Zustand store shape, snapshot list sidebar UI shell.
- **Multi-vCenter dedupe keys (later phases, designed for now):** clusters keyed on `(VI SDK UUID, cluster_moref)`; VMs on `vm_bios_uuid` (BIOS UUID) — never on names. Phase 1 must capture `viSdkUuid` on the Snapshot so Phase 4 can use it. Treat as ADR-worthy in Phase 4; Phase 1 just must not foreclose it.

### Claude's Discretion

- **Exact Web Worker file shape.** Use `new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' })`. The choice of plain `postMessage` typed contracts vs. a thin `Comlink`-like wrapper is at Claude's discretion — recommendation below: plain `postMessage` with discriminated-union message types, no Comlink dep (KISS).
- **Branded units module API surface.** Naming, exported helpers, constants — Claude's discretion within the constraint "make MB-is-MiB and MHz-vs-GHz unrepresentable". Recommendation below: nominal-style `type MiB = number & { readonly __brand: 'MiB' }` + `mib()` constructor + `mibToGib()` / `mhzToGhz()` converters.
- **Snapshot ID generation.** ULID, UUID v7, or `crypto.randomUUID()`. Recommendation: `crypto.randomUUID()` (built-in, no dep).
- **Capture-date inference fallback order.** ROADMAP.md and SUMMARY.md fix the order (explicit user input → filename ISO → vSource sheet → file mtime → ordinal). Claude's discretion only on the regex shape of the filename parser.
- **Sidebar shell layout.** Tailwind v4 layout choice (`grid` vs. `flex`, sidebar position) is presentational. Recommendation: left rail sidebar matching vsizer's aesthetic.
- **Drag-and-drop implementation: native HTML5 vs. react-dropzone.** KISS argues native (no extra dep). Recommendation below: native HTML5 (~50 LOC).
- **Test fixture harvesting strategy.** Which RVTools workbooks to copy as fixtures, exact MiB canary numbers — Claude's discretion within the constraint "≥4 real workbooks, one per RVTools generation, all known to load without modification". Real exports identified on disk: `~/Library/CloudStorage/OneDrive-Home/RVTools_export_all_2026-01-07_10.23.35.xlsx`, `~/Library/CloudStorage/OneDrive-Home/JTI/RVTools_export_all_2026-04-17_16.51.38-MOM-vCenter.xlsx`, `~/Library/CloudStorage/OneDrive-Home/live-optics/RVTools_export_all_2026-01-14_17.23.32.xlsx`, plus the small `vsizer/public/samples/rvtools-sample.xlsx` (synthetic, 26 KB).

### Deferred Ideas (OUT OF SCOPE for Phase 1)

These are explicitly other phases' work — Phase 1 MUST NOT touch them. The planner must reject any task that wanders into this list.

- **ECharts integration, `<Chart>` wrapper, SVG renderer setup, tree-shaking, Midnight Executive theme tokens applied to charts.** Phase 2.
- **`engines/aggregation/` (perCluster, perEsx, perDatastore, globals, contention, ghz).** Phase 2.
- **`useEstateView` hook.** Phase 2 (it's the bridge from store to engines; Phase 1 only ships the store inputs).
- **Inventory tree / TanStack Table / `@tanstack/react-virtual`.** Phase 3.
- **`engines/snapshotMerge/`, multi-vCenter merge logic, stretched-cluster pill, allocation sliders, DR simulation.** Phase 4.
- **EOS forecast, OS normalizer, `endoflife.date` catalogue sync, `engines/eos/`.** Phase 5.
- **Trends, timeline, sparklines, delta panel, `engines/trends/`.** Phase 6.
- **HTML report export, PPTX export, `engines/export/html/`, `engines/export/pptx/`.** Phase 7.
- **CSV export from tables.** Phase 3.
- **Live Optics support, `.zip` ingestion, `fflate`.** Out of scope for v1 entirely.
- **Service worker, offline mode, PWA install.** Forbidden (Critical-2 mitigation).
- **Sentry / PostHog / Datadog / Amplitude / Mixpanel / LogRocket / any analytics SDK.** CI-denied (Critical-2 mitigation).
- **Persistence of any kind for dataset rows.** Forbidden by privacy invariant.
- **Editorial recommendations in any UI string.** Banned by PROJECT.md.
</user_constraints>

<phase_requirements>

## Phase Requirements

The planner MUST address all thirteen IDs below. Each row maps a requirement to the research finding(s) that enable its implementation; each ID is also tagged with the *plan* it most naturally belongs to (the planner can override).

| ID | Description | Research Support | Suggested Plan |
|----|-------------|------------------|----------------|
| **FND-01** | App runs 100 % client-side at a public URL | Standard Stack §1 (Vite 8 GH Pages deploy, `base: '/vatlas/'`); CI workflow §4 (port `static.yml`); same shape as vsizer | Plan 1 (Bootstrap) |
| **FND-02** | Drag-and-drop zone on first load | Pattern 2 (drag-and-drop shell); Code Example "Native HTML5 drop zone"; vsizer's `FileDropzone.tsx` is the visual reference; i18n keys `upload.dropzone.*` | Plan 5 (Snapshot store + sidebar) — but the drop zone shell can land in Plan 1 with a stub handler if the planner prefers to spread out |
| **FND-03** | i18n FR + EN, auto-detect + toggle | Standard Stack §1 (i18next 26 + react-i18next 17 + browser-languagedetector 8); Pattern 5 (i18n bootstrap, ported from vsizer); only `common` + `upload` namespaces in Phase 1 | Plan 1 (Bootstrap) |
| **FND-04** | Light/dark theme | Pattern 6 (Tailwind v4 `@theme` blocks + class-strategy dark variant + FOUC script + `useTheme` hook ported from vsizer); rename storage key `vsizer-theme` → `vatlas-theme` | Plan 1 (Bootstrap) |
| **FND-05** | Workbook capture-date indicator visible | Snapshot model (§Data Model) carries `capturedAt: Date`; capture-date inference chain (Pattern 4); display in snapshot-list sidebar in Plan 5; full "header + footer of every export" lands in Phase 7 — Phase 1 just must surface it in the snapshot card | Plan 5 |
| **PAR-01** | Parse without blocking UI (Web Worker) | Pattern 1 (Web Worker boundary, `new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' })`); Code Example "Worker message contract"; `XLSX.read(buf, { dense: true })`; **never** post the `WorkBook` object back — only canonical typed rows | Plan 4 (Parser worker) |
| **PAR-02** | Clear error naming missing sheet/column | Pattern 4 (Zod schemas with structured error reporting); the `ParseError` type carries `{ sheet, column?, kind, message }`; toast with `t('upload:errors.parseFailed', { message })`; specifically: missing sheet → "missing sheet: vInfo (workbook contained: vMetaData, vHost, vDatastore)"; missing column → "missing required column `# CPUs` in vInfo (also acceptable aliases: `CPUs`, `vCPU`); did you export from RVTools 3.9 or older?" | Plan 4 (Parser worker) |
| **PAR-03** | Column-name drift across RVTools 3.10/3.11/4.0/4.4 via alias dictionary | Pattern 3 (alias dictionary extends vsizer's `adapters/columnMap.ts`); table of known column changes (§Common Pitfalls Pitfall 5); RVTools version detection via `vMetaData` sheet presence + marker-column sniffing | Plan 4 (Parser worker) |
| **PAR-04** | MB-as-MiB preserved (no `* 1.048576`) | Pattern 7 (Branded units module, `engines/units/`); ADR-0010 inheritance (Code Example "ADR-0010 verbatim"); MiB canary fixture (§Test Fixtures); Pitfall 1 (Critical-1) | Plan 3 (Units module + ADR) |
| **PAR-05** | Refresh wipes everything (no localStorage/IndexedDB/OPFS of dataset rows) | Pattern 8 (Zustand store, memory-only); Code Example "Snapshot store shape"; only `vatlas-lang` (locale code) and `vatlas-theme` (preference) may use `localStorage`; CI grep for `localStorage.setItem` near `vinfo`/`vhost`/`vdatastore`/`Snapshot` should flag | Plan 5 (Snapshot store) |
| **PRV-01** | Runtime fetch/XHR/WS/Beacon guard throws on non-same-origin | Pattern 9 (Privacy guard, `src/privacy/fetchGuard.ts` installed at top of `src/main.tsx`); Code Example "Privacy guard implementation"; Critical-2 mitigation table | Plan 2 (Privacy guard) |
| **PRV-02** | CSP meta tag `connect-src 'self'` | Pattern 9 (CSP meta in `index.html`, full directive set); Code Example "CSP meta tag" | Plan 2 (Privacy guard) |
| **PRV-03** | No telemetry SDKs, CI denylist | Pattern 9 (CI denylist via Biome `noRestrictedImports` + a `scripts/check-forbidden-deps.mjs` npm script + GH Actions step); Pitfall 2 (Critical-2 enumerated leak vectors); no source-map upload step; Biome `noConsole` as error in non-test files | Plan 2 (Privacy guard) |
</phase_requirements>

## Architectural Responsibility Map

vatlas runs entirely in one browser tab — there is no backend tier, no API server, no edge worker. The "tiers" here are intra-browser execution contexts. Mapping each Phase-1 capability to its execution context surfaces the parser-worker boundary as the most important architectural seam.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| RVTools `.xlsx` ingestion (FileReader → ArrayBuffer) | Browser main thread | Web Worker (parser) | The `File` → `ArrayBuffer` read is main-thread work; the buffer is then transferred to the worker. Use the transferable form: `worker.postMessage({ kind: 'parse', buf }, [buf])` so the main thread loses ownership and the worker reads in place — zero copy. |
| SheetJS `XLSX.read` + RVTools adapter + Zod validation | **Web Worker (parser)** | — | A 30 MB workbook expands to 300–400 MB heap during parse (Critical-5). Main-thread parse freezes for seconds and risks OOM on small machines. Worker is mandatory from day one. |
| Canonical row return (typed `Snapshot` minus `id`/`parsedAt`) | Web Worker → Main thread | — | The worker posts back already-validated rows. The `WorkBook` object MUST NOT cross the boundary — only `{ vinfo: VInfoRow[], vhost: VHostRow[], vdatastore: VDatastoreRow[], vpartition: VPartitionRow[], vCenterLabel, rvtoolsVersion, capturedAt, parseErrors }`. |
| Snapshot store (Zustand) | Browser main thread | — | UI subscribes to the store; the store actions only ever set immutable snapshot objects. Memory only. |
| Privacy guard (`fetch`/`XHR`/`WS`/`Beacon` wrapper) | Browser main thread, **install before all other imports** | Web Worker (same install in worker entry) | The guard must be installed at the **very top of `src/main.tsx`**, before any module that might race a fetch. The worker has its own global scope and `XMLHttpRequest` — the same guard module is imported at the top of `parser.worker.ts` too. |
| CSP meta tag `connect-src 'self'` | Browser (parsed from `index.html` `<head>`) | — | Defense in depth alongside the runtime guard. CSP also blocks `<script src=>` injection, `frame-src`, inline scripts (we keep `'unsafe-inline'` only for the FOUC theme-init script — see §6). |
| i18n initialization + language detection | Browser main thread | — | Must happen before `<App />` mounts so `useTranslation()` resolves keys synchronously on first paint. |
| Theme resolution (FOUC prevention) | Browser main thread, **inline script in `<head>` before `<body>`** | — | Reads `localStorage['vatlas-theme']` and sets `<html class="dark">` before paint to avoid a flash of light theme. Pure DOM script, no React. |
| Drag-and-drop zone | Browser main thread | — | Native HTML5 drag-and-drop events on the React component; dispatches files to the parser worker via the upload hook. |
| Snapshot-list sidebar UI | Browser main thread | — | Reads from store, renders snapshot cards with `filename / vCenterLabel / capturedAt / rvtoolsVersion / row counts`. No charts in Phase 1. |
| Test fixtures (RVTools-MiB canary + 4 real workbooks per generation) | Build-time / test runner | — | Vitest reads fixtures from `src/__fixtures__/` or `public/samples/`. Coverage gate on `engines/parser/**` and `engines/units/**`. |
| CI: typecheck → lint → test → build → deploy + denylist enforcement | GitHub Actions runner (Node 24) | — | Mirrors vsizer's `static.yml`. Adds telemetry-package denylist step and SheetJS-tarball pinning verification step. |

## Standard Stack

### Core (Phase 1 only — ECharts and pptxgenjs are deferred to Phases 2/7)

All versions verified against the npm registry on 2026-05-15 (`npm view <pkg> version`).

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | `^19.2.6` `[VERIFIED: npm view react = 19.2.6]` | UI runtime | vsizer is on 19.2.6; current stable line; no RSC concerns (client-only). |
| `react-dom` | `^19.2.6` `[VERIFIED: npm]` | DOM bindings | Lockstep with React. |
| `typescript` | `~5.9.3` `[CITED: vsizer package.json + tsconfig.app.json]` | Strict typing | Match vsizer; `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` + `erasableSyntaxOnly`. |
| `vite` | `^8.0.13` `[VERIFIED: npm view vite = 8.0.13]` | Dev server + bundler | vsizer on 8.0.12; 8.0.13 is a patch bump. Rolldown bundler. |
| `@vitejs/plugin-react` | `^6.0.1` `[CITED: vsizer]` | React JSX/Fast Refresh | Required peer for Vite 8 + React 19. |
| `tailwindcss` | `^4.3.0` `[VERIFIED: npm view tailwindcss = 4.3.0]` | Styling | v4 stable; CSS-first `@theme` blocks; v4.3 added logical-property utilities and `@container-size`. |
| `@tailwindcss/vite` | `^4.3.0` `[CITED: STACK.md + Tailwind official docs]` | Tailwind Vite integration | First-party plugin; drops `tailwind.config.js` entirely. |
| `zustand` | `^5.0.13` `[VERIFIED: npm view zustand = 5.0.13]` | Client state | v5 stable; **named imports only** (`import { create } from 'zustand'`); memory-only, no persistence of dataset rows. |
| `zod` | `^4.4.3` `[VERIFIED: npm view zod = 4.4.3]` | Runtime schema validation | v4 stable since Aug 2025; do **not** mix v3 patterns. Use the `error` parameter, not `message`/`required_error`. |
| `xlsx` | `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` `[VERIFIED: cdn.sheetjs.com returned HTTP 200 for the tarball]` | RVTools `.xlsx` parsing | The **only** correct install channel. The npm `xlsx` is frozen at 0.18.5 and CVE-affected (CVE-2024-22363 ReDoS + CVE-2023-30533 prototype pollution). |
| `react-i18next` | `^17.0.8` `[VERIFIED: npm view react-i18next = 17.0.8]` | i18n | vsizer is on `^16.6.6`; **v17 is the current release**. The migration from v16 to v17 is small (TypeScript module typing moved from `react-i18next` to `i18next`; if you depend on `i18next.language` during a `languageChanged` callback, behavior changed) — vsizer's i18n usage does not depend on either. **Recommendation: ship `^17.0.8` from day one.** Use vsizer's `src/i18n/index.ts` shape verbatim, only update the `import` types. `[ASSUMED — based on search results; not deeply tested]` See Open Question Q3. |
| `i18next` | `^26.2.0` `[VERIFIED: npm view i18next = 26.2.0]` | i18n core | Lockstep with react-i18next. |
| `i18next-browser-languagedetector` | `^8.2.1` `[VERIFIED: npm]` | Locale detection chain | Same chain vsizer uses: `?lang=` → `localStorage['vatlas-lang']` → `navigator` → `fr` fallback. `vatlas-lang` (locale code only, **not** dataset content) is the *only* allowed `localStorage` write outside `vatlas-theme`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-error-boundary` | `^6.1.1` `[VERIFIED: npm view = 6.1.1]` | Crash isolation | Wrap `<App />`. `FallbackProps.error` is typed `unknown` — always narrow with `instanceof Error` before reading `.message`. Critically: the fallback may ONLY read `error.message` and `error.name`, **never** `error.cause` (which may carry parsed VM rows — Critical-2 leak vector). |
| `sonner` | `^2.0.7` `[VERIFIED: npm]` | Toast notifications | "Workbook loaded", "Parse error". One `<Toaster />` at root. |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| `@biomejs/biome` | `^2.4.15` `[VERIFIED: npm]` | Lint + format | Copy `biome.json` verbatim from vsizer. Single quotes JS, double CSS, no semicolons, 2-space, 100-char. Add `noConsole` as **error** in non-test files (Critical-2 mitigation). |
| `vitest` | `^4.1.6` `[VERIFIED: npm view vitest = 4.1.6]` | Unit + integration tests | vsizer on 4.1.2; 4.1.6 is a patch bump. Browser Mode stable (will use in Phase 2 for chart-render tests; Phase 1 stays on jsdom). |
| `@vitest/coverage-v8` | `^4.1.6` | Coverage provider | 75 % gate on `src/engines/**` and `src/utils/**`. |
| `@testing-library/react` | `^16.3.2` | Component tests | Standard. |
| `@testing-library/jest-dom` | `^6.9.1` | DOM matchers | Standard. |
| `@testing-library/user-event` | `^14.6.1` | Realistic user events | Standard. |
| `jsdom` | `^29.1.1` | Default test environment | Standard. |
| `@types/react` / `@types/react-dom` | `^19.2.14` / `^19.2.3` | Type defs | Lockstep with runtime. |
| `@types/node` | `^25.7.0` | Vite/Node types | For `vite.config.ts`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native HTML5 drag-and-drop | `react-dropzone` (`^14.x`) | react-dropzone gives free file-type filtering and accessibility plumbing; the cost is one more dep, ~13 KB gz, and an indirect way of doing what 40 lines of native event handlers can do. **KISS argues native.** Recommendation: native — see Pattern 2. |
| Plain `postMessage` for Worker contract | `Comlink` (`^4.x`) | Comlink hides the message protocol behind RPC-style async calls. Beautiful for complex worker APIs; over-engineered for one operation (`parseWorkbook(buf): Snapshot`). **KISS argues plain.** Recommendation: plain — see Pattern 1. |
| Branded number types via intersection | `Tagged` / `Newtype` libs (e.g. `ts-brand`, `newtype-ts`) | Adds a dep for what is a six-line type definition. Recommendation: hand-rolled — see Pattern 7. |
| `crypto.randomUUID()` for snapshot id | `ulid` / `uuid` v7 | Native API, zero dep. ULID's lexicographic-sort property is irrelevant here because snapshots sort by `capturedAt`. **Recommendation: `crypto.randomUUID()`.** |
| Centralized fetch-guard via `service worker` | Runtime monkey-patch in `main.tsx` | Service workers are explicitly **forbidden** by Critical-2 (increase attack surface). Runtime monkey-patch it is. |
| `i18next-resources-to-backend` lazy-load | Bundled-at-build-time resources | Lazy-loading FR JSON over HTTP is a same-origin request that the privacy guard would allow — but adds complexity. vsizer bundles; we bundle. |

**Installation:**

```bash
# 1) Core runtime deps
npm install \
  react@^19.2.6 \
  react-dom@^19.2.6 \
  zustand@^5.0.13 \
  zod@^4.4.3 \
  react-error-boundary@^6.1.1 \
  sonner@^2.0.7 \
  i18next@^26.2.0 \
  react-i18next@^17.0.8 \
  i18next-browser-languagedetector@^8.2.1

# 2) SheetJS — REQUIRED via the official tarball
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

# 3) Dev deps
npm install -D \
  vite@^8.0.13 \
  @vitejs/plugin-react@^6.0.1 \
  tailwindcss@^4.3.0 \
  @tailwindcss/vite@^4.3.0 \
  typescript@~5.9.3 \
  @types/react@^19.2.14 \
  @types/react-dom@^19.2.3 \
  @types/node@^25.7.0 \
  @biomejs/biome@^2.4.15 \
  vitest@^4.1.6 \
  @vitest/coverage-v8@^4.1.6 \
  @testing-library/react@^16.3.2 \
  @testing-library/jest-dom@^6.9.1 \
  @testing-library/user-event@^14.6.1 \
  jsdom@^29.1.1

# Verify the SheetJS pin landed correctly:
node -e "console.log(require('./package.json').dependencies.xlsx)"
# expected: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

**Version verification — done 2026-05-15 against the npm registry:**

| Package | Reported by `npm view <pkg> version` | Source |
|---------|--------------------------------------|--------|
| tailwindcss | 4.3.0 | npm registry |
| zod | 4.4.3 | npm registry |
| vite | 8.0.13 | npm registry |
| echarts | 6.0.0 (not used in Phase 1) | npm registry — flag for Phase 2 |
| echarts-for-react | 3.0.6 (not used in Phase 1) | npm registry — flag for Phase 2 |
| zustand | 5.0.13 | npm registry |
| react | 19.2.6 | npm registry |
| i18next | 26.2.0 | npm registry |
| react-i18next | 17.0.8 | npm registry |
| vitest | 4.1.6 | npm registry |
| @biomejs/biome | 2.4.15 | npm registry |
| pptxgenjs | 4.0.1 (not used in Phase 1) | npm registry |
| SheetJS xlsx tarball | 0.20.3 reachable, HTTP 200 | cdn.sheetjs.com |

**Note for Phase 2 planner:** ECharts shipped 6.0 in mid-2025. STACK.md pins `^5.6.0`. The v5→v6 breakup is a real migration (default theme changed; CartesianAxis position-shift; CanvasRenderer no longer included by default in the on-demand interface). Phase 2 must decide: stay on 5.6 (lower risk, recommended by STACK.md) or jump to 6.0 (current). Not Phase 1's problem.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BROWSER MAIN THREAD                                 │
│                                                                              │
│  index.html                                                                  │
│   ├─ <meta http-equiv="Content-Security-Policy"                              │
│   │     content="default-src 'self'; connect-src 'self'; ...">  ◀ PRV-02    │
│   ├─ <script src="/theme-init.js">  ◀ FOUC theme prevention                  │
│   └─ <script type="module" src="/src/main.tsx">                              │
│                                                                              │
│  src/main.tsx                                                                │
│   ├─ import './privacy/fetchGuard'  ◀ MUST be FIRST import — PRV-01          │
│   │     │  installs wrappers on window.fetch, XMLHttpRequest.prototype.open,  │
│   │     │  navigator.sendBeacon, WebSocket. Throws on non-same-origin.        │
│   ├─ import './i18n'  ◀ FND-03 (init before App so t() resolves synchronously)│
│   ├─ import './index.css'  ◀ Tailwind v4 + Midnight Executive @theme         │
│   └─ createRoot(rootEl).render(<App />)                                       │
│                                                                              │
│  <App />                                                                     │
│   ├─ <ErrorBoundary FallbackComponent={FallbackError}>  ◀ FallbackError      │
│   │   │       reads only error.message + .name; NEVER error.cause             │
│   │   ├─ <ThemeToggle />                                                     │
│   │   ├─ <LangToggle />                                                      │
│   │   ├─ <FileDropzone />  ◀ FND-02 native HTML5 drag/drop                   │
│   │   │      │ on drop:                                                       │
│   │   │      ▼                                                                │
│   │   ├─ useSnapshotUpload(files)                                            │
│   │   │      │ for each file:                                                 │
│   │   │      │   buf = await file.arrayBuffer()                              │
│   │   │      │   snapshot = await parseInWorker(buf, file.name, file.lastModified)│
│   │   │      │   store.addSnapshot(snapshot)                                  │
│   │   │      ▼                                                                │
│   │   ├─ <SnapshotListSidebar />  ◀ reads store, renders cards FND-05        │
│   │   │      shows: filename, vCenterLabel, capturedAt, rvtoolsVersion,      │
│   │   │             row counts (VMs / ESX / clusters / datastores)            │
│   │   └─ <Toaster />  ◀ sonner toast root                                    │
│   └─                                                                          │
│                                                                              │
│  ┌─── Zustand store (memory only — PAR-05) ────────────────────────────┐    │
│  │  snapshots: Map<id, Snapshot>      (immutable, append-only)         │    │
│  │  activeSnapshotId: id | null       (UI selection — drives sidebar)  │    │
│  │  locale: 'fr' | 'en'               (mirror of i18next state)        │    │
│  │  theme:  'light' | 'dark' | 'auto' (mirror of useTheme)             │    │
│  │  actions: addSnapshot, removeSnapshot, setActiveSnapshot            │    │
│  │  NEVER PERSISTED — refresh wipes the Map                             │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ────── parser-worker boundary (postMessage with transferable ArrayBuffer)   │
│         main → worker:  { kind: 'parse', buf: ArrayBuffer, filename, mtime } │
│         worker → main:  { kind: 'ok', snapshot } | { kind: 'err', error }    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                       PARSER WEB WORKER (PAR-01)                             │
│                                                                              │
│  src/engines/parser/parser.worker.ts                                         │
│   ├─ import '../../privacy/fetchGuard'  ◀ same guard installed in worker     │
│   │                                                                          │
│   ├─ self.onmessage = ({ data }) => switch (data.kind):                      │
│   │     case 'parse':                                                        │
│   │       const sheets = parseXlsx(data.buf)               ◀ port from vsizer│
│   │       const { vinfo, vhost, vdatastore, vpartition,                      │
│   │               vCenterLabel, rvtoolsVersion, capturedAt }                 │
│   │             = adaptRvtools(sheets, { mtime: data.mtime, filename })      │
│   │       // Zod-validate each row; collect ParseError[] for unknown cols    │
│   │       // DROP the SheetJS WorkBook reference immediately (memory budget) │
│   │       postMessage({ kind: 'ok', snapshot: {...} })                       │
│   │                                                                          │
│   └─ engines/parser/                                                         │
│        parseXlsx.ts             (port unchanged from vsizer)                 │
│        adapters/columnMap.ts    (port unchanged)                             │
│        adapters/rvtools.ts      (port + extend: OS, vDatastore, vPartition)  │
│        schemas.ts               (port + extend: VDatastoreRow, VPartitionRow,│
│                                  branded MiB / GHz output types)             │
│        synthesizeOrphanClusters.ts  (port unchanged)                         │
│        normalizeColumns.ts      (port unchanged)                             │
│        DROP from vsizer:                                                     │
│          detectSource.ts                                                     │
│          adapters/liveoptics.ts                                              │
│          extractWorkbook.ts                                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

ENGINES SUBSYSTEM (pure functions, no React, no DOM)
   src/engines/units/  ← NEW
     constants.ts       BYTES_PER_MIB = 1_048_576
     types.ts           MiB, GiB, MHz, GHz, Bytes, Cores, Sockets (branded)
     converters.ts      mibToGib, mhzToGhz, gibToTiB  (pure functions)
     index.ts           barrel
```

The parser worker is the **only** I/O boundary in Phase 1. The dashboard worker (Phase 7) lives at the same kind of boundary; the design here sets the precedent.

### Recommended Project Structure

This structure mirrors vsizer's layout (so the ported files drop in cleanly), with three new directories (`engines/units/`, `privacy/`, `__fixtures__/` if not present in vsizer) and the parser-worker file as a sibling of `parseXlsx.ts`.

```
vatlas/
├── public/
│   ├── samples/
│   │   ├── rvtools-sample.xlsx           # ported from vsizer (small synthetic, 26 KB)
│   │   └── rvtools-mib-canary.xlsx       # NEW — Critical-1 guard fixture
│   ├── theme-init.js                     # ported from vsizer; rename localStorage key
│   └── favicon.svg                       # ported
├── src/
│   ├── main.tsx                          # privacy/fetchGuard FIRST, then i18n, then index.css
│   ├── App.tsx                           # ErrorBoundary + shell + dropzone + sidebar
│   ├── index.css                         # Tailwind v4 @theme — port vsizer's Midnight Executive
│   ├── privacy/                          # NEW
│   │   ├── fetchGuard.ts                 # runtime fetch/XHR/WS/Beacon wrapper
│   │   └── fetchGuard.test.ts            # tests synchronous throw on non-same-origin
│   ├── engines/
│   │   ├── parser/
│   │   │   ├── parser.worker.ts          # NEW — Web Worker entry
│   │   │   ├── parseXlsx.ts              # PORT unchanged
│   │   │   ├── adapters/
│   │   │   │   ├── columnMap.ts          # PORT unchanged
│   │   │   │   └── rvtools.ts            # PORT + EXTEND (OS, vDatastore, vPartition)
│   │   │   ├── schemas.ts                # PORT + EXTEND (branded outputs, new sheets)
│   │   │   ├── synthesizeOrphanClusters.ts  # PORT unchanged
│   │   │   ├── normalizeColumns.ts       # PORT unchanged
│   │   │   ├── captureDateInference.ts   # NEW — explicit→filename→vSource→mtime→ordinal
│   │   │   └── *.test.ts                 # PORT + EXTEND
│   │   └── units/                        # NEW
│   │       ├── constants.ts              # BYTES_PER_MIB = 1_048_576
│   │       ├── types.ts                  # branded MiB, GiB, MHz, GHz, Bytes, Cores
│   │       ├── converters.ts             # mibToGib, mhzToGhz, etc.
│   │       ├── index.ts                  # barrel
│   │       └── *.test.ts
│   ├── store/
│   │   ├── snapshotStore.ts              # NEW — Map<id, Snapshot> shape
│   │   └── snapshotStore.test.ts
│   ├── hooks/
│   │   ├── useSnapshotUpload.ts          # NEW — wraps the parser worker
│   │   ├── useTheme.ts                   # PORT (rename 'vsizer-theme' → 'vatlas-theme')
│   │   └── useTheme.test.ts
│   ├── i18n/
│   │   ├── index.ts                      # PORT (drop dashboard/pptx/validation namespaces)
│   │   └── locales/
│   │       ├── en/{common,upload}.json   # PORT subset
│   │       └── fr/{common,upload}.json
│   ├── components/
│   │   ├── FileDropzone.tsx              # NEW (or PORT — vsizer has one)
│   │   ├── SnapshotListSidebar.tsx       # NEW
│   │   ├── SnapshotCard.tsx              # NEW
│   │   ├── ThemeToggle.tsx               # PORT
│   │   ├── LangToggle.tsx                # PORT
│   │   └── FallbackError.tsx             # PORT (verify never reads .cause)
│   ├── types/
│   │   ├── snapshot.ts                   # NEW — Snapshot, ParseError, VDatastoreRow, VPartitionRow
│   │   ├── vinfo.ts                      # PORT + extend (OS column)
│   │   ├── vhost.ts                      # PORT
│   │   └── index.ts                      # barrel
│   ├── __fixtures__/                     # test fixtures
│   │   └── rvtools-mib-canary.xlsx       # tiny .xlsx with known hand-computed totals
│   └── test/
│       └── setup.ts                      # PORT
├── docs/
│   └── adr/
│       ├── 0010-rvtools-mb-as-mib.md     # INHERIT verbatim from store-predict ADR-017
│       ├── 0001-client-side-only.md      # PORT from vsizer ADR-0001
│       ├── 0002-sheetjs-tarball.md       # PORT from vsizer ADR-0002
│       └── 0004-memory-only-state.md     # PORT from vsizer ADR-0004
├── scripts/
│   └── check-forbidden-deps.mjs          # NEW — CI script for PRV-03 denylist
├── .github/
│   └── workflows/
│       └── static.yml                    # PORT + tweak (base path, denylist step, xlsx pin verify)
├── biome.json                            # PORT verbatim (add noConsole error in non-test)
├── tsconfig.json                         # PORT verbatim
├── tsconfig.app.json                     # PORT verbatim
├── tsconfig.node.json                    # PORT verbatim
├── vite.config.ts                        # PORT + change base: '/vatlas/'
├── vitest.config.ts                      # PORT verbatim (engines/parser + engines/units in coverage include)
├── index.html                            # PORT + add CSP <meta>; rename favicon/title
├── osv-scanner.toml                      # PORT
└── package.json                          # NEW — see Installation above
```

### Pattern 1: Web Worker boundary with typed `postMessage` discriminated union

**What:** The parser runs in its own thread. The `File` → `ArrayBuffer` read happens on the main thread; the buffer is transferred (zero-copy) to the worker; the worker parses + validates; the worker posts back only the canonical typed `Snapshot` payload (never the SheetJS `WorkBook` object — that would defeat the memory-budget point).

**When to use:** Always, for `.xlsx` parsing. Critical-5 mandates this from day one.

**Key Vite 8 details:**

- Native ESM Worker syntax: `new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' })`. Vite handles bundling natively; no plugin needed.
- The `type: 'module'` option is **required** — without it the worker errors with "import statements outside a module".
- `tsconfig.app.json` must include `"WebWorker"` in `lib` (or use the per-file triple-slash directive `/// <reference lib="webworker" />` at the top of the worker file).
- Vite's bundler emits the worker as its own chunk; the URL is resolved relative to the importing module, so the relative path `./parser.worker.ts` is correct when the importer lives in the same directory.

**Example (Source: vite.dev/guide/features + verified against typeonce.dev pattern):**

```ts
// src/engines/parser/parseInWorker.ts  (runs on main thread)
import type { Snapshot, ParseError } from '@types/snapshot'

type ParseRequest = { kind: 'parse'; buf: ArrayBuffer; filename: string; mtime: number }
type ParseResponse =
  | { kind: 'ok'; snapshot: Omit<Snapshot, 'id' | 'parsedAt'>; warnings: ParseError[] }
  | { kind: 'err'; error: { name: string; message: string; column?: string; sheet?: string } }

let worker: Worker | null = null
const getWorker = (): Worker => {
  if (!worker) {
    worker = new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}

export const parseInWorker = (
  file: File,
): Promise<{ snapshot: Omit<Snapshot, 'id' | 'parsedAt'>; warnings: ParseError[] }> =>
  new Promise(async (resolve, reject) => {
    const w = getWorker()
    const onMessage = (e: MessageEvent<ParseResponse>) => {
      w.removeEventListener('message', onMessage)
      if (e.data.kind === 'ok') resolve({ snapshot: e.data.snapshot, warnings: e.data.warnings })
      else reject(Object.assign(new Error(e.data.error.message), e.data.error))
    }
    w.addEventListener('message', onMessage)
    const buf = await file.arrayBuffer()
    const msg: ParseRequest = { kind: 'parse', buf, filename: file.name, mtime: file.lastModified }
    w.postMessage(msg, [buf]) // transferable — buf is now neutered on the main thread
  })
```

```ts
// src/engines/parser/parser.worker.ts  (runs in worker)
/// <reference lib="webworker" />
import '../../privacy/fetchGuard' // install guard in worker too
import { parseXlsx } from './parseXlsx'
import { adaptRvtools } from './adapters/rvtools'
import { inferCaptureDate, inferVCenterLabel, inferRvtoolsVersion } from './captureDateInference'

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  if (e.data.kind !== 'parse') return
  try {
    const sheets = parseXlsx(e.data.buf, { dense: true })
    // adaptRvtools throws ParseError on missing required sheet/column with structured payload
    const adapted = adaptRvtools(sheets)
    const snapshot = {
      filename: e.data.filename,
      fileSize: e.data.buf.byteLength,
      capturedAt: inferCaptureDate(e.data.filename, e.data.mtime, sheets),
      vCenterLabel: inferVCenterLabel(adapted.vinfo, e.data.filename),
      rvtoolsVersion: inferRvtoolsVersion(sheets),
      vinfo: adapted.vinfo,
      vhost: adapted.vhost,
      vdatastore: adapted.vdatastore,
      vpartition: adapted.vpartition,
    }
    // Eagerly drop the SheetJS reference — `sheets` goes out of scope here.
    // The structured-clone of the postMessage copies the canonical rows only.
    self.postMessage({ kind: 'ok', snapshot, warnings: adapted.warnings })
  } catch (err) {
    const e2 = err as { name?: string; message?: string; column?: string; sheet?: string }
    self.postMessage({
      kind: 'err',
      error: {
        name: e2.name ?? 'ParseError',
        message: e2.message ?? 'parse failed',
        column: e2.column,
        sheet: e2.sheet,
      },
    })
  }
}
```

`[VERIFIED: vite.dev/guide/features — "Web Workers" section confirms the`new Worker(new URL(..., import.meta.url), { type: 'module' })`pattern]`

**Anti-pattern:** Calling `XLSX.read` on the main thread "for now" and saying you'll move it later. Critical-5 mandates the worker boundary from day one — retrofitting is painful because the call site changes from sync to async.

### Pattern 2: Native HTML5 drag-and-drop zone (no react-dropzone)

**What:** A `<div>` with `onDragOver`/`onDragLeave`/`onDrop` event handlers that surfaces the dropped `File[]` to a callback. Accepts only `.xlsx`. Visual state (`isDragOver: boolean`) drives a Tailwind class swap.

**When to use:** Phase 1's drop zone. Reaches FND-02 in ~40 LOC without a new dependency.

```tsx
// src/components/FileDropzone.tsx
import { useState, type DragEvent, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

const ACCEPT_EXT = /\.xlsx$/i

export const FileDropzone = ({ onFiles, disabled }: Props): JSX.Element => {
  const { t } = useTranslation(['upload'])
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files).filter((f) => ACCEPT_EXT.test(f.name))
    if (files.length > 0) onFiles(files)
  }

  const handleBrowse = (e: ChangeEvent<HTMLInputElement>): void => {
    if (disabled) return
    const files = Array.from(e.target.files ?? []).filter((f) => ACCEPT_EXT.test(f.name))
    if (files.length > 0) onFiles(files)
    e.target.value = '' // allow re-selecting the same file
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={
        `rounded-lg border-2 border-dashed p-12 text-center transition ` +
        (isDragOver
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-slate-300 dark:border-surface-700')
      }
      role="button"
      aria-label={t('upload:dropzone.instruction')}
    >
      <p>{t('upload:dropzone.instruction')}</p>
      <p className="text-sm text-slate-500">
        {t('upload:dropzone.or')}{' '}
        <label className="cursor-pointer text-primary-500 underline">
          {t('upload:dropzone.browse')}
          <input
            type="file"
            multiple
            accept=".xlsx"
            className="hidden"
            onChange={handleBrowse}
            disabled={disabled}
          />
        </label>
      </p>
      <p className="text-xs text-slate-400 mt-2">{t('upload:dropzone.accepted')}</p>
    </div>
  )
}
```

`[CITED: vsizer's`FileDropzone.tsx`follows this exact pattern (no react-dropzone dep)]`

### Pattern 3: Column alias dictionary extending vsizer's `columnMap`

**What:** A `Record<canonical, readonly string[]>` per RVTools sheet, listing every historical alias for each canonical field. The header-based resolver (`findColumn`, `mapColumns` — already in vsizer's `columnMap.ts`) walks the workbook headers and returns `string | undefined` per canonical key, never throws on missing.

**When to use:** Always, for every column read from every RVTools sheet. Never positional indexing.

**vatlas extensions to vsizer's existing `VINFO_COLS` / `VHOST_COLS`:**

```ts
// src/engines/parser/adapters/rvtools.ts (extension — additions only shown)

const VINFO_COLS = {
  // ...vsizer's keys (vmName, cluster, host, vcpu, vramMb, cpuReadinessPercent, poweredOn)...

  // NEW for vatlas — OS column (used by Phase 5 EOS forecast)
  // vInfo offers two OS columns; we read both, prefer Tools when present
  // (more granular: "Red Hat Enterprise Linux 8.10" vs "Red Hat Enterprise Linux 8 (64-bit)")
  osConfig: ['os according to the configuration file', 'os', 'guest os'],
  osTools: ['os according to the vmware tools', 'guest os full name', 'vmtools os'],

  // NEW — identity keys for Phase 4 multi-vCenter merge
  vmBiosUuid: ['vm uuid', 'bios uuid', 'uuid'],
  vmInstanceUuid: ['vm instance uuid', 'instance uuid'],
  viSdkUuid: ['vi sdk uuid', 'vcenter uuid'],
  viSdkServer: ['vi sdk server', 'vcenter server', 'vcenter'],

  // NEW — storage as MiB (named to encode the unit)
  provisionedMib: ['provisioned mb', 'provisioned (mb)', 'provisioned'],
  inUseMib: ['in use mb', 'in use (mb)', 'consumed'],
} as const

const VDATASTORE_COLS = {
  // RVTools `vDatastore` sheet
  name: ['name'],
  capacityMib: ['capacity mb', 'capacity (mb)', 'capacity'],
  freeMib: ['free mb', 'free (mb)', 'free'],
  provisionedMib: ['provisioned mb', 'provisioned (mb)'],
  naa: ['address', 'datastore url', 'url'], // NAA / UUID identity key
  type: ['type'],                            // VMFS, NFS, vSAN
} as const

const VPARTITION_COLS = {
  // RVTools `vPartition` sheet
  vmName: ['vm', 'vm name'],
  disk: ['disk'],
  capacityMib: ['capacity mb', 'capacity'],
  consumedMib: ['consumed mb', 'consumed'],
  freeMib: ['free mb', 'free'],
} as const

const VMETADATA_COLS = {
  // RVTools `vMetaData` sheet — used for RVTools version + capture date
  exportedTimestamp: ['exported timestamp', 'export time', 'snapshot date'],
  rvtoolsVersion: ['rvtools version', 'version'],
} as const
```

**Known column changes table** (from PITFALLS.md Moderate-1):

| RVTools version | Sheet | Change |
|-----------------|-------|--------|
| 4.0 | vInfo | + `Virtual machine tags`, `min Required EVC mode key`; − `Config Checksum` |
| 4.0 | vCluster | + `Cluster tags`, custom attributes, `object ID` |
| 4.0 | vHost | + Host tags in maintenance/quarantine mode |
| 3.11 | vInfo | + `Creation date`, `Primary IP Address`, `vmx Config Checksum` |
| 3.11 | vHost | + `Serial number`, `BIOS vendor` |
| 3.10 | vInfo | + latency-sensitivity, CBT, `disk.EnableUUID` |
| 3.10 | vHost | + Assigned License(s), ATS heartbeat/locking, CPU power |
| 3.7 | many | + `VM Folder` |

`[CITED: PITFALLS.md (Moderate-1) + vinfrastructure.it RVTools 4.0 release notes]`

### Pattern 4: Capture-date inference chain

**What:** A pure function `inferCaptureDate(filename: string, mtime: number, sheets: ParsedWorkbook): Date` that walks the inference order spelled out in ROADMAP.md / SUMMARY.md and returns the best date found, never throws.

**Order (locked):**

1. **Explicit user input.** Not in scope for Phase 1 (no "edit snapshot date" UI yet); Phase 6 (trends) will add it via `store.setCapturedAt(id, date)`. Phase 1 has no user-input branch — but the engine MUST accept an optional `explicit?: Date` argument so Phase 6 doesn't need to re-architect.
2. **Filename ISO date.** Match `\d{4}-\d{2}-\d{2}` anywhere in the filename. Example: `RVTools_export_all_2026-01-07_10.23.35.xlsx` → `2026-01-07T00:00:00Z`. Optional time portion (`_HH.MM.SS`) appended if matched.
3. **vSource / vMetaData sheet.** Check `vMetaData.Exported Timestamp` if the sheet exists. Parse with `new Date()` then validate `!Number.isNaN(d.getTime())`.
4. **File `lastModified` mtime.** Always present on `File`. Use `new Date(mtime)`.
5. **Ordinal index** (fallback only — Phase 1 won't ship this branch since #4 always succeeds for a real `File`). Reserved for synthetic / generated fixtures.

```ts
// src/engines/parser/captureDateInference.ts
const ISO_DATE_RE = /(\d{4})-(\d{2})-(\d{2})(?:[_T](\d{2})[.:](\d{2})[.:](\d{2}))?/

export const inferCaptureDate = (
  filename: string,
  mtime: number,
  sheets: ParsedWorkbook,
  explicit?: Date,
): Date => {
  if (explicit) return explicit
  const m = filename.match(ISO_DATE_RE)
  if (m) {
    const [, y, mo, d, h, mi, s] = m
    const iso = `${y}-${mo}-${d}T${h ?? '00'}:${mi ?? '00'}:${s ?? '00'}Z`
    const parsed = new Date(iso)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  const meta = sheets.sheets.get('vMetaData') ?? sheets.sheets.get('vmetadata')
  if (meta && meta.rows[0]) {
    const cell = meta.rows[0]['Exported Timestamp'] ?? meta.rows[0]['Export Time']
    if (cell != null) {
      const d = new Date(String(cell))
      if (!Number.isNaN(d.getTime())) return d
    }
  }
  return new Date(mtime)
}
```

`vCenterLabel` and `rvtoolsVersion` inference follow the same pattern (look in `vInfo.VI SDK Server` / `vMetaData.RVTools Version`, fall back to filename / `'unknown'`).

### Pattern 5: i18n initialization (port + trim)

**What:** Port vsizer's `src/i18n/index.ts` verbatim, then prune the namespaces to only what Phase 1 needs.

vsizer ships five namespaces: `common`, `upload`, `dashboard`, `pptx`, `validation`. Phase 1 ships only `common` and `upload` — the other three accumulate in later phases (`dashboard` → Phase 2; `pptx` → Phase 7; `validation` → can stay; `inventory`/`eos`/`dr`/`trends`/`report` → Phases 3/5/4/6/7).

```ts
// src/i18n/index.ts
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enCommon from './locales/en/common.json'
import enUpload from './locales/en/upload.json'
import frCommon from './locales/fr/common.json'
import frUpload from './locales/fr/upload.json'

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const NAMESPACES = ['common', 'upload'] as const
export const DEFAULT_NS = 'common' satisfies (typeof NAMESPACES)[number]

export const resources = {
  en: { common: enCommon, upload: enUpload },
  fr: { common: frCommon, upload: frUpload },
} as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: DEFAULT_NS,
    ns: NAMESPACES,
    interpolation: { escapeValue: false },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'vatlas-lang',   // ← renamed from 'vsizer-lang'
      caches: ['localStorage'],
    },
  })

export default i18n
```

The locale JSON files are forked from vsizer's `common.json` / `upload.json` with project-name changes (`vsizer` → `vatlas`, "RVTools / Live Optics" → "RVTools"). Strip the Live Optics / zip extraction keys (`source.liveOptics`, `errors.zipExtractFailed`).

`[CITED: vsizer/src/i18n/index.ts; vsizer/src/i18n/locales/en/{common,upload}.json]`

### Pattern 6: Theme — Tailwind v4 `@theme` + class-strategy dark + FOUC script

**What:** Identical pattern to vsizer. Port `index.css` (`@import 'tailwindcss'` + `@custom-variant dark` + `@theme` block with Midnight Executive OKLCH palette + `@layer base` / `@layer components`). Port `public/theme-init.js` with the `vsizer-theme` → `vatlas-theme` key rename. Port `useTheme.ts` with the same rename.

The theme MUST be in `<html class="dark">` form (not the modern `data-theme=` form) because every Tailwind class uses `dark:` prefix — switching strategies later would mean touching every component.

`[CITED: vsizer/src/index.css; vsizer/public/theme-init.js; vsizer/src/hooks/useTheme.ts]`

### Pattern 7: Branded units module (`engines/units/`)

**What:** TypeScript branded number types that make `MiB`, `GiB`, `MHz`, `GHz`, `Bytes`, `Cores`, `Sockets` mutually unassignable. A raw `number` cannot be passed where a `MiB` is expected, and a `MiB` cannot be passed where a `GiB` is expected. The runtime representation is a plain `number` — the brand is purely a compile-time discriminator.

**Recommended API (Claude's discretion — KISS, hand-rolled):**

```ts
// src/engines/units/types.ts
export type MiB    = number & { readonly __brand: 'MiB' }
export type GiB    = number & { readonly __brand: 'GiB' }
export type TiB    = number & { readonly __brand: 'TiB' }
export type Bytes  = number & { readonly __brand: 'Bytes' }
export type MHz    = number & { readonly __brand: 'MHz' }
export type GHz    = number & { readonly __brand: 'GHz' }
export type Cores  = number & { readonly __brand: 'Cores' }
export type Sockets = number & { readonly __brand: 'Sockets' }

// Constructors: explicit casts confined to one location each
export const mib   = (n: number): MiB    => n as MiB
export const gib   = (n: number): GiB    => n as GiB
export const tib   = (n: number): TiB    => n as TiB
export const bytes = (n: number): Bytes  => n as Bytes
export const mhz   = (n: number): MHz    => n as MHz
export const ghz   = (n: number): GHz    => n as GHz
export const cores = (n: number): Cores  => n as Cores

// src/engines/units/constants.ts
export const BYTES_PER_MIB = 1_048_576 as const
export const MIB_PER_GIB   = 1_024 as const
export const GIB_PER_TIB   = 1_024 as const
export const MHZ_PER_GHZ   = 1_000 as const

// src/engines/units/converters.ts
import { type MiB, type GiB, type TiB, type Bytes, type MHz, type GHz,
         gib, tib, bytes, ghz } from './types'
import { BYTES_PER_MIB, MIB_PER_GIB, GIB_PER_TIB, MHZ_PER_GHZ } from './constants'

export const mibToGib   = (n: MiB):   GiB   => gib(n / MIB_PER_GIB)
export const gibToTib   = (n: GiB):   TiB   => tib(n / GIB_PER_TIB)
export const mibToTib   = (n: MiB):   TiB   => tib(n / (MIB_PER_GIB * GIB_PER_TIB))
export const mibToBytes = (n: MiB):   Bytes => bytes(n * BYTES_PER_MIB)
export const mhzToGhz   = (n: MHz):   GHz   => ghz(n / MHZ_PER_GHZ)
```

**Zod 4 produces branded outputs cleanly:**

```ts
// src/engines/parser/schemas.ts (extract)
import { z } from 'zod'
import type { MiB, MHz, Cores } from '../units'

// Two ways. Pick one consistently across the codebase. RECOMMEND option A:
// Option A — schema validates a plain number, .transform() casts to brand
const MibSchema = z.number().nonnegative().transform((n) => n as MiB)
// Option B — Zod's native .brand() (the v4 syntax — see zod.dev/api)
const MibSchemaB = z.number().nonnegative().brand<'MiB'>()  // output type: number & z.$brand<'MiB'>
```

`[VERIFIED: zod.dev/api — "Branded types" section confirms`.brand<'MiB'>()` syntax in v4. The output is `number & z.$brand<'MiB'>` — slightly different from our hand-rolled `number & { readonly __brand: 'MiB' }`. Pick one shape for the whole project.]`

**Recommendation:** Hand-rolled branded types (Option A in the example above) — the Zod brand shape `z.$brand<'X'>` is a Zod-internal symbol and bleeds Zod's type identity into engine code that has no other reason to know about Zod. Hand-rolled brands keep engines completely Zod-free.

**Critical-1 enforcement:**

- Every storage/memory field name in the canonical row types carries the unit (`provisionedMib`, `vramMib`, `memoryMib`) — never bare `provisioned` / `memory` / `ram`.
- The branded type guarantees you cannot write `vramGib + provisionedMib` without an explicit converter — TypeScript rejects the addition.
- No `* 1.048576` factor anywhere. CI grep: `git grep -nE '1\.048576|1048576\.0|\b1\.05[0-9]?\b' src/` (Note: `1_048_576` for `BYTES_PER_MIB` is fine; `1.048576` is the bug.)

**The canary fixture:** `src/__fixtures__/rvtools-mib-canary.xlsx` is a tiny synthetic workbook with one `vInfo` row (1 VM, `Provisioned MB = 102400` which is exactly 100 GiB / 0.0977 TiB) and one `vHost` row, plus hand-computed expected MiB/GiB/TiB totals encoded in the test file `engines/parser/canary.test.ts`. If a contributor reintroduces `* 1.048576`, the test asserts `expectedGib === 100` and fails because the value would be `104.857600` instead.

### Pattern 8: Multi-snapshot Zustand store (DELIBERATE departure from vsizer)

**What:** A `useVatlasStore` Zustand instance holding `snapshots: Map<id, Snapshot>` (immutable, append-only), `activeSnapshotId: id | null`, and UI mirror slices (locale, theme). Actions: `addSnapshot`, `removeSnapshot`, `setActiveSnapshot`, `clearAll`. **No aggregates in the store** — they're derived in `useEstateView` (Phase 2) via `useMemo`.

**Why depart from vsizer:** vsizer's `datasetStore.ts` caches `aggregates: Record<string, ClusterAggregate>` on the store and re-aggregates inside `toggleStretched`. That works because vsizer has a single immutable dataset and one mutation axis (the stretched flag). vatlas has three independent mutation axes (selection / scenarios / stretched) plus an `asOf` axis for EOS — store-side cache invalidation across all of them is mistakes-waiting-to-happen. ARCHITECTURE.md §5 calls this out explicitly.

**Recommended slice pattern (Claude's discretion — KISS, separate slices in one `create<>()`):**

```ts
// src/store/snapshotStore.ts
import { create } from 'zustand'
import type { Snapshot } from '@types/snapshot'

interface SnapshotState {
  snapshots: Map<string, Snapshot>
  activeSnapshotId: string | null

  addSnapshot: (s: Snapshot) => void
  removeSnapshot: (id: string) => void
  setActiveSnapshot: (id: string | null) => void
  renameVCenter: (id: string, label: string) => void
  setCapturedAt: (id: string, date: Date) => void
  clearAll: () => void
}

export const useSnapshotStore = create<SnapshotState>((set) => ({
  snapshots: new Map(),
  activeSnapshotId: null,

  addSnapshot: (s) =>
    set((state) => {
      // Map must be replaced (not mutated in place) so Zustand notifies subscribers.
      const next = new Map(state.snapshots)
      next.set(s.id, s)
      return { snapshots: next, activeSnapshotId: state.activeSnapshotId ?? s.id }
    }),

  removeSnapshot: (id) =>
    set((state) => {
      if (!state.snapshots.has(id)) return {}
      const next = new Map(state.snapshots)
      next.delete(id)
      const nextActive = state.activeSnapshotId === id
        ? (next.size > 0 ? [...next.keys()][0]! : null)
        : state.activeSnapshotId
      return { snapshots: next, activeSnapshotId: nextActive }
    }),

  setActiveSnapshot: (id) => set({ activeSnapshotId: id }),

  renameVCenter: (id, label) =>
    set((state) => {
      const snap = state.snapshots.get(id)
      if (!snap) return {}
      const next = new Map(state.snapshots)
      next.set(id, { ...snap, vCenterLabel: label })
      return { snapshots: next }
    }),

  setCapturedAt: (id, date) =>
    set((state) => {
      const snap = state.snapshots.get(id)
      if (!snap) return {}
      const next = new Map(state.snapshots)
      next.set(id, { ...snap, capturedAt: date })
      return { snapshots: next }
    }),

  clearAll: () => set({ snapshots: new Map(), activeSnapshotId: null }),
}))

// Selectors with stable references (no new objects/arrays inside)
export const selectHasSnapshots = (s: SnapshotState): boolean => s.snapshots.size > 0
export const selectActiveSnapshot = (s: SnapshotState): Snapshot | null =>
  s.activeSnapshotId ? s.snapshots.get(s.activeSnapshotId) ?? null : null
```

**Key invariants encoded in the shape:**

- The `Map` is always **replaced** on mutation, never mutated in place — Zustand uses `Object.is` comparison; mutating the Map identity prevents subscribers from notifying.
- Snapshots are **frozen at insert** — `addSnapshot` is the only way new rows enter; once in, the object is read-only. Phase 6 (Trends) and Phase 4 (Stretched/DR) depend on this for `useMemo` cache hits.
- **No persistence.** No `zustand/middleware/persist`. PAR-05 means refresh wipes everything.
- **UI prefs (`locale`, `theme`) live in separate hooks** (`useTheme` + i18next's own `localStorage` cache), not in this store, so the store remains 100 % dataset and the dataset is 100 % memory-only.

`[CITED: ARCHITECTURE.md §5; zustand v5 docs at github.com/pmndrs/zustand]`

### Pattern 9: Privacy guard layer (the big invention of Phase 1)

**What:** A module imported at the **very top of `src/main.tsx`** (and the top of `parser.worker.ts`) that monkey-patches `globalThis.fetch`, `XMLHttpRequest.prototype.open`, `navigator.sendBeacon`, and `WebSocket`. Each wrapper checks whether the target URL is same-origin and **throws synchronously** if not.

**Why throw, not silently block:** A silent block is hard to detect — a developer adds a Sentry SDK, sees no network errors, ships it; only forensic analysis catches the missing payloads. Throwing is loud: the next time anything tries to call a non-same-origin URL the error boundary triggers, the user sees a banner, the developer sees a stack trace.

**Defense-in-depth on cleartext WebSockets:** vatlas's production origin is HTTPS-only (`https://fjacquet.github.io/vatlas/`). The guard MUST also refuse any WebSocket URL whose scheme is not `wss:` even when same-origin — the browser already blocks cleartext mixed content from a secure context, but the guard makes the rejection explicit and gives a clear stack trace. Only `wss:` is acceptable for WebSocket connections in vatlas. (CWE-319 mitigation.)

**Wrapper implementation (Source: MDN docs on `Navigator.sendBeacon`, `WebSocket`, `XMLHttpRequest.open`; verified the Beacon API "uses Fetch keepalive under the hood"):**

```ts
// src/privacy/fetchGuard.ts
// MUST be the first import in src/main.tsx and the first import in any Web Worker entry.

class PrivacyViolation extends Error {
  constructor(api: string, target: string) {
    super(`Privacy violation: ${api} attempted to reach non-same-origin URL ${target}`)
    this.name = 'PrivacyViolation'
  }
}

class InsecureTransportViolation extends Error {
  constructor(api: string, target: string) {
    super(`Insecure transport: ${api} attempted a cleartext connection to ${target}`)
    this.name = 'InsecureTransportViolation'
  }
}

const sameOrigin = (target: string | URL): boolean => {
  try {
    const u = typeof target === 'string' ? new URL(target, globalThis.location?.href) : target
    // In a Worker, self.location is the worker script URL; same-origin policy applies.
    const origin = globalThis.location?.origin ?? (globalThis as { origin?: string }).origin
    if (!origin) return false
    return u.origin === origin
  } catch {
    // Relative URL or malformed — treat as same-origin (no scheme/host means current doc).
    return true
  }
}

// 1. fetch
const originalFetch = globalThis.fetch
globalThis.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const target =
    typeof input === 'string' ? input :
    input instanceof URL      ? input :
    input instanceof Request  ? input.url : ''
  if (!sameOrigin(target as string | URL)) throw new PrivacyViolation('fetch', String(target))
  return originalFetch.call(this, input, init)
} as typeof fetch

// 2. XMLHttpRequest
if (typeof XMLHttpRequest !== 'undefined') {
  const origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function patchedOpen(
    method: string,
    url: string | URL,
    async?: boolean,
    user?: string | null,
    pw?: string | null,
  ): void {
    if (!sameOrigin(url)) throw new PrivacyViolation('XMLHttpRequest', String(url))
    // The XMLHttpRequest.open overload set is fiddly; using `apply` keeps every call signature.
    return origOpen.apply(this, [method, url, async ?? true, user ?? null, pw ?? null])
  } as XMLHttpRequest['open']
}

// 3. navigator.sendBeacon
if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
  const origBeacon = navigator.sendBeacon.bind(navigator)
  navigator.sendBeacon = function patchedBeacon(url: string | URL, data?: BodyInit | null): boolean {
    if (!sameOrigin(url)) throw new PrivacyViolation('sendBeacon', String(url))
    return origBeacon(url, data ?? null)
  } as Navigator['sendBeacon']
}

// 4. WebSocket — same-origin AND wss-only (CWE-319 mitigation).
//    Production origin is HTTPS, so any cleartext socket is both wrong protocol and
//    blocked by browser mixed-content rules. The guard makes the rejection explicit.
//    Vite dev HMR establishes its own socket through Vite's internal runtime, not
//    through globalThis.WebSocket app-code calls; the guard does not intercept it.
if (typeof WebSocket !== 'undefined') {
  const OriginalWebSocket = WebSocket
  const SECURE_WS_SCHEME = 'wss:' as const // CWE-319: cleartext schemes are rejected
  const isSecureUrl = (target: string | URL): boolean => {
    try {
      const u = typeof target === 'string' ? new URL(target, globalThis.location?.href) : target
      return u.protocol === SECURE_WS_SCHEME
    } catch {
      return false
    }
  }
  globalThis.WebSocket = function PatchedWebSocket(url: string | URL, protocols?: string | string[]) {
    if (!sameOrigin(url)) throw new PrivacyViolation('WebSocket', String(url))
    if (!isSecureUrl(url)) throw new InsecureTransportViolation('WebSocket', String(url))
    return new OriginalWebSocket(url, protocols)
  } as unknown as typeof WebSocket
  // Preserve static constants (CONNECTING / OPEN / CLOSING / CLOSED).
  Object.setPrototypeOf(globalThis.WebSocket, OriginalWebSocket)
  Object.assign(globalThis.WebSocket, {
    CONNECTING: OriginalWebSocket.CONNECTING,
    OPEN: OriginalWebSocket.OPEN,
    CLOSING: OriginalWebSocket.CLOSING,
    CLOSED: OriginalWebSocket.CLOSED,
  })
}
```

The WebSocket wrapper now rejects on **both** non-same-origin AND cleartext-transport. `vatlas` never opens its own WebSocket (it has no backend) — this guard is purely defensive against a future dependency that might. (CWE-319 — cleartext transmission of sensitive information.)

**HMR compatibility (dev only):** Vite's dev server runs on `localhost:5173` (or `127.0.0.1:5173`), and HMR uses a WebSocket back to the same origin. Vite's dev HMR connection is established by Vite's own runtime — not through `globalThis.WebSocket` calls in app code — so the guard does NOT intercept it. The guard only fires when **application code** calls `new WebSocket(url)`. `[ASSUMED — verified by reasoning about Vite's HMR architecture (its dev client is bundled separately); recommend the planner add a manual smoke test in Plan 2:`npm run dev`, open the app, confirm HMR works.]`

**CSP meta tag (`index.html` `<head>` — belt-and-suspenders):**

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  connect-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  font-src 'self' data:;
  img-src 'self' data:;
  worker-src 'self' blob:;
  frame-src 'none';
  base-uri 'self';
  form-action 'none';
">
```

- `'unsafe-inline'` on `script-src` is needed for the FOUC theme-init script in `<head>`. Acceptable because the HTML is the trust boundary and no third-party scripts are bundled.
- `worker-src 'self' blob:` is required for Vite's dev-mode worker bootstrap (workers are loaded as `blob:` URLs by Vite's dev server). `[ASSUMED — verify in Plan 2]`
- `connect-src 'self'` is the **principal directive** for PRV-02. Browsers block any `fetch`/XHR/WebSocket/sendBeacon to a non-same-origin URL even before our runtime guard runs, as a second line of defense.

**CI denylist of telemetry packages (`scripts/check-forbidden-deps.mjs`):**

```js
// scripts/check-forbidden-deps.mjs — run in CI before npm ci
import { readFileSync } from 'node:fs'

const FORBIDDEN_PATTERNS = [
  /^@sentry\//,
  /^posthog-/,
  /^@amplitude\//,
  /^mixpanel/,
  /^@datadog\//,
  /^logrocket/,
  /^@bugsnag\//,
  /^heap-analytics/,
  /^segment-analytics/,
  /^fullstory/,
]

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }

const offenders = Object.keys(allDeps).filter((name) =>
  FORBIDDEN_PATTERNS.some((re) => re.test(name)),
)

if (offenders.length > 0) {
  console.error('FORBIDDEN TELEMETRY PACKAGE(S) IN package.json:')
  for (const o of offenders) console.error(`  - ${o}`)
  process.exit(1)
}

// Also verify SheetJS pinning
if (allDeps.xlsx !== 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz') {
  console.error(`xlsx must be pinned to the SheetJS tarball, not ${allDeps.xlsx}`)
  process.exit(1)
}

console.log('check-forbidden-deps: OK')
```

Wire it into `static.yml` as a step before `npm ci` (so an offending package is caught before it lands). Also as a `prebuild` script in `package.json`.

**Biome additions for `biome.json` (port + extend):**

```json
{
  "linter": {
    "rules": {
      "suspicious": {
        "noConsole": { "level": "error", "options": { "allow": ["warn", "error"] } }
      }
    }
  },
  "overrides": [
    {
      "includes": ["src/**/*.test.ts", "src/**/*.test.tsx"],
      "linter": { "rules": { "suspicious": { "noConsole": "off" } } }
    }
  ]
}
```

`noConsole` as error in non-test code prevents accidental `console.log(parsedRow)` from leaking into prod (Critical-2 leak vector).

### Anti-Patterns to Avoid

- **`localStorage.setItem('snapshot:...', JSON.stringify(snapshot))`** — Breaks PAR-05. Snapshots live only in the Zustand `Map`. Only `vatlas-lang` and `vatlas-theme` may be written to `localStorage`.
- **`fetch('/api/log', { method: 'POST', body: error })` in an error boundary** — Breaks PRV-01 *if* the URL ever leaves `'self'`. Even same-origin: `FallbackError` must read only `error.message` and `error.name`; `error.cause` may carry parsed rows.
- **Cleartext WebSocket connections** — Breaks the secure-transport invariant (CWE-319). The guard rejects any non-`wss:` scheme even if same-origin. Production is HTTPS; mixed-content rules would block them anyway. Only `wss:` is acceptable.
- **Parsing on the main thread "to start with"** — Critical-5. Retrofit is painful because every call site moves from sync to async; ship the worker boundary from day one.
- **Positional column indexing (`row[3]`, `cell.B`)** — Breaks PAR-03 the moment RVTools moves a column. Always go through `findColumn` / `mapColumns`.
- **`* 1.048576` on any storage/memory value** — Breaks PAR-04. Inherit ADR-0010 and rely on branded `MiB`/`GiB` types.
- **Default-export `import create from 'zustand'`** — Deprecated since v4; warns in v5. Use `import { create } from 'zustand'`.
- **Zod v3 patterns (`z.string({ required_error: '...' })`)** — Breaks Zod 4 semantically. Use `error` parameter.
- **`import * as XLSX from 'xlsx'` inside a non-worker module** — Pulls SheetJS into the main bundle. SheetJS must be imported only from `parser.worker.ts`.
- **`new Worker(new URL('./parser.worker.ts', import.meta.url))` without `{ type: 'module' }`** — Worker errors on import statements. Always include the option.
- **Caching parsed rows in `localStorage` for "fast refresh"** — Same as the first item; forbidden.
- **Adding `service-worker.js` "for offline support"** — Critical-2 forbids it. Service workers are a privacy attack surface and offer no value for ephemeral data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| `.xlsx` parsing | Custom OOXML reader | SheetJS (`xlsx@0.20.3` CDN tarball) | OOXML is a multi-spec ZIP/XML format with vendor extensions; SheetJS handles RVTools' particular flavor of empty cells, merged headers, and locale separators. |
| Zod v4 schemas | Hand-rolled "is this a valid VInfoRow" validators | `z.object({...})` + `safeParse` | Zod gives structured errors with `path` / `code`, free type inference, and consistent `null`/`undefined`/`""` preprocessing. Hand-rolled validators always miss edge cases. |
| State management | `useReducer` + Context | Zustand 5 | Multi-snapshot store with selective subscriptions is exactly what Zustand was built for. Context re-renders the whole subtree on every change. |
| i18n key resolution + locale detection | Custom `t(key, lang)` lookup | react-i18next + i18next-browser-languagedetector | The detector chain (querystring → localStorage → navigator) is a small fortune of edge cases — pluralization, nesting, namespaces. |
| Theme management (light/dark/auto + FOUC) | DIY `localStorage` watcher | vsizer's `useTheme.ts` + `theme-init.js` script | Already shipped, FOUC-tested, three-state logic. Port verbatim with a key rename. |
| Worker message protocol | Custom RPC layer with promises | Plain `postMessage` + discriminated union | KISS. One operation (parse a workbook); no need for Comlink. |
| Unique IDs for snapshots | UUID v4 hand-roll | `crypto.randomUUID()` | Native API since 2022; zero dep. |
| Drag-and-drop in 2026 | Custom drag tracking with `dragenter`/`dragleave` counter | Native HTML5 events on the React component | ~40 LOC handles it cleanly; react-dropzone is overkill for one drop target. |
| ZIP extraction | `fflate`, `jszip` | **Don't extract anything** | vatlas v1 is RVTools `.xlsx` only — no `.zip` ingestion. fflate stays out of `package.json`. |
| Telemetry / error reporting | Sentry, PostHog, Datadog, anything | **Don't ship telemetry** | Critical-2. Even an "anonymous error reporter" silently exfiltrates `error.message` strings that may carry VM names or hostnames. |
| Number formatting | DIY `n.toFixed(2).replace('.', ',')` | `Intl.NumberFormat` | Pattern lives in `utils/format.ts` (port from vsizer in Phase 2; not needed in Phase 1 since the sidebar shows raw counts). |

**Key insight:** Phase 1 is bootstrapping infrastructure — the temptation to "just write the parser" or "just write a fetch wrapper" is high. The pitfall inventory in PITFALLS.md exists *because* prior projects took those temptations. Lean hard on existing patterns: vsizer for everything portable, well-trodden web platform APIs (`crypto.randomUUID`, `Intl.NumberFormat`, native drag-and-drop) for the rest.

## Common Pitfalls

### Pitfall 1: Critical-1 — "MB" in RVTools is MiB; do not convert

**What goes wrong:** A contributor "fixes" the unit naming by multiplying storage values by 1.048576. Every storage and memory total inflates by 4.9 %. A 100 TiB estate now claims 104.9 TiB. The error is multiplicative through aggregation.

**Why it happens:** SI vs IEC ambiguity is industry-wide; the label "MB" is wrong but ubiquitous. New contributors will "fix" it in good faith.

**How to avoid:**

- Inherit ADR-017 from store-predict verbatim into `docs/adr/0010-rvtools-mb-as-mib.md`.
- Name every storage/memory column in canonical schemas as `*Mib` / `*Gib` / `*Tib` — never bare `*Mb`. The type name carries the unit.
- Constant `BYTES_PER_MIB = 1_048_576` lives in `engines/units/constants.ts`. Forbid `1_000_000` near storage code via Biome `noRestrictedSyntax` or a CI grep.
- Add the MiB canary fixture (Pattern 7) and a test that asserts the byte-for-byte expected MiB value of the synthetic VM. If a contributor re-introduces the factor, the test fails immediately with a clear message.

**Warning signs:** Code review adds a `* 1.048576` factor; totals don't match a hand-spot from RVTools' own UI for a known small workbook; a unit test computes "expected" memory as `rows * factor * 1.048576`.

### Pitfall 2: Critical-2 — Privacy invariant leak via dependency telemetry

**What goes wrong:** A dependency — analytics SDK, Sentry, LogRocket, posthog-js, a source-map upload service, a fetch polyfill with a "phone home" first-load — exfiltrates parsed VM names / hostnames / IPs / error payloads. The product invariant ("nothing leaves the browser") is silently broken.

**How to avoid:** The enumerated mitigation table — every row of which is encoded in Pattern 9.

| Leak vector | Mitigation |
|-------------|-----------|
| Sentry / error-tracking SDK | Don't ship one. CI denylist on `@sentry/*`. |
| Analytics SDKs (GA, Plausible, posthog, Amplitude, Mixpanel) | CI denylist. Biome may add `noRestrictedImports` for further depth. |
| Source-map upload services | No upload step in `static.yml`. Sourcemaps generated only for local debug. |
| Error boundary serializing payload | `FallbackError` reads only `error.message` + `error.name`. Test: pass `Error('x', { cause: { vms } })`, assert nothing from `cause` appears in DOM. |
| `console.log` / `console.error` in prod | Biome `noConsole` as **error** in non-test files. CI fails on a console call. |
| Devtools-style debug overlays in prod | `if (import.meta.env.DEV)` gate; never `process.env.NODE_ENV`. |
| `fetch` / XHR / WebSocket / sendBeacon | Runtime guard (Pattern 9). |
| Cleartext transport (cleartext WebSocket scheme / non-HTTPS fetch) | Runtime guard rejects via `InsecureTransportViolation` (Pattern 9); production origin is HTTPS-only. |
| CSP meta tag | `connect-src 'self'` — Pattern 9. |
| Service Worker registering and POSTing | Forbidden. CI grep `navigator.serviceWorker.register`. |
| Web font from Google Fonts / CDN | Self-host; `font-src 'self' data:` in CSP. |
| `<link rel="prefetch">` to third-party | None. CI grep `<link rel="preconnect"|prefetch"` for non-self URLs. |
| Third-party iframe | `frame-src 'none'` in CSP. |
| CDN-loaded script | No CDN scripts in `index.html`. |

**Warning signs:** Network tab during `npm run preview` shows ANY outbound request after page load except the GH Pages base URL. New dependency adds `analytics` / `telemetry` keyword in `package.json`. A `Sentry.init({...})` lands. Source maps configured to upload at build time.

### Pitfall 3: Critical-5 — SheetJS parse blocks main thread on 10k+ VM workbooks

**What goes wrong:** A real estate has 15 000 VMs; the RVTools workbook is 80 MB; the user drops it; the tab freezes for 30 seconds; the user closes the tab thinking the app crashed. Heap balloons to 600 MB (SheetJS expands ~4–8× in memory); on a small machine the tab OOMs.

**How to avoid:**

- **Parse in a Web Worker from day one** (Pattern 1). Retrofit is painful.
- **Dense mode** `XLSX.read(buf, { dense: true })` — designed for the Chrome arrays-of-arrays perf regression.
- **Drop raw cells eagerly** — never keep the SheetJS `WorkBook` object alive past the worker boundary. Post canonical rows back, let SheetJS garbage-collect inside the worker.
- **Transferable `ArrayBuffer`** — `worker.postMessage(msg, [buf])` so the main thread loses ownership and the worker reads in place.
- **Per-workbook memory check** (Chrome-only, best-effort): after parse, if `performance.memory?.usedJSHeapSize > 1e9`, surface a UI warning "large estate detected".
- **Snapshot retention policy** (Phase 6 problem, not Phase 1) — when N > 4 snapshots are loaded for trends, release older raw rows.
- **A perf test** — `engines/parser/parseXlsx.perf.test.ts` that asserts a real 30 MB fixture parses in < 10 s on a desktop runner.

**Warning signs:** Performance tab shows multi-second blockage on `XLSX.read`. User reports "spinner that never moves". Heap snapshot > 500 MB after load.

### Pitfall 4: Critical-2 sub-case — Error boundary leaks `error.cause`

**What goes wrong:** `FallbackError` displays `String(error)` (which calls `toString()` which may include `cause`) or, worse, JSON.stringifies the error. If the parser threw `new Error('column missing', { cause: { partialRows: [...vms] } })`, the partial row data lands in the DOM and possibly in `console.error` output.

**How to avoid:**

```tsx
// src/components/FallbackError.tsx — port from vsizer with this exact contract
import type { FallbackProps } from 'react-error-boundary'
export const FallbackError = ({ error }: FallbackProps): JSX.Element => {
  // SAFETY: read ONLY .message and .name. NEVER .cause, .stack, or the whole error object.
  const name = error instanceof Error ? error.name : 'Error'
  const message = error instanceof Error ? error.message : 'unknown error'
  return (
    <div role="alert" className="p-6">
      <h2>{name}</h2>
      <p>{message}</p>
    </div>
  )
}
```

A test should construct `new Error('msg', { cause: { secret: 'leakedVm' } })`, render `<FallbackError error={...} />`, and assert `'leakedVm'` does NOT appear in the rendered DOM.

### Pitfall 5: Moderate-1 — RVTools column drift across versions

**What goes wrong:** vsizer was tested against RVTools 4.x. A customer exports from RVTools 3.11 and the parser fails to find `Creation date` (which doesn't exist in 3.11) or finds an extra column like `Config Checksum` (removed in 4.0) and Zod rejects the row. Or, worse, silently maps the wrong column because positional indexing was used.

**How to avoid:**

- **Column alias dictionary per canonical field** (Pattern 3). Header-based lookup, never positional.
- **Every canonical field optional in Zod at row level**; aggregation engines declare which fields they require and bail with a structured error.
- **Capture RVTools version per snapshot** (read from `vMetaData` if present, else infer from marker columns).
- **Real-fixture matrix** — one workbook per major generation (3.10, 3.11, 4.0, 4.4). At least three are reachable on disk (see Test Fixtures section); the planner must add a `npm run test:fixtures` that exercises all four.

### Pitfall 6: Minor-1 — Trailing whitespace in identifiers

**What goes wrong:** `"Cluster-Prod "` (trailing space) and `"Cluster-Prod"` parse as two distinct clusters; aggregation splits them.

**How to avoid:** Every identifier-class Zod schema uses `.trim()`: `z.string().trim().min(1)`. vsizer's `readString` helper already does this at the adapter layer; the Zod layer is a second guarantee.

### Pitfall 7: Minor-3 — NULL / empty cell handling

**What goes wrong:** RVTools writes empty cells as `""`, `null`, or absent property. `z.number()` fails. `z.coerce.number()` silently converts `""` → `0` (a documented Zod quirk), turning "missing memory data" into "0 MiB of memory".

**How to avoid:** Custom preprocessor per field:

```ts
const numberOrNull = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.coerce.number().optional(),
)
```

Missing-data fields stay `undefined`, not `0`. Aggregation in Phase 2 distinguishes "no data" from "zero" — Phase 1 just must not collapse them prematurely.

### Pitfall 8: Minor-5 — Ghost rows / RVTools-internal rows

**What goes wrong:** RVTools' "vMetaData" or summary rows at the top/bottom of some sheets look like data but aren't.

**How to avoid:** Parser skips rows where the primary identifier column is empty or matches known-internal markers (`/^Total/`, `/^Summary/`). Test fixture includes one such row.

### Pitfall 9: Vite worker base path + GitHub Pages

**What goes wrong:** Worker bundled correctly in dev but 404s in production because the dev URL is `/` while prod is `/vatlas/`. The `new URL('./parser.worker.ts', import.meta.url)` pattern resolves correctly under both — but only if `base: '/vatlas/'` is set in `vite.config.ts` and the import is relative (`./`), not absolute (`/`).

**How to avoid:** Use the relative `./parser.worker.ts` form (already in Pattern 1). Don't write `new Worker('/src/engines/parser/parser.worker.ts')` — that path doesn't survive bundling.

### Pitfall 10: i18next test-mode hydration

**What goes wrong:** Vitest tests render components that call `useTranslation()`. If `src/i18n` isn't imported in `src/test/setup.ts`, `t(key)` returns the literal key string and tests fail with "expected 'Drop your RVTools…' but got 'upload.dropzone.instruction'".

**How to avoid:** `src/test/setup.ts` ports vsizer's pattern verbatim — `import '../i18n'` runs before any test. Already in the port checklist.

### Pitfall 11: Cleartext transport on WebSocket connections (CWE-319)

**What goes wrong:** A future dependency opens a WebSocket connection using the cleartext scheme (i.e. constructing `new WebSocket(url)` where `url.protocol === 'ws:'`) to a same-origin port. On a production HTTPS deployment the browser blocks this as mixed content, but on a localhost-served preview the connection succeeds, sending any session-relevant data over cleartext. For vatlas the dataset never leaves the browser, but the secure-transport invariant is still a hard guarantee — `wss:` only.

**How to avoid:** Pattern 9's WebSocket wrapper rejects any URL whose `protocol !== 'wss:'` even when same-origin. CSP meta `connect-src 'self'` plus the HTTPS-only production origin provide defense in depth.

## Code Examples

(All examples in the Architecture Patterns section above carry working snippets verified against current docs. The big ones — Web Worker boundary, branded units, Zustand store, privacy guard, drag-and-drop — are full enough to drop into a plan as a starting point.)

### Example: ADR-0010 inheritance (verbatim from store-predict)

```markdown
# ADR-0010: RVTools "MB" Values Treated as MiB (No Conversion)

**Status:** Accepted
**Date:** 2026-05-15
**Inherited from:** store-predict ADR-017 (2026-02-19)

## Context

RVTools column headers use the label "MB" (e.g., "Provisioned MB") but the actual
values are base-2 mebibytes, not SI megabytes.

## Decision

Read RVTools storage values directly as MiB with no conversion factor applied.

## Rationale

- RVTools documentation confirms values are base-2 mebibytes despite the "MB" label.
- Cross-checking against LiveOptics exports of the same workloads produces matching
  totals without conversion.
- Applying a 1.048576 (MB-to-MiB) conversion factor would introduce a 4.9% error —
  a bug, not a fix.

## Alternatives Considered

- Apply MB-to-MiB conversion: produces systematically wrong results; a ~5% inflation
  in required capacity.

## Consequences

- Column alias dictionaries map "Provisioned MB" to `provisionedMib` with no numeric
  transformation.
- All arithmetic treats the loaded values as MiB throughout the pipeline.
- Branded TypeScript types `MiB` / `GiB` / `TiB` (in `src/engines/units/`) make
  passing an unconverted value to a `GiB`-typed parameter a compile error.
- The canary fixture `src/__fixtures__/rvtools-mib-canary.xlsx` carries a known
  hand-computed total; the parser test fails if a contributor introduces the factor.
- This decision must be revisited if a future RVTools version changes its storage units.
```

`[CITED: /Users/fjacquet/Projects/store-predict/docs/adr/017-rvtools-mb-as-mib.md]`

## Runtime State Inventory

Phase 1 is **greenfield** — there is no existing rvtui codebase to migrate. The only "runtime state" is the durable user-stored memory at `~/.claude/projects/-Users-fjacquet-Projects-rvtui/memory/` (engineering principles directive). No grep audit applies; no data migration needed; no OS-registered state.

This section is intentionally minimal — left as a stub so subsequent phases that DO involve migration (e.g., renaming the project, refactoring after Phase 2's `useEstateView` lands) can recognize the pattern and fill it in.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no prior rvtui codebase exists | — |
| Live service config | None — no external services configured | — |
| OS-registered state | None — no scheduled tasks, no installed packages besides Node/npm | — |
| Secrets / env vars | None — vatlas is 100 % client-side, has no secrets | — |
| Build artifacts | None — first build of this project | — |

**Nothing found in any category:** Verified by directory listing of `/Users/fjacquet/Projects/rvtui/` (only `.planning/`, `.claude/`, `.git/`, and `CLAUDE.md` exist — no `src/`, no `package.json`, no `dist/`, no `node_modules/`).

## Environment Availability

Phase 1 has clear external dependencies — every one must be present for execution.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite, Vitest, Biome, all dev tooling | ✓ | v26.0.0 (`node --version`) | — |
| npm | Package install | ✓ | 11.12.1 (`npm --version`) | — |
| Git | Version control, CI workflow | ✓ | 2.54.0 | — |
| SheetJS CDN (`cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) | RVTools `.xlsx` parsing | ✓ (HTTP 200 verified 2026-05-15) | 0.20.3 | None — CVE-affected npm package is forbidden. If CDN unreachable at install time, halt. |
| npm registry (registry.npmjs.org) | All other deps | ✓ assumed | — | — |
| GitHub (for CI + Pages deploy) | DEP-01/DEP-02 (Phase 7 deploy; Phase 1 just needs the workflow to land) | ✓ assumed | — | — |
| Real RVTools workbooks for fixtures | Test coverage of PAR-01..05 | ✓ — three real exports + one synthetic on disk | — | If real fixtures became unavailable, ship synthetic-only — but the synthetic vsizer sample is only 26 KB and lacks the 10k-VM-scale assertions for Critical-5. The real workbooks are MANDATORY for the perf test. |

**Real RVTools workbooks on disk** (verified 2026-05-15 via `find`):

- `/Users/fjacquet/Library/CloudStorage/OneDrive-Home/RVTools_export_all_2026-01-07_10.23.35.xlsx`
- `/Users/fjacquet/Library/CloudStorage/OneDrive-Home/JTI/RVTools_export_all_2026-04-17_16.51.38-MOM-vCenter.xlsx`
- `/Users/fjacquet/Library/CloudStorage/OneDrive-Home/live-optics/RVTools_export_all_2026-01-14_17.23.32.xlsx`
- `/Users/fjacquet/Projects/vsizer/public/samples/rvtools-sample.xlsx` (synthetic, 26 KB)
- `/Users/fjacquet/Downloads/RVTools_export_all_2026-01-07_10.23.35.xlsx` (915 KB — same date pattern as the OneDrive one; presumably the same export)

The planner's Plan-4 or Plan-5 task list should include "harvest these four real workbooks into `src/__fixtures__/` (or `public/samples/` for large ones), verify each parses, and write one Vitest case per generation asserting expected row counts and totals". The MiB canary fixture is a **fifth** synthetic workbook produced by a `scripts/generate-mib-canary.mjs` helper (small, deterministic, hand-computable).

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Test Fixtures

The fixture matrix Phase 1 must ship:

| Fixture | Source | Purpose |
|---------|--------|---------|
| `rvtools-mib-canary.xlsx` | Generated by `scripts/generate-mib-canary.mjs` | Critical-1 guard: 1 VM with `Provisioned MB = 102400` (i.e. 100 GiB). Test asserts `mibToGib(parsed.vinfo[0].provisionedMib) === gib(100)`. |
| `rvtools-3.10-sample.xlsx` | Harvested (rename of an existing real export) | PAR-03 — verify 3.10's column shape parses |
| `rvtools-3.11-sample.xlsx` | Harvested | PAR-03 — verify 3.11 |
| `rvtools-4.0-sample.xlsx` | Harvested | PAR-03 — verify 4.0 |
| `rvtools-4.4-sample.xlsx` | Harvested (the most recent real export) | PAR-03 + Critical-5 perf test target |
| `rvtools-empty.xlsx` | Generated synthetic | PAR-02 — `vInfo` sheet missing; expect structured error |
| `rvtools-missing-column.xlsx` | Generated synthetic | PAR-02 — `# CPUs` column missing; expect error naming column |

The planner should NOT commit large (>1 MB) fixtures to git directly; either git-lfs them or keep them out of `public/` and load from a `tests/fixtures/` directory with a `.gitignore` that excludes the binary blobs. A small `seed-fixtures.mjs` script can rebuild the dir from `~/Library/CloudStorage/...` on first checkout. `[ASSUMED — exact fixture strategy is Claude's discretion within the constraint "fixtures must be reproducible".]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npm install xlsx` (npm registry SheetJS) | Tarball install from `cdn.sheetjs.com` | SheetJS stopped publishing to npm registry circa 2022; npm `xlsx@0.18.5` is CVE-affected (CVE-2024-22363, CVE-2023-30533). | Pin in `package.json` as the full tarball URL; CI verifies. |
| Default Tailwind `tailwind.config.js` + PostCSS | Tailwind v4 `@theme` block in CSS + `@tailwindcss/vite` plugin | Tailwind v4 GA Jan 2025 | No JS config file; theme tokens live in `src/index.css`. |
| Zod 3 (`message`, `required_error`) | Zod 4 (`error` parameter; `.brand<...>()` native syntax) | Zod 4 GA Aug 2025 | Migration codemod available; vsizer is already on v4. |
| `import create from 'zustand'` (default) | `import { create } from 'zustand'` (named) | Deprecated v4, warns v5 | One-line change at import site. |
| Recharts / visx hand-rolled charts | Apache ECharts + `echarts-for-react` (SVG renderer) | This project's decision (STACK.md) | **Phase 2 concern**, not Phase 1. |
| Sentry / PostHog for "anonymous metrics" | None (forbidden) | This project's invariant | Critical-2 enforcement. |
| Storing parsed rows in `localStorage` for resilience | Memory only — refresh wipes | This project's invariant | ADR-0001/0004 inherited. |
| Live Optics + RVTools mixed parser (vsizer) | RVTools-only (vatlas v1) | This project's narrowing | Drop `detectSource.ts`, `adapters/liveoptics.ts`, `extractWorkbook.ts`. |
| Service worker for offline | Forbidden | Critical-2 enforcement | No `service-worker.js` anywhere. |
| Cleartext WebSocket connections | `wss:` only, runtime-enforced | This project's invariant | CWE-319 mitigation. |

**Deprecated/outdated:**

- `xlsx` from npm registry → use the CDN tarball.
- `default-export` Zustand → named import.
- Zod 3 error-message API → Zod 4 `error` param.
- PostCSS Tailwind config → `@theme` blocks in CSS.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-i18next@^17.0.8` is a safe upgrade from vsizer's `^16.6.6` for vatlas's usage (which doesn't depend on `i18next.language` during a `languageChanged` callback) | Standard Stack | LOW — if v17 has a breaking change vsizer's pattern hits, fall back to `^16.6.6` (still current and supported); cost is one line in package.json |
| A2 | The runtime privacy guard preserves Vite dev-mode HMR (which uses a same-origin WebSocket established by Vite's own runtime, not via `globalThis.WebSocket` app-code calls) | Pattern 9 | LOW — same-origin equivalence holds by definition and Vite's HMR client bypasses our wrapper; if HMR breaks, an explicit allowlist for `localhost:5173` in dev mode is a 3-line patch |
| A3 | CSP `worker-src 'self' blob:` is required for Vite's dev-mode worker bootstrap | Pattern 9 (CSP meta) | LOW — if dev worker fails to load, relaxing `worker-src` for dev (or detecting dev mode in the meta tag) is straightforward |
| A4 | Test fixture strategy of "harvest real workbooks into `tests/fixtures/` outside git" is acceptable; the alternative (git-lfs) is heavier | Test Fixtures | LOW — both work; planner can switch to git-lfs without breaking anything |
| A5 | Phase 1 only needs `common` and `upload` i18n namespaces; other namespaces accrue in later phases | Pattern 5 | LOW — adding a namespace is one entry per locale; if the planner discovers a need for a "validation" namespace in Phase 1, it's a trivial addition |
| A6 | RVTools `vMetaData` sheet, when present, has an `Exported Timestamp` column the capture-date inference can read | Pattern 4 | MEDIUM — RVTools documentation does not list `vMetaData`'s schema explicitly. Inference order falls back gracefully to filename / mtime if the sheet is absent or differently shaped; the user can still override in Phase 6. |
| A7 | The four real RVTools workbooks on disk span enough of the 3.10/3.11/4.0/4.4 version range to lock in the column-alias dictionary | Test Fixtures | MEDIUM — three are dated 2026-01 and 2026-04 (likely RVTools 4.x); a 3.10 or 3.11 may not be among them. Plan-4 should inspect each file's `vMetaData.RVTools Version` and, if 3.10/3.11 are missing, surface that as a gap for the user to provide. |
| A8 | Hand-rolled branded types (`number & { __brand: 'MiB' }`) is preferable to Zod's `.brand<>()` for engine code | Pattern 7 | LOW — both work; the rationale "keep engines Zod-free" is design taste, not correctness |
| A9 | A 30 MB workbook parses in under 10 seconds in a Web Worker on a desktop runner | Pitfall 3 / Critical-5 | MEDIUM — SUMMARY.md's order-of-magnitude estimate; will be validated in Plan-4 with the largest real fixture. If perf is worse, the mitigation is to background-parse non-active snapshots (a Phase 6 enhancement that could be pre-built in Phase 1). |
| A10 | Production deployment is HTTPS-only (GitHub Pages serves all sites over HTTPS) and there is no need to support cleartext-WebSocket fallbacks | Pattern 9 (InsecureTransportViolation) | LOW — GitHub Pages has been HTTPS-only since 2018; localhost dev runs over HTTP but the wrapper does not intercept Vite's HMR socket |

The planner should call out A6, A7, and A9 to the user before they become locked decisions — they're the assumptions most likely to need adjustment during execution.

## Open Questions

1. **i18next v16 → v17 migration risk for vatlas's specific usage.**
   - What we know: vsizer is on `react-i18next@^16.6.6`. npm shows `17.0.8` as current. v17 has small breaking changes (TypeScript module typing, `i18next.language` timing during `languageChanged` callbacks). vsizer's usage doesn't depend on the affected APIs.
   - What's unclear: whether running v17 against vsizer's `i18n/index.ts` shape compiles cleanly under TS 5.9 strict mode without `declare module` changes.
   - Recommendation: Plan-1 (Bootstrap) installs `react-i18next@^17.0.8` and runs `npm run typecheck`. If it errors with a `declare module` issue, **fall back to `^16.6.6`** (still supported, semantically identical for vsizer's pattern) and file an issue for a later upgrade. Time-box this to 15 min.

2. **ECharts 5.6 vs 6.0 for Phase 2.**
   - What we know: STACK.md pinned `echarts@^5.6.0`; `npm view echarts version` now reports `6.0.0`; the v5→v6 upgrade guide flags non-trivial changes (default theme, axis position, CanvasRenderer no longer in on-demand bundle).
   - What's unclear: which version Phase 2 should ship with. Not Phase 1's problem to solve, but Phase 1's package.json should NOT pre-install ECharts.
   - Recommendation: Phase 1 leaves ECharts out of `package.json` entirely. Phase 2 owns this decision; a research pass at that time will compare the two.

3. **Worker bundle size budget.**
   - What we know: SheetJS 0.20.3 is ~300 KB minified; the parser worker imports SheetJS + Zod schemas + adapter + units. Estimated chunk size 350–500 KB.
   - What's unclear: exact size after Rolldown tree-shaking + gzipping.
   - Recommendation: Plan-1 or Plan-4 must add a CI size-budget gate (`vite build` reports chunk sizes; gate at ≤ 700 KB raw for the worker chunk, mirroring vsizer's `chunkSizeWarningLimit: 700`).

4. **Drag-and-drop accessibility.**
   - What we know: Native HTML5 drop works with mouse and most touch devices.
   - What's unclear: keyboard-only accessibility — there's a `<label><input type="file">` browse button (keyboard-reachable); is that enough for WCAG?
   - Recommendation: Phase 1 ships browser + drop-zone with `role="button"` and `aria-label`. WCAG hard-contractual review is a future polish concern; not blocking.

5. **`<StrictMode>` in `App` and Web Workers.**
   - What we know: React 19's `<StrictMode>` double-invokes effects in dev. The drop handler is in a callback, not an effect, so it's safe. But: a `useEffect` that lazily instantiates the parser worker would create *two* workers in dev — wasteful but not broken.
   - Recommendation: Pattern 1's `getWorker()` uses module-scope memoization (not `useEffect`), so StrictMode double-invoke doesn't double-instantiate.

## Validation Architecture

> The project config sets `workflow.nyquist_validation: false` — this section is therefore **skipped per orchestration rules**. The planner doesn't need a per-requirement test map; standard Vitest coverage on `engines/parser/**` and `engines/units/**` at ≥75 % is the gate, plus the perf test on a real 30 MB fixture for Critical-5 verification.

## Security Domain

> The project config does not set `security_enforcement` explicitly. Treating as enabled. Phase 1's security domain is fully covered by the **privacy guard layer** (Pattern 9) plus the CI hygiene (denylist, SheetJS pin verification, OSV scanner — ported from vsizer's `static.yml`). No external authentication, no session management, no access control surface in Phase 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | vatlas has no accounts; nothing to authenticate against. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No authorization. |
| V5 Input Validation | **yes** | Zod 4 schemas at the parser boundary validate every row; structured errors surface missing sheets/columns. PAR-02. |
| V6 Cryptography | n/a (use built-ins) | `crypto.randomUUID()` for snapshot IDs — native, no hand-roll. No other crypto in Phase 1. |
| V9 Communications | **yes** | The privacy guard (Pattern 9) ensures NO non-same-origin communication AND no cleartext-transport sockets (CWE-319). PRV-01, PRV-02. CSP meta tag enforces same. |
| V10 Malicious Code | **yes** | CI denylist on telemetry packages (Pattern 9). OSV-Scanner inherited from vsizer's `static.yml`. SheetJS-pin verification step. |
| V14 Configuration | **yes** | `base: '/vatlas/'` correct for GH Pages; `tsconfig` strict mode; Biome `noConsole` error in non-test. |

### Known Threat Patterns for browser-only RVTools analytics

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Workbook bytes exfiltrated via fetch/XHR/WS/Beacon | Information Disclosure | Runtime guard throws on non-same-origin (Pattern 9); CSP `connect-src 'self'`; CI denylist of telemetry packages. |
| Workbook bytes exfiltrated via service worker | Information Disclosure | Service workers forbidden; CI grep blocks `navigator.serviceWorker.register`. |
| Cleartext WebSocket (CWE-319) | Information Disclosure / Tampering | Runtime guard rejects any non-`wss:` URL (Pattern 9 `InsecureTransportViolation`); production origin is HTTPS-only; mixed-content rules in browsers add a second layer. |
| Maliciously crafted `.xlsx` triggering ReDoS in SheetJS | Denial of Service | Pin SheetJS to 0.20.3+ (CVE-2024-22363 fixed in 0.20.2); CI verifies tarball URL. |
| Prototype pollution via old SheetJS (npm `xlsx@0.18.5`) | Tampering | Tarball-pin only; never `npm install xlsx`. CI grep. |
| Workbook content in error messages | Information Disclosure | `FallbackError` reads only `error.message` and `error.name`; tests assert `error.cause` content does not appear in DOM. |
| Workbook content in `console.log` | Information Disclosure | Biome `noConsole` as error in non-test files. |
| Workbook content in source-map upload | Information Disclosure | No source-map upload step in CI. Source maps generated only for local debug. |
| Sourcemap-revealed internals to public users | Information Disclosure | Production build's sourcemaps are `sourcemap: true` in vite.config.ts (per vsizer) — **flag for review**: the planner should decide whether to keep source maps in the public bundle or generate them only for a private debug build. `[ASSUMED — vsizer ships sourcemaps publicly; this is a deliberate choice for transparency. Carry over for vatlas unless user objects.]` |
| Inline-script XSS | Tampering | CSP `script-src 'self' 'unsafe-inline'` — the inline allowance is intentional for the FOUC theme-init script. No user-controlled HTML rendering, so XSS surface is minimal. |
| Maliciously crafted `data:` URI (font-src) | Tampering | Phase 1 has no `data:` font URIs; Phase 7 (HTML report export) will. |

## Project Constraints (from CLAUDE.md)

The project's `CLAUDE.md` is generated by the GSD framework and primarily mirrors PROJECT.md / STACK.md content. The actionable directives extracted:

1. **GSD workflow enforcement** — file-changing tools (`Edit`, `Write`) require a GSD command entry point (`/gsd-quick`, `/gsd-debug`, `/gsd-execute-phase`). The planner produces PLAN.md files; the executor runs them under `/gsd-execute-phase`.
2. **Privacy invariant** — "no fetch ships workbook bytes; no telemetry of parsed contents; no `localStorage` of dataset rows. Refresh = data gone." → Pattern 9 (privacy guard) + Pattern 8 (memory-only store).
3. **Engineering principles (binding)** — KISS, DRY, functional programming. Pure-function engines. No domain classes. No copy-paste between phases. → Architecture guidance throughout this research.
4. **Deploy target** — `fjacquet.github.io/vatlas/` via GH Pages; CI shape typecheck → lint → test → build → deploy. → Plan 1 ports `static.yml` with the base-path tweak.
5. **Input format** — RVTools `.xlsx` only. → Drop `detectSource.ts`, `adapters/liveoptics.ts`, `extractWorkbook.ts`, `fflate`.
6. **Charting (Phase 2, not Phase 1)** — Apache ECharts with `{ renderer: 'svg' }` mandated project-wide. → Phase 1's package.json does NOT install ECharts.

## Sources

### Primary (HIGH confidence)

- **vsizer codebase** read in full for Phase 1 planning: `/Users/fjacquet/Projects/vsizer/CLAUDE.md`, `package.json`, `biome.json`, `tsconfig.app.json`, `tsconfig.json`, `tsconfig.node.json`, `vitest.config.ts`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/i18n/index.ts`, `src/i18n/locales/en/{common,upload}.json`, `src/test/setup.ts`, `src/hooks/useTheme.ts`, `src/hooks/useDatasetUpload.ts`, `src/index.css`, `public/theme-init.js`, `src/engines/parser/parseXlsx.ts`, `src/engines/parser/adapters/rvtools.ts`, `src/engines/parser/adapters/columnMap.ts`, `src/engines/parser/schemas.ts`, `src/engines/parser/normalizeColumns.ts`, `src/engines/parser/synthesizeOrphanClusters.ts`, `src/engines/parser/resolveClusterCollisions.ts`, `src/store/datasetStore.ts`, `.github/workflows/static.yml`.
- **vatlas planning docs** read in full: `/Users/fjacquet/Projects/rvtui/CLAUDE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/config.json`, `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/SUMMARY.md`.
- `/Users/fjacquet/Projects/store-predict/docs/adr/017-rvtools-mb-as-mib.md` — verbatim source for ADR-0010.
- npm registry version verification (`npm view <pkg> version`) for: react (19.2.6), vite (8.0.13), tailwindcss (4.3.0), zod (4.4.3), zustand (5.0.13), i18next (26.2.0), react-i18next (17.0.8), i18next-browser-languagedetector (8.2.1), vitest (4.1.6), @biomejs/biome (2.4.15), pptxgenjs (4.0.1), echarts (6.0.0), echarts-for-react (3.0.6), sonner (2.0.7), react-error-boundary (6.1.1). All checked 2026-05-15.
- `curl -I https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` returned HTTP 200 on 2026-05-15.
- [vite.dev/guide/features — Web Workers](https://vite.dev/guide/features) — confirms `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` pattern.
- [zod.dev/api — Branded types](https://zod.dev/api) — confirms `.brand<'Tag'>()` syntax in Zod 4.
- [zod.dev/v4/changelog](https://zod.dev/v4/changelog) — error parameter, `.default()` semantics changes.
- [SheetJS CDN](https://cdn.sheetjs.com/) — authoritative tarball channel.
- [SheetJS issue #3098](https://git.sheetjs.com/sheetjs/sheetjs/issues/3098) — npm xlsx CVE explanation.
- [MDN: Navigator.sendBeacon](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) — Beacon API uses Fetch keepalive; same-origin behavior.
- [CWE-319: Cleartext Transmission of Sensitive Information](https://cwe.mitre.org/data/definitions/319.html) — rationale for the `wss:`-only WebSocket guard.

### Secondary (MEDIUM confidence — search results corroborated by primary docs)

- [typeonce.dev: Vite Type-Safe Web Worker in React](https://www.typeonce.dev/snippet/vite-js-type-safe-web-worker-with-react) — corroborating the `new URL(import.meta.url)` Vite pattern.
- [Tailwind CSS v4.3 release notes](https://tailwindcss.com/blog/tailwindcss-v4-3) — logical property utilities, scrollbar utilities, container queries.
- [Steve Kinney: Type Branding with Zod](https://stevekinney.com/courses/full-stack-typescript/type-branding-with-zod) — corroborating Zod 4 brand syntax.
- [react-i18next CHANGELOG](https://github.com/i18next/react-i18next/blob/master/CHANGELOG.md) — v16 → v17 migration scope.
- [Apache ECharts v6 upgrade guide](https://echarts.apache.org/handbook/en/basics/release-note/v6-upgrade-guide/) — flagged for Phase 2.

### Tertiary (LOW confidence — single-source, will validate during execution)

- A2/A3 assumptions about HMR + CSP `worker-src 'self' blob:` — not tested with a running dev server in this research. Plan-2 must validate.
- A7 assumption about RVTools-version spread among the four on-disk workbooks — must inspect `vMetaData` of each at Plan-4 time.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — every version verified against the live npm registry, all choices derived from vsizer's shipped baseline.
- Architecture: **HIGH** — direct extrapolation from vsizer + ARCHITECTURE.md, with one deliberate departure (Zustand store shape) clearly motivated.
- Privacy guard: **HIGH** — pattern is straightforward monkey-patch; alternatives (service worker, CSP-only) are documented as unsuitable. The `wss:`-only WebSocket guard adds CWE-319 mitigation.
- Branded units: **HIGH** — TS native pattern; Zod 4 syntax verified.
- Web Worker boundary: **MEDIUM-HIGH** — Vite 8's worker support is documented and stable, but the precise interaction with `tsc -b` project references in vsizer is unverified for vatlas (vsizer has no workers). A2 in the Assumptions Log.
- Pitfalls: **HIGH** — drawn from PITFALLS.md + vsizer's shipped lessons + store-predict ADR-017.

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (30 days for stable; if Phase 1 execution slips past this, re-verify the npm registry pins because Tailwind 4.3 / Vite 8.0.x / Vitest 4.1.x are all on active patch cadences).
