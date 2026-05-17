# Phase 1: Foundation & Invariants — Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 51 vatlas files across 5 plans
**Analogs found in vsizer:** 40 / 51 (the remaining 11 are NEW with no vsizer analog and inherit patterns from RESEARCH.md §Pattern N)
**Greenfield note:** vatlas has no local codebase. Every "analog" path below is in the sibling project `/Users/fjacquet/Projects/vsizer/`. The planner should treat that tree as the codebase.

---

## File Classification

### Plan 1 — Bootstrap

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` | config | — | `/Users/fjacquet/Projects/vsizer/package.json` | exact (with deltas) |
| `vite.config.ts` | config | — | `/Users/fjacquet/Projects/vsizer/vite.config.ts` | exact (base path delta) |
| `vitest.config.ts` | config | — | `/Users/fjacquet/Projects/vsizer/vitest.config.ts` | exact (coverage include delta) |
| `tsconfig.json` | config | — | `/Users/fjacquet/Projects/vsizer/tsconfig.json` | exact (port verbatim) |
| `tsconfig.app.json` | config | — | `/Users/fjacquet/Projects/vsizer/tsconfig.app.json` | exact (port verbatim) |
| `tsconfig.node.json` | config | — | `/Users/fjacquet/Projects/vsizer/tsconfig.node.json` | exact (port verbatim) |
| `biome.json` | config | — | `/Users/fjacquet/Projects/vsizer/biome.json` | exact + `noConsole` extension |
| `index.html` | infra | — | `/Users/fjacquet/Projects/vsizer/index.html` | role-match (must add CSP meta — see Plan 2) |
| `.gitignore` | config | — | `/Users/fjacquet/Projects/vsizer/.gitignore` | exact (port verbatim) |
| `.dockerignore` | config | — | `/Users/fjacquet/Projects/vsizer/.dockerignore` | exact (port verbatim) |
| `osv-scanner.toml` | config | — | `/Users/fjacquet/Projects/vsizer/osv-scanner.toml` | exact (port verbatim) |
| `.github/workflows/static.yml` | infra | event-driven | `/Users/fjacquet/Projects/vsizer/.github/workflows/static.yml` | exact (base path + denylist step deltas) |
| `src/main.tsx` | infra | — | `/Users/fjacquet/Projects/vsizer/src/main.tsx` | exact (privacy guard import added in Plan 2) |
| `src/App.tsx` | component | request-response | `/Users/fjacquet/Projects/vsizer/src/App.tsx` | role-match (Cockpit→sidebar, EmptyState→dropzone) |
| `src/index.css` | config | — | `/Users/fjacquet/Projects/vsizer/src/index.css` | exact (port verbatim) |
| `src/i18n/index.ts` | infra | — | `/Users/fjacquet/Projects/vsizer/src/i18n/index.ts` | exact (drop 3 namespaces, rename storage key) |
| `src/i18n/locales/en/common.json` | infra | — | `/Users/fjacquet/Projects/vsizer/src/i18n/locales/en/common.json` | exact (project-name fork) |
| `src/i18n/locales/fr/common.json` | infra | — | `/Users/fjacquet/Projects/vsizer/src/i18n/locales/fr/common.json` | exact (project-name fork) |
| `src/i18n/locales/en/upload.json` | infra | — | `/Users/fjacquet/Projects/vsizer/src/i18n/locales/en/upload.json` | exact (drop liveOptics keys) |
| `src/i18n/locales/fr/upload.json` | infra | — | `/Users/fjacquet/Projects/vsizer/src/i18n/locales/fr/upload.json` | exact (drop liveOptics keys) |
| `src/hooks/useTheme.ts` | hook | event-driven | `/Users/fjacquet/Projects/vsizer/src/hooks/useTheme.ts` | exact (storage key rename) |
| `src/components/ThemeToggle.tsx` | component | event-driven | `/Users/fjacquet/Projects/vsizer/src/components/inputs/ThemeToggle.tsx` | exact (port verbatim) |
| `src/components/LanguageToggle.tsx` | component | event-driven | `/Users/fjacquet/Projects/vsizer/src/components/layout/Header.tsx` (lines 34-57 inline) | role-match (extract from Header.tsx) |
| `src/components/UploadZone.tsx` | component | event-driven | `/Users/fjacquet/Projects/vsizer/src/components/inputs/FileDropzone.tsx` | exact (extension-allowlist delta) |
| `public/theme-init.js` | infra | — | `/Users/fjacquet/Projects/vsizer/public/theme-init.js` | exact (storage key rename) |
| `src/test/setup.ts` | test | — | `/Users/fjacquet/Projects/vsizer/src/test/setup.ts` | exact (port verbatim) |

### Plan 2 — Privacy guard

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/privacy/fetchGuard.ts` | engine | runtime-monkeypatch | NEW — no vsizer analog | NEW (RESEARCH.md Pattern 9 is canonical) |
| `src/privacy/fetchGuard.test.ts` | test | — | `/Users/fjacquet/Projects/vsizer/src/test/setup.ts` (jsdom matchMedia stub shape) | partial — test patterns only |
| `index.html` (CSP meta extension) | infra | — | `/Users/fjacquet/Projects/vsizer/index.html` | role-match (vsizer has no CSP meta) |
| `src/main.tsx` (guard import wiring) | infra | — | `/Users/fjacquet/Projects/vsizer/src/main.tsx` | role-match (insert as first import) |
| `scripts/check-telemetry-denylist.mjs` | script | batch | NEW | NEW (RESEARCH.md Pattern 9 — denylist script) |
| `scripts/check-sheetjs-pin.mjs` | script | batch | NEW (combined with denylist in research) | NEW — same script may fold both checks |
| `.github/workflows/static.yml` (denylist step) | infra | event-driven | `/Users/fjacquet/Projects/vsizer/.github/workflows/static.yml` (lines 34-91 — same step shape) | role-match |
| `docs/adr/0001-privacy-invariant.md` | doc | — | vsizer ADRs (referenced in `CLAUDE.md` lines 64-79 — Nygard format) | role-match (Nygard append-only) |

### Plan 3 — Units module + ADR-0010

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engines/units/types.ts` | type | — | `/Users/fjacquet/Projects/vsizer/src/types/vinfo.ts` (interface shape) | partial — branded type style is NEW |
| `src/engines/units/constants.ts` | engine | — | NEW | NEW (RESEARCH.md Pattern 7) |
| `src/engines/units/converters.ts` | engine | transform | `/Users/fjacquet/Projects/vsizer/src/utils/format.ts` (lines 12-16 `fmtGhz` MHz→GHz pattern) | partial — same math, branded types |
| `src/engines/units/index.ts` | engine | — | `/Users/fjacquet/Projects/vsizer/src/types/index.ts` (barrel pattern) | exact (barrel re-exports) |
| `src/engines/units/*.test.ts` | test | — | `/Users/fjacquet/Projects/vsizer/src/utils/format.ts` (pure-function test shape implied) | role-match |
| `docs/adr/0010-rvtools-mb-as-mib.md` | doc | — | `/Users/fjacquet/Projects/store-predict/docs/adr/017-rvtools-mb-as-mib.md` (verbatim inherit, project name only) | exact (inherit verbatim) |
| `src/__fixtures__/rvtools-mib-canary.xlsx` | test | — | `/Users/fjacquet/Projects/vsizer/public/samples/rvtools-sample.xlsx` (synthetic .xlsx shape) | partial — generated, not committed by hand |
| `scripts/generate-mib-canary.mjs` | script | batch | `/Users/fjacquet/Projects/vsizer/scripts/generate-sample.mjs` (referenced in package.json line 19; same `node scripts/*.mjs` shape) | role-match |

### Plan 4 — Parser engine in Web Worker

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engines/parser/parseXlsx.ts` | engine | transform | `/Users/fjacquet/Projects/vsizer/src/engines/parser/parseXlsx.ts` | exact (port unchanged, add `{ dense: true }` per RESEARCH.md) |
| `src/engines/parser/parser.worker.ts` | engine | request-response | NEW | NEW (RESEARCH.md Pattern 1; imports parser pieces) |
| `src/engines/parser/parseInWorker.ts` | engine | request-response | NEW (main-thread side of worker) | NEW (RESEARCH.md Pattern 1) |
| `src/engines/parser/adapters/rvtools.ts` | engine | transform | `/Users/fjacquet/Projects/vsizer/src/engines/parser/adapters/rvtools.ts` | exact + EXTEND (add OS, vDatastore, vPartition; drop Live Optics path) |
| `src/engines/parser/adapters/columnMap.ts` | engine | transform | `/Users/fjacquet/Projects/vsizer/src/engines/parser/adapters/columnMap.ts` | exact (port unchanged) |
| `src/engines/parser/normalizeColumns.ts` | engine | transform | `/Users/fjacquet/Projects/vsizer/src/engines/parser/normalizeColumns.ts` | exact + TRIM (drop `detectSource` + `extractWorkbookBytes` + `adaptLiveOptics` branches) |
| `src/engines/parser/synthesizeOrphanClusters.ts` | engine | transform | `/Users/fjacquet/Projects/vsizer/src/engines/parser/synthesizeOrphanClusters.ts` | exact (port verbatim) |
| `src/engines/parser/schemas.ts` | engine | transform | `/Users/fjacquet/Projects/vsizer/src/engines/parser/schemas.ts` | exact + EXTEND (branded outputs, VDatastoreRow, VPartitionRow) |
| `src/engines/parser/captureDate.ts` | engine | transform | NEW | NEW (RESEARCH.md Pattern 4 — inference chain) |
| `src/engines/parser/index.ts` | engine | — | `/Users/fjacquet/Projects/vsizer/src/types/index.ts` (barrel pattern) | exact (barrel re-exports) |
| `src/types/snapshot.ts` | type | — | `/Users/fjacquet/Projects/vsizer/src/types/source.ts` + `vinfo.ts` (interface shape) | role-match (new Snapshot interface) |
| `src/types/vinfo.ts` | type | — | `/Users/fjacquet/Projects/vsizer/src/types/vinfo.ts` | exact + EXTEND (add OS columns, viSdkUuid, vmBiosUuid) |
| `src/types/vhost.ts` | type | — | `/Users/fjacquet/Projects/vsizer/src/types/vhost.ts` | exact (port verbatim, may rebrand to `memoryMib`) |
| `src/types/index.ts` | type | — | `/Users/fjacquet/Projects/vsizer/src/types/index.ts` | exact (barrel pattern) |
| `src/engines/parser/*.test.ts` | test | — | (vsizer has implied test pattern next to source) | role-match |
| `src/__fixtures__/*.xlsx` (4 real workbooks) | test | — | `/Users/fjacquet/Projects/vsizer/public/samples/rvtools-sample.xlsx` | role-match (real RVTools workbooks per RESEARCH.md A7) |

### Plan 5 — Snapshot store + sidebar UI shell

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/store/snapshotStore.ts` | store | pub-sub | `/Users/fjacquet/Projects/vsizer/src/store/datasetStore.ts` | role-match (DEVIATES: Map<id,Snapshot>, NO aggregates, append-only) |
| `src/store/snapshotStore.test.ts` | test | — | (vsizer has no store test exposed) | role-match |
| `src/hooks/useSnapshotUpload.ts` | hook | event-driven | `/Users/fjacquet/Projects/vsizer/src/hooks/useDatasetUpload.ts` | role-match (single-file → multi-file, worker boundary, no aggregation here) |
| `src/components/SnapshotListSidebar.tsx` | component | pub-sub | `/Users/fjacquet/Projects/vsizer/src/components/layout/UploadSidebar.tsx` + `sources/SourceFileList.tsx` | role-match |
| `src/components/SnapshotCard.tsx` | component | pub-sub | `/Users/fjacquet/Projects/vsizer/src/components/sources/SourceFileList.tsx` (lines 24-72 chip pattern) | role-match |
| `src/components/FallbackError.tsx` | component | request-response | `/Users/fjacquet/Projects/vsizer/src/App.tsx` (lines 15-26 inline FallbackError) | exact (extract + harden — NEVER read `error.cause`) |
| End-to-end smoke test | test | event-driven | (vsizer has no E2E smoke test in src/) | NEW (RESEARCH.md A7 — fixture-driven) |

---

## Pattern Assignments

### `package.json` (config)

**Analog:** `/Users/fjacquet/Projects/vsizer/package.json` (lines 1-52)

**Deltas vs vsizer:**

- Rename: `"name": "vsizer"` → `"name": "vatlas"`.
- Drop entirely: `fflate` (line 22), `pptxgenjs` (line 25). The CDN tarball line for `xlsx` (line 31) is KEPT verbatim.
- Drop scripts: `generate-sample` → replace with `generate-mib-canary` (Plan 3).
- Bump per RESEARCH.md §Standard Stack: `i18next ^26.2.0`, `react-i18next ^17.0.8`, `vite ^8.0.13`, `vitest ^4.1.6`, `tailwindcss ^4.3.0`.

**SheetJS pinning pattern** (lines 30-31, VERBATIM — DO NOT change):

```json
"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
```

> CI script `scripts/check-sheetjs-pin.mjs` in Plan 2 fails if this drifts.

**Scripts pattern** (lines 7-20, KEEP all except generate-sample):

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "typecheck": "tsc --noEmit",
  "lint": "biome check .",
  "lint:fix": "biome check --write .",
  "format": "biome format --write .",
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

---

### `vite.config.ts` (config)

**Analog:** `/Users/fjacquet/Projects/vsizer/vite.config.ts`

**Delta:** Line 9 `base: '/vsizer/'` → `base: '/vatlas/'`. Drop the `vendor-pptx` chunk from `manualChunks` (lines 37-38) since pptxgenjs is not in Phase 1.

**Aliases pattern** (lines 11-21, port verbatim):

```typescript
resolve: {
  alias: {
    '@': resolve(__dirname, './src'),
    '@engines': resolve(__dirname, './src/engines'),
    '@components': resolve(__dirname, './src/components'),
    '@store': resolve(__dirname, './src/store'),
    '@types': resolve(__dirname, './src/types'),
    '@utils': resolve(__dirname, './src/utils'),
    '@hooks': resolve(__dirname, './src/hooks'),
  },
},
```

**`manualChunks` function form** (lines 32-43 — KEEP function form, drop pptx):
> vsizer CLAUDE.md line 117-119 explicitly notes: "Function form keeps Rollup's discriminated union happy under `tsc -b`". DO NOT switch to object form.

---

### `vitest.config.ts` (config)

**Analog:** `/Users/fjacquet/Projects/vsizer/vitest.config.ts` (lines 1-34)

**Delta:** Adjust `coverage.include` (line 13) to add `src/engines/units/**/*.ts` and `src/privacy/**/*.ts` alongside `src/engines/**/*.ts` and `src/utils/**/*.ts`. Per ROADMAP/RESEARCH this phase gates parser + units at 75%.

**Coverage thresholds pattern** (lines 10-21, port verbatim):

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['src/engines/**/*.ts', 'src/utils/**/*.ts'],
  exclude: ['**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'],
  thresholds: { lines: 75, functions: 75, branches: 75, statements: 75 },
},
```

---

### `tsconfig.app.json` (config)

**Analog:** `/Users/fjacquet/Projects/vsizer/tsconfig.app.json` (lines 1-50)

**Delta:** Add `"WebWorker"` to `lib` (line 6 currently `["ES2022", "DOM", "DOM.Iterable"]`) so the worker file typechecks. Alternative per RESEARCH.md: per-file `/// <reference lib="webworker" />` at the top of `parser.worker.ts`. Pick one consistently.

**Strict-mode block** (lines 21-36, VERBATIM port):

```json
"strict": true,
"noImplicitAny": true,
"strictNullChecks": true,
"strictFunctionTypes": true,
"strictBindCallApply": true,
"noImplicitThis": true,
"alwaysStrict": true,
"noUncheckedIndexedAccess": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"erasableSyntaxOnly": true,
"noFallthroughCasesInSwitch": true,
"noUncheckedSideEffectImports": true,
```

---

### `biome.json` (config)

**Analog:** `/Users/fjacquet/Projects/vsizer/biome.json` (lines 1-69)

**Delta — ADD `noConsole` as error** in non-test files (Critical-2 mitigation per RESEARCH.md Pattern 9):

```json
"linter": {
  "rules": {
    "suspicious": {
      "noConsole": { "level": "error", "options": { "allow": ["warn", "error"] } }
    }
  }
},
"overrides": [
  {
    "includes": ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.mjs"],
    "linter": { "rules": { "suspicious": { "noConsole": "off" } } }
  }
]
```

**Existing override pattern** (vsizer biome.json lines 12-22, KEEP):

```json
"overrides": [
  {
    "includes": ["tests/**/*.tsx", "tests/**/*.ts", "src/**/*.test.ts", "src/**/*.test.tsx"],
    "linter": { "rules": { "correctness": { "noUnusedImports": "warn" } } }
  }
]
```

---

### `index.html` (infra)

**Analog:** `/Users/fjacquet/Projects/vsizer/index.html` (lines 1-15)

**Two deltas:**

1. Title `vsizer` → `vatlas`.
2. **ADD** CSP meta in `<head>` (Plan 2 — RESEARCH.md Pattern 9, full directive set lines 1026-1037 of RESEARCH.md).

**FOUC script port** (line 9, KEEP):

```html
<script src="/theme-init.js"></script>
```

> Both vatlas's `vite base: '/vatlas/'` and the FOUC script's same-origin path will produce `/vatlas/theme-init.js` at build time — no URL changes needed.

**Worker note:** RESEARCH.md notes `worker-src 'self' blob:` is required in CSP for Vite dev-mode worker bootstrap. The planner must include it.

---

### `src/main.tsx` (infra)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/main.tsx` (lines 1-17)

**Pattern to copy verbatim** (lines 1-7, comment included):

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// i18n must initialize before App renders so `useTranslation()` resolves
// keys synchronously on the first paint.
import './i18n'
import './index.css'
```

**Delta (Plan 2):** ADD `import './privacy/fetchGuard'` as the **FIRST** import (before `react` even), per RESEARCH.md Pattern 9. The order matters: the guard must monkey-patch globals before any other module captures references to them.

**Error-text rename** (line 10):

```typescript
if (!rootEl) throw new Error('vatlas: missing #root element in index.html')
```

---

### `src/App.tsx` (component, request-response)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/App.tsx` (lines 1-49)

**Imports pattern** (lines 1-8):

```typescript
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'sonner'
```

**ErrorBoundary + Toaster shell** (lines 34-45 — exact pattern to copy):

```tsx
return (
  <ErrorBoundary FallbackComponent={FallbackError}>
    <div className="flex min-h-screen flex-col">
      {/* Phase 1: header is just LanguageToggle + ThemeToggle. */}
      {/* Body: SnapshotListSidebar (Plan 5) + UploadZone (Plan 1). */}
    </div>
    <Toaster theme={resolved} position="bottom-right" />
  </ErrorBoundary>
)
```

**Phase 1 delta:** vsizer branches on `hasDataset` to swap `<Header>+<Cockpit>` ↔ `<EmptyState>`. vatlas Plan 1 ships only the dropzone + sidebar shell — `<Cockpit>` / `<EmptyState>` are not ported because Phase 2 owns the dashboard. The branching pattern is the same but the children differ:

```tsx
const hasSnapshots = useSnapshotStore(selectHasSnapshots)
// hasSnapshots ? <SnapshotListSidebar /> : <UploadZone variant="hero" />
```

---

### `src/index.css` (config)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/index.css` (lines 1-97)

**Port verbatim.** No deltas — the Midnight Executive palette is shared with vsizer's PPTX theme (line 7-44) and per PROJECT.md vatlas reuses the same.

**Critical lines to keep intact:**

- Line 1: `@import "tailwindcss";`
- Line 6: `@custom-variant dark (&:where(.dark, .dark *));` — class-strategy dark variant. Switching to `data-theme=` later means rewriting every component (CLAUDE.md line 142-144).
- Lines 9-44: `@theme` block — OKLCH color tokens.
- Lines 71-96: `@layer components` — `.panel`, `.label`, etc.

---

### `src/i18n/index.ts` (infra)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/i18n/index.ts` (lines 1-68)

**Three deltas (per RESEARCH.md Pattern 5):**

1. Drop 3 namespace imports: `enDashboard`, `enPptx`, `enValidation`, `frDashboard`, `frPptx`, `frValidation`. Keep only `common` + `upload`.
2. Update `NAMESPACES` (line 28): `['common', 'upload'] as const`.
3. Update storage key (line 63): `lookupLocalStorage: 'vatlas-lang'` (was `'vsizer-lang'`).

**Pattern to copy** (lines 48-67):

```typescript
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
      lookupLocalStorage: 'vatlas-lang',
      caches: ['localStorage'],
    },
  })
```

**TS migration note (RESEARCH.md):** react-i18next v17 moved module typing from `react-i18next` to `i18next`. vsizer is on v16; vatlas should ship v17 from day one. The usage pattern above does not change between v16 and v17.

---

### `src/i18n/locales/{en,fr}/common.json`, `upload.json`

**Analog:** `/Users/fjacquet/Projects/vsizer/src/i18n/locales/{en,fr}/common.json`, `upload.json`

**Deltas:**

- `common.json` line 2: `"appName": "vsizer"` → `"appName": "vatlas"`.
- `common.json` line 3 tagline: replace with "RVTools → atlas of your VMware estate (100 % client-side)" / "RVTools → atlas de votre parc VMware (100 % client)".
- `upload.json` line 3: drop "or Live Optics" — RVTools only.
- `upload.json` line 6: drop `.zip` from accepted formats.
- `upload.json` lines 14-15: drop `liveOptics` source key.
- `upload.json` line 28: drop `zipExtractFailed` key.

**ADD a `snapshots` group in `upload.json`** for SnapshotCard / SnapshotListSidebar in Plan 5:

```json
"snapshots": {
  "card": {
    "vCenterLabel": "vCenter",
    "capturedAt": "Captured",
    "rvtoolsVersion": "RVTools",
    "rows": "{{vms}} VMs · {{hosts}} ESX · {{clusters}} clusters · {{datastores}} datastores"
  },
  "empty": "No snapshots yet — drop a workbook"
}
```

---

### `src/hooks/useTheme.ts` (hook, event-driven)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/hooks/useTheme.ts` (lines 1-93)

**One delta** (line 6):

```typescript
const STORAGE_KEY = 'vatlas-theme'   // was: 'vsizer-theme'
```

**Port verbatim otherwise.** Critical patterns to preserve:

- Lines 12-20 `readStoredPreference` — `try { localStorage } catch {}` guard for Safari private mode.
- Lines 67-72 `useEffect` that applies the class + persists.
- Lines 75-85 `matchMedia` subscription for the `'auto'` branch with cleanup.

**Companion file `public/theme-init.js`** (`/Users/fjacquet/Projects/vsizer/public/theme-init.js` lines 1-16):

- Line 7: rename `'vsizer-theme'` → `'vatlas-theme'`.
- Everything else port verbatim.

---

### `src/components/ThemeToggle.tsx` (component, event-driven)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/components/inputs/ThemeToggle.tsx` (lines 1-109)

**Port verbatim.** No deltas — the i18n key `'common:theme.*'` is identical.

**Critical pattern: `<fieldset>` + `aria-pressed` segmented control** (lines 80-106):

```tsx
<fieldset
  aria-label={t('theme.label')}
  className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-xs dark:border-surface-700 dark:bg-surface-900"
>
  <legend className="sr-only">{t('theme.label')}</legend>
  {PREFERENCES.map((pref) => (
    <button
      key={pref}
      type="button"
      onClick={() => setPreference(pref)}
      aria-pressed={preference === pref}
      ...
    >
      <Glyph pref={pref} />
      <span>{t(`theme.${pref}`)}</span>
    </button>
  ))}
</fieldset>
```

---

### `src/components/LanguageToggle.tsx` (component, event-driven)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/components/layout/Header.tsx` (lines 34-57 — extract the inline `<fieldset>`)

**Extraction pattern** — vsizer inlines the language toggle into `Header.tsx`. vatlas should split it out into its own component for symmetry with `ThemeToggle.tsx`. The inline JSX to extract:

```tsx
import i18n, { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n'

const switchLanguage = (lang: SupportedLanguage): void => {
  void i18n.changeLanguage(lang)
}

export function LanguageToggle() {
  const { t, i18n: i18nApi } = useTranslation('common')
  const currentLang = i18nApi.resolvedLanguage as SupportedLanguage | undefined

  return (
    <fieldset
      aria-label={t('lang.label')}
      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-xs dark:border-surface-700 dark:bg-surface-900"
    >
      <legend className="sr-only">{t('lang.label')}</legend>
      {SUPPORTED_LANGUAGES.map((lang) => {
        const active = currentLang === lang
        return (
          <button
            key={lang}
            type="button"
            onClick={() => switchLanguage(lang)}
            className={`rounded px-2 py-1 transition-colors ${
              active
                ? 'bg-primary-100 text-primary-900 dark:bg-primary-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            aria-pressed={active}
          >
            {t(`lang.${lang}`)}
          </button>
        )
      })}
    </fieldset>
  )
}
```

---

### `src/components/UploadZone.tsx` (component, event-driven)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/components/inputs/FileDropzone.tsx` (lines 1-130)

**Pattern to copy almost verbatim.** Three deltas:

1. **Accepted extensions** (line 12) — narrow to `.xlsx` only:

```typescript
const ACCEPTED_EXTENSIONS = ['.xlsx']
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',')
```

Drop `.xlsm, .xlsb, .csv, .ods, .zip` from vsizer's list. vatlas is RVTools-`.xlsx`-only.

1. **Multi-file wiring:** `multiple` attribute (line 123) stays. The `onFiles` callback now dispatches to `useSnapshotUpload` (Plan 5), which parses each file independently in the worker and adds N snapshots to the store.

2. **Locale key:** `t('upload:dropzone.accepted')` text in `upload.json` is changed to "Accepted format: .xlsx (RVTools export). Drop one file or several at once.".

**Critical patterns to keep:**

- Lines 41-50 `accept()` callback — filter then guard against empty filtered set.
- Lines 52-60 `onDrop` — `preventDefault()`, then dispatch.
- Lines 71-80 `onKeyDown` — Enter / Space → click the hidden `<input>`. Keyboard a11y.
- Line 107 `aria-label={t('dropzone.instruction')}`.

---

### `.gitignore`, `.dockerignore`, `osv-scanner.toml` (config)

**Analogs:**

- `/Users/fjacquet/Projects/vsizer/.gitignore` (26 lines)
- `/Users/fjacquet/Projects/vsizer/.dockerignore` (32 lines)
- `/Users/fjacquet/Projects/vsizer/osv-scanner.toml` (32 lines)

**Port verbatim.** The `osv-scanner.toml` SheetJS waivers (lines 8-31) apply identically — vatlas pins the same `xlsx@0.20.3` tarball.

---

### `.github/workflows/static.yml` (infra, event-driven)

**Analog:** `/Users/fjacquet/Projects/vsizer/.github/workflows/static.yml` (lines 1-153)

**Three deltas:**

1. Line 1 comment: `vsizer` → `vatlas`.
2. **Insert two new steps** before "Type check" (line 83): the denylist check and the SheetJS pin check from Plan 2.

```yaml
- name: Check telemetry denylist
  run: node scripts/check-telemetry-denylist.mjs

- name: Check SheetJS tarball pin
  run: node scripts/check-sheetjs-pin.mjs
```

1. Vite base path `/vatlas/` is handled inside `vite.config.ts` — no workflow change needed there.

**Critical port-as-is sections:**

- Lines 22-32 — Node 24 setup with `cache: 'npm'`.
- Lines 37-91 — `npm audit` + OSV-Scanner + SARIF upload + LOW+ gate. (Strong supply-chain posture.)
- Lines 83-93 — `typecheck → lint → test → build` ladder.
- Lines 95-129 — CycloneDX SBOM generation + Release upload. The 90-day retention is the contract.

---

### `src/test/setup.ts` (test)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/test/setup.ts` (lines 1-25)

**Port verbatim.** Critical pieces:

- Line 3: `import '@testing-library/jest-dom/vitest'` — extends `expect`.
- Line 7: `import '../i18n'` — initializes i18next so `useTranslation()` returns real strings in tests (not keys).
- Lines 12-23: `window.matchMedia` stub for jsdom. `useTheme` calls `matchMedia` on mount; jsdom does not implement it. This stub is required.

---

### `src/privacy/fetchGuard.ts` (NEW — engine, runtime-monkeypatch)

**Analog:** None in vsizer. Canonical pattern is in **RESEARCH.md §Pattern 9** (lines 920-1017).

**Key invariants the implementation must encode (from RESEARCH.md):**

1. Throw `PrivacyViolation` synchronously on non-same-origin `fetch`/`XHR.open`/`sendBeacon`/`WebSocket`.
2. Throw `InsecureTransportViolation` on `WebSocket` with non-`wss:` scheme (CWE-319).
3. `sameOrigin()` helper handles `string | URL | Request`, with relative URLs treated as same-origin.
4. Preserve `WebSocket` static constants (`CONNECTING`, `OPEN`, etc.) via `Object.assign`.
5. Module is **side-effect-only on import** — no exports needed; running the file installs the guards.

**Test pattern** (`src/privacy/fetchGuard.test.ts`):

- Re-import the module fresh per test (`vi.resetModules()` + `await import('./fetchGuard')`).
- Assert `fetch('https://evil.example.com/log')` throws `PrivacyViolation` synchronously.
- Assert `fetch('/samples/foo.xlsx')` does **not** throw (same-origin relative URL).
- Assert `new WebSocket('ws://localhost/dev')` throws `InsecureTransportViolation`.
- Assert `new WebSocket('wss://example.com/foo')` throws `PrivacyViolation` (different origin).

---

### `scripts/check-telemetry-denylist.mjs`, `scripts/check-sheetjs-pin.mjs` (NEW — script, batch)

**Analog:** None directly in vsizer. Pattern reference: `/Users/fjacquet/Projects/vsizer/package.json` line 19 (`"generate-sample": "node scripts/generate-sample.mjs"`) shows the shape — Node ESM script invoked from npm script.

**Canonical implementation in RESEARCH.md lines 1047-1083** (Pattern 9):

```javascript
import { readFileSync } from 'node:fs'

const FORBIDDEN_PATTERNS = [
  /^@sentry\//, /^posthog-/, /^@amplitude\//, /^mixpanel/, /^@datadog\//,
  /^logrocket/, /^@bugsnag\//, /^heap-analytics/, /^segment-analytics/, /^fullstory/,
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

// SheetJS pin verification can fold into the same script, or split into a second.
if (allDeps.xlsx !== 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz') {
  console.error(`xlsx must be pinned to the SheetJS tarball, not ${allDeps.xlsx}`)
  process.exit(1)
}
```

> KISS recommendation: fold both checks into one script `scripts/check-supply-chain.mjs`. RESEARCH.md splits them for readability; the planner can pick.

---

### `docs/adr/0001-privacy-invariant.md`, `docs/adr/0010-rvtools-mb-as-mib.md` (doc)

**Analog:** vsizer ADRs (referenced in `CLAUDE.md` lines 64-79 by number — vsizer has ADRs 0001-0017 in `docs/adr/` though I did not enumerate them; the **format** is Nygard append-only).

**ADR-0001 (Privacy invariant):** Author fresh, but mirror the Nygard sections (Context / Decision / Consequences). vsizer's own ADR-0001 has the same title — vatlas's may inherit large portions.

**ADR-0010 (RVTools MB-as-MiB):** Per RESEARCH.md constraint — **INHERIT verbatim** from `/Users/fjacquet/Projects/store-predict/docs/adr/017-rvtools-mb-as-mib.md`. Only project-name swap is allowed.

> Note: I did not read store-predict's ADR-017 in this pass — the planner must verbatim-copy that file. Path is locked in CONTEXT.md / RESEARCH.md.

---

### `src/engines/units/types.ts`, `constants.ts`, `converters.ts`, `index.ts` (engine)

**Analog:** None in vsizer for branded types. Closest math analogs:

- `/Users/fjacquet/Projects/vsizer/src/utils/format.ts` lines 12-16 (`fmtGhz` does `mhz / 1000`)
- `/Users/fjacquet/Projects/vsizer/src/engines/aggregation/ghz.ts` (not read in this pass; same MHz→GHz primitive)
- `/Users/fjacquet/Projects/vsizer/src/types/index.ts` (barrel re-export pattern: `export type { … }`)

**Canonical implementation in RESEARCH.md lines 762-798** (Pattern 7):

```typescript
// src/engines/units/types.ts
export type MiB    = number & { readonly __brand: 'MiB' }
export type GiB    = number & { readonly __brand: 'GiB' }
export type TiB    = number & { readonly __brand: 'TiB' }
export type Bytes  = number & { readonly __brand: 'Bytes' }
export type MHz    = number & { readonly __brand: 'MHz' }
export type GHz    = number & { readonly __brand: 'GHz' }
export type Cores  = number & { readonly __brand: 'Cores' }
export type Sockets = number & { readonly __brand: 'Sockets' }

export const mib   = (n: number): MiB    => n as MiB
export const gib   = (n: number): GiB    => n as GiB
// …
```

```typescript
// src/engines/units/constants.ts
export const BYTES_PER_MIB = 1_048_576 as const
export const MIB_PER_GIB   = 1_024 as const
export const GIB_PER_TIB   = 1_024 as const
export const MHZ_PER_GHZ   = 1_000 as const
```

```typescript
// src/engines/units/converters.ts
import { type MiB, type GiB, gib /* … */ } from './types'
import { MIB_PER_GIB /* … */ } from './constants'

export const mibToGib   = (n: MiB): GiB => gib(n / MIB_PER_GIB)
export const mhzToGhz   = (n: MHz): GHz => ghz(n / MHZ_PER_GHZ)
```

**Barrel pattern** (mirroring vsizer/src/types/index.ts):

```typescript
// src/engines/units/index.ts
export * from './types'
export * from './constants'
export * from './converters'
```

**Test pattern** (`*.test.ts`):

- Round-trip tests: `mibToGib(mib(1024))` exactly equals `gib(1)`.
- Compile-time tests: `// @ts-expect-error` line where a `MiB` is passed to a function expecting `GiB`.
- Constant test: `BYTES_PER_MIB === 1_048_576` exactly (NOT `1_000_000`, NOT `1.048576`).

---

### `scripts/generate-mib-canary.mjs` (NEW — script, batch)

**Analog:** `/Users/fjacquet/Projects/vsizer/scripts/generate-sample.mjs` (referenced in vsizer package.json line 19 — not read but the shape is clear: Node ESM script that uses SheetJS to write an `.xlsx`).

**Pattern:** Synthesize a tiny `.xlsx` with hand-computed totals. The canary VM row has `Provisioned MB = 102400` which is exactly 100 GiB (per RESEARCH.md line 823). If a contributor reintroduces `* 1.048576`, the test asserts `expectedGib === 100` and fails because the value computes to `104.8576`.

Uses SheetJS `XLSX.utils.aoa_to_sheet` + `XLSX.utils.book_new` + `XLSX.writeFile` (same library already pinned in `package.json`).

---

### `src/engines/parser/parseXlsx.ts` (engine, transform)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/engines/parser/parseXlsx.ts` (lines 1-67)

**Port unchanged.** Same `ParsedSheet` / `ParsedWorkbook` interface (lines 10-19) and same `XLSX.read` → array-of-arrays → object rows transform (lines 30-66).

**One enhancement per RESEARCH.md** (line 469): use `XLSX.read(data, { type: 'array', dense: true })` for Critical-5 perf on large workbooks. The `dense: true` option is additive to vsizer's existing `{ type: 'array' }`.

---

### `src/engines/parser/parser.worker.ts` (NEW — engine, request-response)

**Analog:** None in vsizer. Canonical implementation in **RESEARCH.md §Pattern 1** (lines 459-499).

**Wire pattern:**

```typescript
/// <reference lib="webworker" />
import '../../privacy/fetchGuard'  // MUST be first; workers have their own global scope
import { parseXlsx } from './parseXlsx'
import { adaptRvtools } from './adapters/rvtools'
import { inferCaptureDate } from './captureDate'

type ParseRequest = { kind: 'parse'; buf: ArrayBuffer; filename: string; mtime: number }

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  if (e.data.kind !== 'parse') return
  try {
    const sheets = parseXlsx(e.data.buf, { dense: true })
    const adapted = adaptRvtools(sheets)
    // DROP the SheetJS WorkBook reference immediately — out of scope, GC will collect
    self.postMessage({
      kind: 'ok',
      snapshot: { filename: e.data.filename, /* canonical rows only */ },
    })
  } catch (err) {
    const e2 = err as { name?: string; message?: string; column?: string; sheet?: string }
    self.postMessage({
      kind: 'err',
      error: { name: e2.name ?? 'ParseError', message: e2.message ?? 'parse failed' },
    })
  }
}
```

**Main-thread side** (`src/engines/parser/parseInWorker.ts`, RESEARCH.md lines 425-456):

- Cache the worker (`let worker: Worker | null = null`) so multiple file drops reuse the same worker.
- Transferable buffer: `w.postMessage(msg, [buf])` — the main thread loses ownership; zero-copy.
- Promise-based wrapper resolves on `kind: 'ok'`, rejects on `kind: 'err'`.

---

### `src/engines/parser/adapters/rvtools.ts` (engine, transform)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/engines/parser/adapters/rvtools.ts` (lines 1-158)

**Port + EXTEND.** Critical patterns to KEEP from vsizer:

**Column alias dictionary shape** (lines 14-32):

```typescript
const VINFO_COLS = {
  vmName: ['vm', 'vm name', 'name', 'nom de la vm', 'vm-name'],
  cluster: ['cluster', 'grappe'],
  host: ['host', 'host name', 'hostname', 'nom hôte'],
  vcpu: ['cpus', '# cpus', 'cpu', 'vcpu', 'vcpus'],
  vramMb: ['memory', 'memory (mb)', 'mem', 'mémoire'],
  cpuReadinessPercent: ['overall cpu readiness', '% cpu readiness', 'cpu readiness'],
  poweredOn: ['powerstate', 'power state', 'état', 'status'],
} as const
```

**Pure-function row transform shape** (lines 104-124 — keep the shape, add fields):

```typescript
export const adaptRvtoolsVInfo = (sheet: ParsedSheet): VInfoRow[] => {
  const cols = mapColumns(sheet.headers, VINFO_COLS)
  return sheet.rows.map((row) => ({
    vmName: readString(readCol(row, cols.vmName)),
    cluster: readString(readCol(row, cols.cluster)),
    host: readString(readCol(row, cols.host)),
    vcpu: Math.max(0, Math.trunc(readNumber(readCol(row, cols.vcpu)))),
    vramMb: Math.max(0, readNumber(readCol(row, cols.vramMb))),
    // … etc
  }))
}
```

**Sheet-name lookup with `findSheet`** (lines 152-153 — keep the prefix-match for `RVTools_tab*` exports):

```typescript
const vinfoSheet = findSheet(workbook, ['vinfo', 'rvtools_tabvinfo'])
const vhostSheet = findSheet(workbook, ['vhost', 'rvtools_tabvhost'])
```

**Strict numeric parser pattern** (lines 80-102 — keep `parseReadinessCell` shape verbatim, reuse for any future "no reporter" column).

**EXTENSIONS for vatlas** (RESEARCH.md lines 588-633):

1. Add `osConfig` / `osTools` aliases to `VINFO_COLS` (for Phase 5 EOS).
2. Add `vmBiosUuid` / `vmInstanceUuid` / `viSdkUuid` / `viSdkServer` (identity keys for Phase 4 multi-vCenter merge — must capture in Phase 1 so Phase 4 doesn't reflow).
3. Add `provisionedMib` / `inUseMib` (storage columns — note Mib naming carries the unit).
4. New `VDATASTORE_COLS` and `VPARTITION_COLS` dictionaries with the keys from RESEARCH.md lines 610-627.
5. New `VMETADATA_COLS` (line 629-633) for RVTools version + capture-date inference (Pattern 4).
6. New `adaptRvtoolsVDatastore`, `adaptRvtoolsVPartition`, `adaptRvtoolsVMetaData` functions following the same shape as `adaptRvtoolsVInfo` / `adaptRvtoolsVHost`.

**DELETE from the analog:** `parseReadinessCell` shape is reusable, but vsizer also has a Live Optics branch inside `normalizeColumns.ts` that vatlas drops. The adapter itself does not have Live Optics code; the dispatch in `normalizeColumns.ts` does.

---

### `src/engines/parser/adapters/columnMap.ts` (engine, transform)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/engines/parser/adapters/columnMap.ts` (lines 1-94)

**Port unchanged.** Pure helpers — no project-specific knowledge.

**Critical functions to keep:**

- `findColumn` (lines 15-22) — case- and whitespace-insensitive alias resolution.
- `mapColumns` (lines 28-38) — resolves the whole alias map at once.
- `findSheet` (lines 44-54) — prefix-match for `RVTools_tab*` variants.
- `readCol`, `readNumber`, `readString`, `toRatio` (lines 62-93) — coercion helpers. `readNumber` strips locale separators (` `, `,`, `'`) and trailing `%`.

---

### `src/engines/parser/normalizeColumns.ts` (engine, transform)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/engines/parser/normalizeColumns.ts` (lines 1-83)

**Port + TRIM.** Remove three vsizer concerns:

1. `import { adaptLiveOptics } from './adapters/liveoptics'` — DROP (line 2).
2. `import { detectSource, type SourceFormat } from './detectSource'` — DROP (line 4). vatlas has a single format.
3. The branch on `source === 'rvtools' ? adaptRvtools(...) : source === 'liveoptics' ? adaptLiveOptics(...) : { vinfo: [], vhost: [] }` (lines 52-57) — collapse to `adaptRvtools(workbook)` unconditionally.

**KEEP these patterns:**

**`validate<T>` helper** (lines 24-42) — generic per-row Zod validation with structured error collection:

```typescript
const validate = <T>(rows, schema, sheet) => {
  const out: T[] = []
  const errors = []
  rows.forEach((row, index) => {
    const result = schema.safeParse(row)
    if (result.success && result.data !== undefined) out.push(result.data)
    else errors.push({ sheet, index, message: result.error?.message ?? 'invalid row' })
  })
  return { rows: out, errors }
}
```

**`synthesizeOrphanClusters` integration** (lines 64-68) — port verbatim.

**`parseDataset` one-shot helper** (lines 81-83) — port verbatim shape; vatlas may rename to `parseSnapshot` since it now also infers `capturedAt` / `vCenterLabel` / `rvtoolsVersion`.

---

### `src/engines/parser/synthesizeOrphanClusters.ts` (engine, transform)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/engines/parser/synthesizeOrphanClusters.ts` (lines 1-86)

**Port verbatim.** Standalone-host VM handling — pure, idempotent, no project-specific knowledge.

**Contract to preserve:**

- `ORPHAN_CLUSTER_PREFIX = '(no cluster) '` (line 16) — downstream consumers pattern-match on this.
- `isOrphanCluster(name)` predicate (line 26).
- Two-pass algorithm: first rewrite `vhost`, then `vinfo` (lines 65-83).

---

### `src/engines/parser/schemas.ts` (engine, transform)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/engines/parser/schemas.ts` (lines 1-119)

**Port + EXTEND.** Critical Zod 4 pattern (line 1: `import { z } from 'zod'`).

**`z.ZodType<T>` annotation pattern** (line 16):

```typescript
export const VInfoRowSchema: z.ZodType<VInfoRow> = z.object({
  vmName: z.string(),
  cluster: z.string(),
  // … etc
})
```

> The `z.ZodType<T>` annotation enforces lock-step with the canonical TS types — if a field drifts, the file stops compiling (lines 4-14 comment is the contract).

**Extensions per RESEARCH.md:**

1. Add OS columns (`osConfig`, `osTools`) to `VInfoRowSchema`.
2. Add identity keys (`vmBiosUuid`, `vmInstanceUuid`, `viSdkUuid`, `viSdkServer`).
3. Add storage columns with Mib naming (`provisionedMib`, `inUseMib`).
4. **Branded outputs** — use the hand-rolled brand from `engines/units/` (NOT Zod's `.brand<'MiB'>()` — RESEARCH.md line 816 explicitly recommends hand-rolled). Pattern (RESEARCH.md line 809):

```typescript
const MibSchema = z.number().nonnegative().transform((n) => n as MiB)
```

1. New schemas: `VDatastoreRowSchema`, `VPartitionRowSchema`, `VMetaDataRowSchema`.

**Drop ClusterAggregateSchema and GlobalSummarySchema** (lines 51-118 of vsizer) — those belong to Phase 2 aggregation, not Phase 1.

---

### `src/engines/parser/captureDate.ts` (NEW — engine, transform)

**Analog:** None in vsizer. Canonical implementation in **RESEARCH.md §Pattern 4** (lines 663-691).

**Signature & inference order (LOCKED by ROADMAP/RESEARCH):**

```typescript
export const inferCaptureDate = (
  filename: string,
  mtime: number,
  sheets: ParsedWorkbook,
  explicit?: Date,
): Date => {
  if (explicit) return explicit
  // 1. Filename ISO regex
  const m = filename.match(/(\d{4})-(\d{2})-(\d{2})(?:[_T](\d{2})[.:](\d{2})[.:](\d{2}))?/)
  if (m) { /* parse */ }
  // 2. vMetaData sheet `Exported Timestamp`
  // 3. file.lastModified mtime
  return new Date(mtime)
}
```

Companion inference helpers also live here per RESEARCH.md line 693: `inferVCenterLabel`, `inferRvtoolsVersion`.

---

### `src/types/snapshot.ts` (NEW — type)

**Analog (shape only):** `/Users/fjacquet/Projects/vsizer/src/types/source.ts` (lines 15-30) — same role as `SourceFile` in vsizer's multi-file model but a Snapshot owns the parsed rows.

**Canonical shape from ARCHITECTURE.md §4 + RESEARCH.md:**

```typescript
import type { MiB } from '../engines/units'

export interface Snapshot {
  id: string                  // crypto.randomUUID()
  filename: string
  fileSize: number            // Bytes
  capturedAt: Date            // inferred per Pattern 4
  vCenterLabel: string        // inferred; user-editable in Phase 4
  rvtoolsVersion: string      // 'unknown' | '3.10' | '3.11' | '4.0' | '4.4'
  parsedAt: Date
  source: 'rvtools'           // future-proof; only this in v1
  viSdkUuid: string | null    // captured now for Phase 4 multi-vCenter merge
  vinfo: VInfoRow[]
  vhost: VHostRow[]
  vdatastore: VDatastoreRow[]
  vpartition: VPartitionRow[]
  parseErrors: ParseError[]
}

export interface ParseError {
  sheet: string
  column?: string
  kind: 'missing-sheet' | 'missing-column' | 'invalid-row'
  message: string
  rowIndex?: number
}
```

---

### `src/types/vinfo.ts` (type)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/types/vinfo.ts` (lines 1-38)

**Port + EXTEND.** Keep the docstring style and field comments (lines 1-37 — VMware-domain comments are valuable). Add new fields per RESEARCH.md / RV column extensions:

```typescript
// Add to vsizer's VInfoRow:
osConfig: string             // RVTools `OS according to the configuration file`
osTools: string              // RVTools `OS according to the VMware Tools` — preferred over osConfig
vmBiosUuid: string           // BIOS UUID — identity key for Phase 4
vmInstanceUuid: string       // Instance UUID — secondary identity
viSdkUuid: string            // vCenter UUID — required for Phase 4 dedupe
viSdkServer: string          // vCenter server FQDN
provisionedMib: MiB          // branded; NOT bare number
inUseMib: MiB                // branded
```

Note: `vramMb` in vsizer should be renamed `vramMib: MiB` in vatlas — the brand carries the unit.

---

### `src/types/vhost.ts` (type)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/types/vhost.ts` (lines 1-22)

**Port verbatim except for branding.** Add brands per the units module:

```typescript
cores: Cores
speedMhz: MHz
memoryMib: MiB   // was memoryMb in vsizer; rename to encode the unit
```

---

### `src/types/index.ts` (type)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/types/index.ts` (lines 1-6)

**Port pattern.** Re-export the new and ported types:

```typescript
export type { Snapshot, ParseError } from './snapshot'
export type { VInfoRow } from './vinfo'
export type { VHostRow } from './vhost'
export type { VDatastoreRow, VPartitionRow, VMetaDataRow } from './snapshot' // or split files
```

Drop vsizer's `ClusterAggregate`, `GlobalSummary`, `SourceFile` re-exports (Phase 2 will reintroduce the first two; `SourceFile` is replaced by `Snapshot`).

---

### `src/store/snapshotStore.ts` (NEW — store, pub-sub) — DEVIATES from vsizer

**Analog (structure):** `/Users/fjacquet/Projects/vsizer/src/store/datasetStore.ts` (lines 1-170) — same Zustand 5 `create<>()` shape, same `import { create } from 'zustand'` named import (NOT default), same selector + `useStore` pattern.

**Key DEVIATIONS from vsizer (per ARCHITECTURE.md §5 + RESEARCH.md Pattern 8):**

| vsizer pattern | vatlas pattern | Why |
|----------------|----------------|-----|
| `vinfo: VInfoRow[]` + `vhost: VHostRow[]` on the store | `snapshots: Map<string, Snapshot>` | Multi-snapshot model; each Snapshot owns its rows. |
| `aggregates: Record<string, ClusterAggregate>` cached on the store | **NO aggregates on the store.** Computed in `useEstateView` (Phase 2) via `useMemo`. | DR sim + EOS + trends have too many invalidation axes; cache-in-store is mistakes-waiting-to-happen. |
| `toggleStretched` atomically re-aggregates (lines 121-150) | No re-aggregation action. Mutations only set `snapshots: Map`. | Aggregation is a derivation, not a store concern. |
| Single source (`source: SourceFormat`) | Snapshot field, not store field | Each snapshot may be from a different RVTools version (but always `source: 'rvtools'` in v1). |
| `parseErrors` flat array on store | `parseErrors: ParseError[]` lives **inside each Snapshot** | Errors are per-workbook; aggregating them across snapshots loses provenance. |

**Imports pattern** (lines 1-6 of vsizer — port shape, change targets):

```typescript
import { create } from 'zustand'
import type { Snapshot } from '../types/snapshot'
```

**State shape (canonical from RESEARCH.md Pattern 8 lines 838-848):**

```typescript
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
```

**Mutation pattern — Map is always REPLACED, never mutated** (RESEARCH.md lines 854-871 — Zustand uses `Object.is`):

```typescript
addSnapshot: (s) =>
  set((state) => {
    const next = new Map(state.snapshots)
    next.set(s.id, s)
    return { snapshots: next, activeSnapshotId: state.activeSnapshotId ?? s.id }
  }),
```

> Compare with vsizer's pattern (lines 111-117) for `selectedClusters: new Set<string>` — same "replace, never mutate" rule.

**Selector pattern** (port from vsizer lines 164-169):

```typescript
export const selectHasSnapshots = (s: SnapshotState): boolean => s.snapshots.size > 0
export const selectActiveSnapshot = (s: SnapshotState): Snapshot | null =>
  s.activeSnapshotId ? s.snapshots.get(s.activeSnapshotId) ?? null : null
```

> KEEP vsizer's caveat (lines 156-162): "Don't compute new arrays/objects inside a selector — Zustand uses strict equality and an unstable reference triggers an infinite re-render loop."

**No persistence.** No `zustand/middleware/persist` import. Refresh = data gone (PAR-05).

---

### `src/hooks/useSnapshotUpload.ts` (NEW — hook, event-driven)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/hooks/useDatasetUpload.ts` (lines 1-138)

**Role-match.** Port the orchestration shape but redirect to the worker boundary:

**KEEP from vsizer:**

- `useState<boolean>(false)` for `isUploading` (line 34).
- `try { … } finally { setIsUploading(false) }` (lines 39-131).
- Per-file iteration: `for (const file of files) { … }` (line 50).
- `toast.error(t('upload:errors.parseFailed', { message: msg }))` pattern (lines 85-87).
- `if (files.length === 0) return` early-out (line 37).

**REPLACE with worker boundary:**

vsizer does (lines 50-66):

```typescript
const buffer = await file.arrayBuffer()
const workbookBytes = extractWorkbookBytes(buffer, file.name)  // DROP — Live Optics zip
const parsed = parseDataset(workbookBytes)                      // MAIN THREAD — replace
```

vatlas does:

```typescript
import { parseInWorker } from '../engines/parser/parseInWorker'

const snapshot = await parseInWorker(file)  // WORKER — async, transferable
store.addSnapshot({ id: crypto.randomUUID(), parsedAt: new Date(), ...snapshot })
```

**DROP from vsizer:**

- `extractWorkbookBytes` import (line 6) — Live Optics zip helper.
- `resolveClusterCollisions` (lines 8-11) — Phase 4 concern.
- `aggregateClusters` + `aggregateGlobals` calls (lines 4-5, 96-107) — Phase 2 concern.
- `setMergedDataset` action — vatlas has `addSnapshot` per file, no merged-rows write.

**KEEP the sonner toast pattern for errors** (vsizer lines 78-89):

```typescript
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  toast.error(t('upload:errors.parseFailed', { message: msg }), { description: file.name })
}
```

---

### `src/components/SnapshotListSidebar.tsx`, `SnapshotCard.tsx` (NEW — component, pub-sub)

**Analogs:**

- `/Users/fjacquet/Projects/vsizer/src/components/layout/UploadSidebar.tsx` (lines 1-56) — sidebar layout shape.
- `/Users/fjacquet/Projects/vsizer/src/components/sources/SourceFileList.tsx` (lines 1-71) — per-file chip pattern.

**SnapshotListSidebar pattern (extracted from UploadSidebar lines 33-55):**

```tsx
export function SnapshotListSidebar() {
  const { t } = useTranslation('upload')
  const snapshots = useSnapshotStore((s) => s.snapshots)
  const activeId = useSnapshotStore((s) => s.activeSnapshotId)
  const setActive = useSnapshotStore((s) => s.setActiveSnapshot)
  const list = useMemo(() => [...snapshots.values()].sort((a, b) =>
    a.capturedAt.getTime() - b.capturedAt.getTime()), [snapshots])

  return (
    <aside className="flex flex-col gap-4 lg:w-80 lg:shrink-0" aria-label={t('snapshots.list')}>
      <UploadZone onFiles={…} variant="compact" />
      {list.length === 0 ? (
        <p className="text-xs text-slate-500">{t('snapshots.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((s) => (
            <SnapshotCard key={s.id} snapshot={s} active={s.id === activeId} onClick={() => setActive(s.id)} />
          ))}
        </ul>
      )}
    </aside>
  )
}
```

**SnapshotCard pattern (adapted from SourceFileList lines 28-43):**

```tsx
export interface SnapshotCardProps {
  snapshot: Snapshot
  active: boolean
  onClick: () => void
}

export function SnapshotCard({ snapshot, active, onClick }: SnapshotCardProps) {
  const { t } = useTranslation('upload')
  return (
    <li className={`panel cursor-pointer text-xs ${active ? 'ring-2 ring-accent-500' : ''}`} onClick={onClick}>
      <p className="break-all font-semibold text-slate-700 dark:text-slate-200">{snapshot.filename}</p>
      <p className="text-slate-500">
        {t('snapshots.card.vCenterLabel')}: {snapshot.vCenterLabel} ·
        {t('snapshots.card.capturedAt')}: {snapshot.capturedAt.toLocaleDateString()} ·
        {t('snapshots.card.rvtoolsVersion')}: {snapshot.rvtoolsVersion}
      </p>
      <p className="text-slate-500">
        {t('snapshots.card.rows', {
          vms: snapshot.vinfo.length,
          hosts: snapshot.vhost.length,
          clusters: new Set(snapshot.vinfo.map((v) => v.cluster)).size,
          datastores: snapshot.vdatastore.length,
        })}
      </p>
    </li>
  )
}
```

**Theme-aware classes:** every `bg-X` / `text-X` / `border-X` MUST have a `dark:` counterpart (per CLAUDE.md line 142-144 — class-strategy theme).

---

### `src/components/FallbackError.tsx` (NEW from inline — component, request-response)

**Analog:** `/Users/fjacquet/Projects/vsizer/src/App.tsx` lines 15-26 (inline `FallbackError` function)

**Extract + harden.** Pattern:

```tsx
import type { FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'

export function FallbackError({ error }: FallbackProps) {
  const { t } = useTranslation('common')
  // CRITICAL: read ONLY message and name; NEVER `.cause` (Critical-2 leak vector — RESEARCH.md Pitfall 4)
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="m-8 rounded-lg border border-util-high/40 bg-white p-6 dark:bg-surface-800">
      <h2 className="mb-2 text-lg font-semibold text-util-high">{t('error.title')}</h2>
      <pre className="overflow-auto whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
        {message}
      </pre>
    </div>
  )
}
```

**Test pattern** (per RESEARCH.md Pitfall 4 / Critical-2):

- Pass `new Error('x', { cause: { vms: [{ name: 'sensitive-vm' }] } })`.
- Assert the DOM contains `'x'` but does NOT contain `'sensitive-vm'`.

---

## Shared Patterns

### Privacy invariant enforcement

**Source:** New `src/privacy/fetchGuard.ts` + `index.html` CSP meta + Biome `noConsole` + `scripts/check-telemetry-denylist.mjs` + `osv-scanner.toml` (port from vsizer)

**Apply to:** Every entry point (`src/main.tsx`, `src/engines/parser/parser.worker.ts`). Every error boundary (`src/components/FallbackError.tsx`). Every Zustand store action that writes to `localStorage` (none allowed for dataset rows; `vatlas-lang` + `vatlas-theme` only).

**Belt-and-suspenders triple:**

1. Runtime: monkey-patched globals throw synchronously (RESEARCH.md Pattern 9).
2. Browser-enforced: CSP `connect-src 'self'` meta in `index.html`.
3. Supply chain: CI denylist + npm audit + OSV-Scanner (vsizer workflow lines 37-91).

### Class-strategy dark theme

**Source:** `/Users/fjacquet/Projects/vsizer/src/index.css` line 6 + `public/theme-init.js` + `hooks/useTheme.ts`

**Apply to:** EVERY new component. Every Tailwind class with a color must have a `dark:` variant.

Example (UploadSidebar.tsx line 60-61):

```tsx
className="bg-white dark:bg-surface-900 border-slate-200 dark:border-surface-700 text-slate-700 dark:text-slate-200"
```

### i18n via `useTranslation()`

**Source:** `/Users/fjacquet/Projects/vsizer/src/components/inputs/FileDropzone.tsx` line 34 (`const { t } = useTranslation('upload')`)

**Apply to:** Every component that displays user-facing text. Add keys to BOTH `locales/en/<ns>.json` AND `locales/fr/<ns>.json` (per vsizer CLAUDE.md line 89-92 — silent fallthrough is the failure mode).

Only `common` and `upload` namespaces in Phase 1. New namespaces (`dashboard`, `inventory`, `eos`, `dr`, `trends`, `report`) accumulate later phases.

### Zustand `Map`/`Set` mutation rule

**Source:** `/Users/fjacquet/Projects/vsizer/src/store/datasetStore.ts` lines 111-117 (`toggleCluster`)

**Apply to:** `src/store/snapshotStore.ts`. Every mutation creates a NEW `Map` / `Set`:

```typescript
set((state) => {
  const next = new Map(state.snapshots)
  next.set(s.id, s)
  return { snapshots: next }
})
```

Zustand uses `Object.is`; mutating identity in place prevents subscriber notifications.

### Path aliases & strict TS

**Source:** `/Users/fjacquet/Projects/vsizer/tsconfig.app.json` lines 39-47 + `/Users/fjacquet/Projects/vsizer/vite.config.ts` lines 11-21 + `vsizer/CLAUDE.md` lines 128-132

**Apply to:** EVERY import. Use `@engines/parser/parseXlsx`, `@store/snapshotStore`, `@hooks/useTheme`, `@types/snapshot`. Path aliases are duplicated in `tsconfig.app.json` AND `vite.config.ts` AND `vitest.config.ts` — keep all three in sync.

**Type imports:** `import type { Snapshot } from '@types/snapshot'` (verbatimModuleSyntax requires explicit `import type`).

### Pure-function engines, no React, no DOM

**Source:** ARCHITECTURE.md §1 + `/Users/fjacquet/Projects/vsizer/src/engines/parser/*.ts` (none import React)

**Apply to:** Everything under `src/engines/`. The parser worker is also pure JS — the only DOM-adjacent surface in the worker is the `self.onmessage` handler at the boundary.

Vitest coverage gate (75% lines/functions/branches/statements) applies to `src/engines/**` only — UI components and hooks are explicitly excluded (vsizer vitest.config.ts lines 13-21).

### SheetJS imports — worker only

**Source:** RESEARCH.md Pitfall 2 (lines 1119) + `/Users/fjacquet/Projects/vsizer/src/engines/parser/parseXlsx.ts` line 1

**Apply to:** `import * as XLSX from 'xlsx'` is allowed ONLY in `src/engines/parser/parser.worker.ts`. Importing it in any main-thread module pulls SheetJS into the main bundle and balloons bundle size. The `parseInWorker.ts` (main-thread side) MUST NOT `import 'xlsx'`.

---

## No Analog Found

Files that have no vsizer match — planner falls back to RESEARCH.md patterns:

| File | Role | Data Flow | Reason | RESEARCH.md reference |
|------|------|-----------|--------|----------------------|
| `src/privacy/fetchGuard.ts` | engine | runtime-monkeypatch | vsizer has no privacy guard layer | Pattern 9 (lines 920-1017) |
| `src/privacy/fetchGuard.test.ts` | test | — | New module, new tests | Pattern 9 test guidance |
| `scripts/check-telemetry-denylist.mjs` | script | batch | New supply-chain gate | Pattern 9 (lines 1047-1083) |
| `scripts/check-sheetjs-pin.mjs` | script | batch | New supply-chain gate (may fold into above) | Pattern 9 (lines 1077-1080) |
| `src/engines/units/types.ts` | type | — | vsizer has no branded units | Pattern 7 (lines 762-782) |
| `src/engines/units/constants.ts` | engine | — | vsizer has no `BYTES_PER_MIB` constant module | Pattern 7 (lines 782-786) |
| `src/engines/units/converters.ts` | engine | transform | vsizer has format helpers (`utils/format.ts`) but no branded converters | Pattern 7 (lines 789-797) |
| `src/engines/parser/parser.worker.ts` | engine | request-response | vsizer parses on main thread | Pattern 1 (lines 459-499) |
| `src/engines/parser/parseInWorker.ts` | engine | request-response | vsizer parses on main thread | Pattern 1 (lines 425-456) |
| `src/engines/parser/captureDate.ts` | engine | transform | vsizer has no capture-date concept | Pattern 4 (lines 663-691) |
| `docs/adr/0001-privacy-invariant.md` | doc | — | vsizer has its own ADR-0001 (Nygard format) | Reference vsizer CLAUDE.md ADR list |
| `docs/adr/0010-rvtools-mb-as-mib.md` | doc | — | **Inherit verbatim** from store-predict ADR-017 | RESEARCH.md constraint |
| `src/__fixtures__/rvtools-mib-canary.xlsx` | test | — | Synthetic canary, generated by script | RESEARCH.md line 823 (canary specification) |
| `scripts/generate-mib-canary.mjs` | script | batch | New script | (analog: vsizer scripts/generate-sample.mjs referenced in package.json line 19) |
| `src/__fixtures__/*.xlsx` (4 real RVTools workbooks) | test | — | Real harvests from disk per RESEARCH.md A7 | RESEARCH.md (Test Fixtures § / A7) |
| End-to-end smoke test (Plan 5) | test | event-driven | New | None — first integration test in vatlas |

---

## Greenfield Reminders for the Planner

1. **There is no vatlas codebase yet.** Every "Port" line above means: read the file at `/Users/fjacquet/Projects/vsizer/...`, copy its content to the corresponding `/Users/fjacquet/Projects/rvtui/...` path, and apply the deltas listed.

2. **Sibling-repo drift is real.** vsizer is on `react-i18next ^16.6.6` but RESEARCH.md mandates `^17.0.8` for vatlas. Always trust RESEARCH.md's pinned versions over vsizer's package.json.

3. **`/Users/fjacquet/Projects/store-predict/docs/adr/017-rvtools-mb-as-mib.md`** is the verbatim source for ADR-0010. I did not read it in this pass; the planner must read it before creating Plan 3's ADR file.

4. **Test fixtures named in spawn message but not yet copied:**
   - `~/Library/CloudStorage/OneDrive-Home/RVTools_export_all_2026-01-07_10.23.35.xlsx`
   - `~/Library/CloudStorage/OneDrive-Home/JTI/RVTools_export_all_2026-04-17_16.51.38-MOM-vCenter.xlsx`
   - `~/Library/CloudStorage/OneDrive-Home/live-optics/RVTools_export_all_2026-01-14_17.23.32.xlsx`
   - `/Users/fjacquet/Projects/vsizer/public/samples/rvtools-sample.xlsx`
   Plan 4 must copy these into `src/__fixtures__/`.

5. **Container & Dockerfile.** vsizer ships `Dockerfile`, `docker/`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`. **Phase 1 does NOT need these** per the file list — the planner should NOT propose them unless a later phase requires them. (Note for ROADMAP: container support is currently out of scope for vatlas v1.)

---

## Metadata

**Analog search scope:** `/Users/fjacquet/Projects/vsizer/` (src/, public/, .github/, root configs)
**Files scanned:** 35 vsizer source files read in full or in part
**Pattern extraction date:** 2026-05-15
**Confidence:** HIGH — the codebase analog is the same author's own project, on the same stack, with the deltas explicitly enumerated in PROJECT.md and RESEARCH.md.
