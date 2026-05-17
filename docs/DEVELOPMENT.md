<!-- generated-by: gsd-doc-writer -->
# Development

This guide covers the day-to-day development workflow for vatlas: the dev loop, type
checking, linting, the binding engineering principles, and the project-specific rules
that keep the privacy and correctness invariants intact.

For test commands and coverage gates see [TESTING.md](./TESTING.md). For the layered
module structure (`engines/` → `store/` → `useEstateView` → components) see
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Local setup

vatlas is a 100% client-side Vite app. There is no backend, no database, and no
environment file to provision.

1. Clone the repository:

   ```bash
   git clone https://github.com/fjacquet/vatlas.git
   cd vatlas
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

   The `xlsx` dependency resolves from the official SheetJS CDN tarball
   (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), **not** the npm registry.
   After install, confirm the pin did not drift:

   ```bash
   npm run check:supply-chain
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

   The app serves at `http://localhost:5173/vatlas/` (note the `/vatlas/` base path —
   it mirrors the GitHub Pages deploy target). Drop an RVTools `.xlsx` export into the
   browser to exercise the full pipeline.

## Build commands

All scripts are defined in `package.json`.

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with HMR at `http://localhost:5173/vatlas/`. |
| `npm run build` | Production build: `tsc -b && vite build`. The `prebuild` hook runs the supply-chain gate first. |
| `npm run preview` | Serve the production build locally for a final smoke check. |
| `npm run typecheck` | Type-check the app (`tsc --noEmit`) and the test project (`tsc --noEmit -p tsconfig.test.json`). No emit. |
| `npm run lint` | Runs `biome check .`. **Do not invoke this via npm — see Gotchas below.** |
| `npm run lint:fix` | `biome check --write .` — apply safe lint fixes. |
| `npm run format` | `biome format --write .` — reformat all files. |
| `npm run test` | `vitest` in watch mode. See [TESTING.md](./TESTING.md). |
| `npm run test:run` | `vitest run` — single CI-style pass. |
| `npm run test:coverage` | `vitest run --coverage` — `engines/` gated ≥75%. See [TESTING.md](./TESTING.md). |
| `npm run check:supply-chain` | Fails on telemetry packages or `xlsx` pin drift. Runs automatically as the `prebuild` hook. |
| `npm run check:bundle-size` | Fails if the ECharts chunk exceeds 300 KB gzipped. |

A typical inner loop is: `npm run dev` running in one terminal, with
`npm run typecheck`, the Biome check, and `npm run test:run` run before every commit.

## Code style

Linting and formatting are handled by a single tool: **Biome** (`@biomejs/biome`,
`^2.4.15`). Configuration lives in `biome.json` at the project root. There is no
ESLint and no Prettier in this project.

Key conventions enforced by `biome.json`:

- Single quotes in JS/TS, double quotes in CSS, no semicolons (`semicolons: asNeeded`).
- 2-space indentation, 100-character line width.
- `noUnusedImports` and `noUnusedVariables` are errors; `useConst` is an error;
  `noNonNullAssertion` and (in test/script files) `noConsole` are relaxed.
- Import organization runs automatically via the assist action.

Run the linter directly:

```bash
npx @biomejs/biome check .
```

Apply safe fixes and reformat:

```bash
npx @biomejs/biome check --write .
npx @biomejs/biome format --write .
```

### Binding engineering principles

These are non-negotiable for new code:

- **KISS / DRY / functional programming.** No premature abstractions, no class
  hierarchies for domain logic, no copy-paste between phases. If two phases would
  compute the same thing, the second imports from the first.
- **`src/engines/**` are pure functions** — no React, no DOM, no Zustand, no Zod.
  Zod is allowed *only* at the parser boundary. Engines are Vitest-gated ≥75%.
- **The Zustand store holds inputs only.** `src/store/snapshotStore.ts` keeps an
  immutable `Map<id, Snapshot>` and no cached aggregates (a deliberate deviation
  from the sibling vsizer project).
- **`useEstateView` is the one place `useMemo` lives.** `src/hooks/useEstateView.ts`
  is the single bridge from the store to the UI and exports. Components consume this
  hook, never the engines directly.

### Branded units (ADR-0010)

Never write a raw `* 1.048576` conversion. RVTools reports "MB" but the values are
actually MiB. Use the branded unit types (`MiB`/`GiB`/`MHz`/`GHz`/…) and their
conversion helpers so the binary-vs-decimal distinction stays in the type system.

### Internationalisation

- Every i18n key must land in **both** `en/` and `fr/` locale files. A key in one
  language without its counterpart is a bug.
- No pre-formatted numbers inside translation strings — formatting is the renderer's
  job, not the string's.
- No editorial verbs in copy ("recommend", "should", "poor", "good"). vatlas reports
  facts; the user draws conclusions.

### Privacy guard (intentional hard failure)

The app installs a privacy guard that **throws synchronously** on any non-same-origin
`fetch`, `XHR`, `WebSocket`, or `sendBeacon`. This is by design: a silent block would
be undetectable, so the guard fails loudly instead. Adding any network call that ships
data off-origin will break the app on purpose. There is no telemetry, no upload of
workbook bytes, and no `localStorage` of dataset rows — only the `vatlas-theme` and
`vatlas-lang` UI-preference keys are permitted. Refresh equals data gone; that is a
product promise, not an accident.

## Branch conventions

The default branch is `main`. Active milestone work happens on a dedicated branch
(e.g. `gsd/v1.0-milestone`). No formal branch-naming scheme is documented beyond the
milestone-branch pattern; do not work directly on `main`.

Commit messages use the prefix `<type>(NN-NN): …` where `NN-NN` is the phase-plan id,
for example:

```
feat(03-02): add datastore allocation engine
docs(06-03): complete two-mode DrSimPanel
```

Use Conventional-Commit-style types (`feat`, `fix`, `docs`, `test`, `chore`, …).

## PR process

There is no PR or issue template committed to the repository. CI enforces quality
gates: `.github/workflows/static.yml` runs typecheck → lint → test → build (and
supply-chain, audit, OSV, and bundle-size gates) on every push and PR to `main`
before deploying the static site to GitHub Pages. Run the same gates locally
before pushing:

- Run `npm run typecheck`, `npx @biomejs/biome check .`, and `npm run test:run` — all
  must pass.
- Run `npm run check:supply-chain` and `npm run check:bundle-size` if you touched
  dependencies or chart imports.
- Keep commits scoped with the `<type>(NN-NN): …` prefix tied to the phase-plan id.
- Open the PR against `main` from your milestone/feature branch.
- All file-changing work must go through a GSD command (see below) so planning
  artifacts stay in sync with the code.

### GSD workflow enforcement

Edits to this repository are expected to flow through a GSD command so planning
artifacts and execution context stay synchronised. Use the appropriate entry point:

- `/gsd-quick` — small fixes, doc updates, and ad-hoc tasks.
- `/gsd-debug` — investigation and bug fixing.
- `/gsd-execute-phase` — planned phase work.

Do not make direct repo edits outside a GSD workflow unless explicitly asked to
bypass it.

## Gotchas

- **`npm run lint` is intercepted by RTK** and prints a bogus
  `ESLint output (JSON parse failed)` message. The linter is **Biome, not ESLint**.
  Always run `npx @biomejs/biome check .` directly instead of `npm run lint`.
- **The privacy guard throws — it does not silently block.** Any non-same-origin
  network call fails synchronously. This is intentional; do not "fix" it by
  swallowing the error.
- **`xlsx` must stay pinned to the CDN tarball.** Never run `npm audit fix --force`
  or otherwise let a tool rewrite the `xlsx` resolution to the npm registry version
  (it is frozen at 0.18.5 with known CVEs). Resolve audit issues manually and let
  `npm run check:supply-chain` catch drift.
