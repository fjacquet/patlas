<!-- generated-by: gsd-doc-writer -->
# Getting Started

You cloned `vatlas`. This page gets you from a fresh checkout to a running dev server in three commands. It is intentionally short — for the end-user workflow see [USER-GUIDE.md](./USER-GUIDE.md), for the day-to-day dev loop see [DEVELOPMENT.md](./DEVELOPMENT.md), and for the design see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Prerequisites

- **Node.js** — Vite 8 (the bundler this project pins via `vite@^8.0.13`) requires `Node.js >= 20.19` or `>= 22.12`. <!-- VERIFY: exact Node minimum — repo has no engines field or .nvmrc; range derived from the pinned Vite 8 toolchain -->
- **npm** — ships with Node; used for dependency install and all project scripts.

The repository does not pin a Node version (`package.json` has no `engines` field and there is no `.nvmrc` / `.node-version`). Any current LTS Node that satisfies the Vite 8 minimum works.

## Installation steps

```bash
git clone https://github.com/fjacquet/vatlas.git
cd vatlas
npm install
```

That is the complete install. A few notes:

- **Do not run `npm install xlsx`.** The SheetJS dependency is deliberately pinned to the official CDN tarball (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) in `package.json`'s `dependencies`. The npm `xlsx` package is frozen at a CVE-affected version and is *not* the same code. `npm install` with no arguments resolves the pinned tarball correctly.
- `npm install` also installs the supply-chain guard. The `prebuild` script (`scripts/check-supply-chain.mjs`) fails the build if the `xlsx` pin drifts or telemetry packages appear — no action needed during setup, just be aware it exists.

## First run

```bash
npm run dev
```

This starts the Vite dev server. Open the URL it prints:

```
http://localhost:5173/vatlas/
```

The `/vatlas/` path is required — it is the configured `base` in `vite.config.ts` (matching the GitHub Pages deploy path). The bare `http://localhost:5173/` will not load the app.

**What you'll see:** a drop zone. Drag an RVTools `.xlsx` export onto it and `vatlas` parses it entirely in your browser — no bytes leave the page — then renders the dashboard, inventory tree, allocation/DR analysis, and EOS forecast. Sample workbooks are available under `tests/fixtures/` if you don't have an RVTools export handy.

## Common setup issues

- **App is blank at `http://localhost:5173/`** — You omitted the base path. Use `http://localhost:5173/vatlas/`. The dev server also prints the correct URL on startup.
- **`xlsx` resolved to a different version / install warnings about xlsx** — A tool (often `npm audit fix --force`) rewrote the pinned CDN tarball to the npm package. Restore the `xlsx` line in `package.json` to `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, delete `node_modules` and `package-lock.json`, and re-run `npm install`. Run `npm run check:supply-chain` to confirm the pin is intact.
- **Vite fails to start with an engine/syntax error** — Your Node is older than the Vite 8 minimum. Upgrade to a Node release satisfying `>= 20.19` or `>= 22.12`.
- **`npm run lint` prints a bogus `ESLint output (JSON parse failed)`** — The linter is Biome, not ESLint; the message comes from a local CLI proxy. Run `npx @biomejs/biome check .` directly. See [DEVELOPMENT.md](./DEVELOPMENT.md) for the full dev loop.

## Next steps

- [USER-GUIDE.md](./USER-GUIDE.md) — the end-user flow: dropping a workbook, reading the atlas, exporting the HTML report and PPTX deck.
- [DEVELOPMENT.md](./DEVELOPMENT.md) — the development loop: scripts, linting, testing, conventions.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the engines, store, and view layer fit together.
- [CONFIGURATION.md](./CONFIGURATION.md) — build-time and runtime configuration.
