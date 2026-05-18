# DEP-01 / DEP-02 — Verification Record (Phase 10, plan 10-05 Task 3)

**Verification only — NO workflow file was authored or modified.**
`git diff --quiet .github/workflows/static.yml` → true (UNMODIFIED).

## DEP-02 — CI pipeline (typecheck → lint → test → build → deploy on push to `main`)

Inspected `.github/workflows/static.yml`. Triggers (lines 4–9):
`push` → `branches: ['main']` + `tags: ['v*']`, and `pull_request` → `branches: ['main']`.

`build` job step sequence (cited line numbers):

| Step | Line | Command |
|------|------|---------|
| Check supply chain (telemetry denylist + SheetJS pin) | 34–35 | `node scripts/check-supply-chain.mjs` |
| Install dependencies | 37–38 | `npm ci` |
| npm audit (LOW+) | 40–41 | `npm audit --audit-level=low` |
| OSV-Scanner (lockfile) + gate | 43–62 | `google/osv-scanner-action` + LOW+ gate |
| **Type check** | 79–80 | `npm run typecheck` |
| **Lint** | 94–95 | `npm run lint` (CI runs the real Biome; the RTK interception is a local-shell artifact only — CLAUDE.md Gotcha) |
| **Test** | 97–98 | `npm run test:run` |
| **Build** | 100–101 | `npm run build` |
| Check bundle size (ECharts ≤300 KB gz) | 103–104 | `npm run check:bundle-size` |

`deploy` job (lines 153–163): `environment: github-pages`,
`actions/configure-pages@v6` (143) + `actions/upload-pages-artifact@v5` (149)
+ **`actions/deploy-pages@v5`** (163). ⇒ typecheck→lint→test→build→deploy
runs on every push to `main`. **DEP-02 satisfied.**

**No workflow edit needed for Phase 10:** the new `src/i18n/keyParity.test.ts`
(Minor-7, plan 02) and the entire `src/engines/export/**` test tree ride the
existing **Test** step (`npm run test:run`, line 98) — confirmed by running
the full suite locally (green).

## DEP-01 — Public URL `fjacquet.github.io/vatlas/`

`vite.config.ts:9` → `base: '/vatlas/'`. The Pages deploy job serves the
built `dist/` at `https://fjacquet.github.io/vatlas/`. **DEP-01 satisfied.**

## Corroboration — recent `static.yml` runs

`gh run list --workflow=static.yml --limit 3`:

| Run | Conclusion |
|-----|-----------|
| 26022979778 (Deploy to GitHub Pages) | success |
| 26022892714 (Deploy to GitHub Pages) | success |
| 26022737887 (Deploy to GitHub Pages) | failure — the pre-fix run on PR #2 before the `package.json` EOF-newline lint fix (since green) |

The two most-recent runs are green, exercising the full
typecheck→lint→test→build→deploy chain on `main`. The single earlier
failure was the already-resolved P9 `package.json` Biome-format nit
(commit `153e1fc`), not a pipeline-shape problem.

## Conclusion

DEP-01 and DEP-02 are satisfied by the already-shipped pipeline + Vite
base path. Phase 10 required **zero** CI/deploy authoring — verification
only, workflow byte-unchanged.

*Recorded: 2026-05-18 · Phase 10 plan 10-05 Task 3*
