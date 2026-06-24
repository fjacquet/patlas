<!-- generated-by: gsd-doc-writer -->
# Configuration

patlas is a 100% client-side static web app. It has **no server, no backend, no API keys, and no environment-variable runtime configuration**. The privacy invariant forbids any network call that ships report bytes, so there are no service endpoints, secrets, or `.env` files to configure.

What *is* configurable is the **build, lint, test, and supply-chain tooling**. This document covers those files, the CI quality gates, the small set of allowed browser-storage keys, and how the in-app locale is resolved.

## Environment Variables

vatlas reads **no environment variables at runtime**. There is no `.env.example`, no `.env` consumption, and no `process.env.*` access in application code. The app runs entirely in the browser with state held in memory only.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| *(none)* | — | — | The application defines and consumes no environment variables. |

The only configuration that influences behavior is **build-time** (Vite/TypeScript configs) and **in-browser preferences** (theme + locale, stored in `localStorage` — see [Browser Storage Keys](#browser-storage-keys)).

## Config File Format

All configuration lives in standard tooling config files at the project root. There are no application-level JSON/YAML config files.

### Build configuration — `vite.config.ts`

| Key | Value | Purpose |
|-----|-------|---------|
| `base` | `'/patlas/'` | Base public path for the GitHub Pages deployment (`https://fjacquet.github.io/patlas/`) |
| `plugins` | `react()`, `tailwindcss()` | React Fast Refresh/JSX + Tailwind v4 first-party Vite plugin |
| `resolve.alias` | `@`, `@engines`, `@components`, `@store`, `@types`, `@utils`, `@hooks` | Path aliases mapping to `./src/*` subdirectories |
| `build.target` | `'esnext'` | Output target |
| `build.sourcemap` | `true` | Emit source maps in the production build |
| `build.chunkSizeWarningLimit` | `700` | Raw (un-gzipped) Vite chunk-size *warning* threshold in KB (orthogonal to the hard gzipped bundle gate) |
| `build.rollupOptions.output.manualChunks` | function form | Splits vendor code into named chunks: `vendor-react`, `vendor-xlsx`, `vendor-tanstack`, `vendor-state`, `vendor-i18n` |

The named vendor chunks are not just for caching — `vendor-tanstack` exists specifically so the bundle-size gate can locate the chunk by filename after minification (see [Quality Gates](#quality-gates)).

### TypeScript configuration

`tsconfig.json` is a solution file with no compiler options of its own — it only references the two real configs:

| File | Scope | Notable settings |
|------|-------|------------------|
| `tsconfig.app.json` | Application source (`src`, excluding tests) | `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`, `noUnusedLocals/Parameters: true`, `moduleResolution: "bundler"`, target `ES2022`, libs include `WebWorker` (parser runs in a worker) |
| `tsconfig.node.json` | `vite.config.ts` only | Node types, target `es2023` |
| `tsconfig.test.json` | Test files + `tests/**` | Extends `tsconfig.app.json`; adds `node` + `vitest/globals` types |

Path aliases are declared in `tsconfig.app.json` under `compilerOptions.paths` and flow to `tsconfig.test.json` via `extends`. Vite and Vitest declare their own matching aliases independently (in `vite.config.ts` and `vitest.config.ts`).

### Lint + format configuration — `biome.json`

Biome handles both linting and formatting (there is no ESLint or Prettier).

| Setting | Value |
|---------|-------|
| Formatter indent | 2 spaces, line width 100 |
| JavaScript quotes | single |
| JavaScript semicolons | `asNeeded` |
| CSS formatter | enabled, Tailwind directives recognized |
| `correctness.noUnusedImports` / `noUnusedVariables` | `error` (downgraded to `warn` for unused imports in test files) |
| `style.useConst` | `error` |
| `style.noNonNullAssertion` | `warn` |
| `suspicious.noConsole` | `error` (allows `console.warn` / `console.error`; fully `off` for test files and `scripts/**/*.mjs`) |
| `assist.actions.source.organizeImports` | `on` (imports auto-sorted) |
| `vcs.useIgnoreFile` | `true` (respects `.gitignore`) |

> Run Biome directly as `npx @biomejs/biome check .`. The `npm run lint` script is intercepted by the RTK proxy in this environment and prints a misleading "ESLint output" message even though the linter is Biome.

### Test configuration — `vitest.config.ts`

| Setting | Value |
|---------|-------|
| `globals` | `true` |
| `environment` | `jsdom` |
| `environmentOptions.jsdom.url` | `http://localhost/` (gives tests a same-origin window so `localStorage` works) |
| `setupFiles` | `./src/test/setup.ts` |
| `include` | `src/**/*.{test,spec}.{ts,tsx}`, `tests/**/*.{test,spec}.{ts,tsx}` |
| `coverage.provider` | `v8` |
| `coverage.include` | `src/engines/**/*.ts`, `src/utils/**/*.ts`, `src/engines/units/**/*.ts`, `src/privacy/**/*.ts` |

## Required vs Optional Settings

There are **no runtime settings that cause the application to fail on startup** — the app has no startup configuration phase, no env validation, and no config loading. It boots from static assets in the browser.

The closest equivalent to "required configuration" is the set of **CI quality gates**, which fail the build/CI rather than the running app:

- **Supply-chain pin (required, hard-fail):** `dependencies.xlsx` *must* equal the exact SheetJS CDN tarball URL `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Any other value (including the CVE-affected npm `xlsx` package) fails `npm run check:supply-chain`, which also runs as the `prebuild` hook so a tainted `package.json` never builds.
- **Telemetry denylist (required, hard-fail):** no Sentry / PostHog / Amplitude / Datadog / LogRocket / Bugsnag / Heap / Segment / FullStory / Hotjar package may appear in `dependencies` or `devDependencies`. Service-worker libraries are also forbidden.
- **Bundle-size budgets (enforced post-build):** the ECharts-bearing chunk must be ≤ 300 KiB gzipped (307200 bytes); the `@tanstack` chunk must be ≤ 60 KiB gzipped (61440 bytes). Until a consumer imports those libraries into the production graph, the gate is a graceful no-op.
- **Coverage threshold (enforced on `test:coverage`):** `src/engines/**`, `src/utils/**`, `src/engines/units/**`, and `src/privacy/**` are gated at ≥ 75% for lines, functions, branches, and statements.

## Defaults

### Theme preference

Defined in `src/hooks/useTheme.ts`:

| Setting | Default | Source |
|---------|---------|--------|
| Theme preference | `'auto'` (follows OS `prefers-color-scheme`) | Returned by `readStoredPreference()` when no stored value or on `localStorage` access failure |
| Resolved theme when `auto` | `'dark'` if OS prefers dark, else `'light'` | `computeResolved()` via `matchMedia('(prefers-color-scheme: dark)')` |

When the preference is `'auto'`, the `vatlas-theme` key is *removed* from `localStorage` rather than written.

### Locale (i18n)

Defined in `src/i18n/index.ts`:

| Setting | Default | Source |
|---------|---------|--------|
| `fallbackLng` | `'fr'` | i18next init — used when the detected locale is not translated |
| `supportedLngs` | `['fr', 'en', 'de', 'it']` | `SUPPORTED_LANGUAGES` |
| `defaultNS` | `'common'` | `DEFAULT_NS` |
| Namespaces | `common`, `upload`, `dashboard`, `inventory`, `mvc`, `str`, `alloc`, `rci`, and Proxmox-native namespaces | `NAMESPACES`; JSON files under `src/i18n/locales/{en,fr,de,it}/` |
| `interpolation.escapeValue` | `false` | React already escapes interpolated values |

#### Locale resolution order

The `i18next-browser-languagedetector` `detection.order` is:

1. **Query string** — `?lang=` (`lookupQuerystring: 'lang'`)
2. **localStorage** — the `patlas-lang` key (`lookupLocalStorage: 'patlas-lang'`)
3. **navigator** — the browser's language setting
4. **fallback** — `fr` (`fallbackLng`)

The resolved locale is cached back to `localStorage` under `patlas-lang` (`caches: ['localStorage']`). A `patlas-lang` value stores only a locale code (`fr` / `en` / `de` / `it`) — it contains no dataset content and so does not breach the privacy invariant.

## Browser Storage Keys

The privacy invariant forbids persisting any parsed report row to `localStorage`, `sessionStorage`, IndexedDB, or OPFS. Refresh-equals-data-gone is a product promise. Only **two** keys are written, and both store UI preferences only:

| Key | Written by | Allowed values | Purpose |
|-----|-----------|-----------------|---------|
| `patlas-theme` | `src/hooks/useTheme.ts` | `'light'` \| `'dark'` (key is *removed* for `'auto'`) | 3-state dashboard theme preference |
| `patlas-lang` | `src/i18n/index.ts` (language detector cache) | `'fr'` \| `'en'` \| `'de'` \| `'it'` | Persisted UI locale |

No other browser-storage key is permitted. Dataset state lives only in the in-memory Zustand store and is garbage-collected on refresh.

## Per-Environment Overrides

There is **one build profile**. The app does not have development/staging/production runtime configuration because it has no runtime configuration at all.

- There are no `.env.development`, `.env.production`, or `.env.test` files, and no `NODE_ENV`-conditional config-loading code.
- The only environment-shaped difference is the **build base path**: `vite.config.ts` sets `base: '/patlas/'` so the static bundle resolves assets correctly when served from the GitHub Pages project subpath (`https://fjacquet.github.io/patlas/`).
- `npm run dev` serves the app locally under the same base path (`http://localhost:5173/patlas/`).
- Test runs override only the test environment (jsdom with an explicit `http://localhost/` origin in `vitest.config.ts`), not application configuration.

To produce an environment-specific build, change build-time config (e.g. `base` in `vite.config.ts`) and rebuild — there is no secret manager, no platform env-var injection, and no runtime feature flagging.
