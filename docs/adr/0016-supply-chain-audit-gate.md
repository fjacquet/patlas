<!-- generated-by: gsd-doc-writer -->
# ADR-0016: Supply-Chain and Bundle-Size CI Gates

**Status:** Accepted
**Date:** 2026-05-15
**Inherited from:** vsizer ADR-0016
**Project:** vatlas
**Phase:** 1 — Foundation & Invariants

## Context

The privacy invariant (ADR-0001) and the SheetJS pin (ADR-0002) are only as
strong as their enforcement. A telemetry SDK added in good faith, a tool that
rewrites the `xlsx` tarball to the CVE-affected npm package, or a
non-tree-shaken `import * as echarts from 'echarts'` (~1 MB) can each defeat a
product invariant without any visible local failure. These need automated,
build-failing gates rather than convention.

## Decision

1. **Supply-chain gate** — `node scripts/check-supply-chain.mjs`
   (`npm run check:supply-chain`, also the `prebuild` hook and a CI step that
   runs *before* `npm ci`) fails the build on any forbidden telemetry package
   in `dependencies` or `devDependencies` (`@sentry/*`, `posthog*`,
   `@amplitude/*`, `mixpanel*`, `@datadog/*`, `logrocket*`, `@bugsnag/*`,
   `@segment/*`, `fullstory*`, `@hotjar/*`, service-worker libraries, and
   related patterns) or on `xlsx` pin drift away from
   `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
2. **Bundle-size gate** — `node scripts/check-bundle-size.mjs`
   (`npm run check:bundle-size`, a post-build CI step) fails if the emitted
   ECharts chunk exceeds 300 KB gzipped (307200 bytes). A sibling 60 KiB gz
   limit guards the `@tanstack` chunk.
3. **`npm audit fix --force` is forbidden.** It rewrites the `xlsx` tarball
   URL to a registry range, reintroducing CVE-2023-30533 and
   CVE-2024-22363. Vulnerabilities are resolved by upgrading, never by
   forcing the resolver. CI additionally runs `npm audit --audit-level=low`
   and OSV-Scanner gated at LOW+.

## Rationale

- Bare-Node scripts with no dependencies can run before `npm ci`, so a
  tainted `package.json` never installs in CI.
- The bundle-size gate is the structural defense against an accidental
  non-tree-shaken ECharts import: the tree-shaken `echarts/core` +
  `echarts.use([...])` path stays well under 300 KB gz; a full import blows
  past the gate.
- A forced audit fix is the single highest-leverage way to silently break
  both the privacy and CVE posture, so it is called out explicitly.

## Alternatives Considered

- **Manual review only.** A telemetry import or a tarball rewrite is easy to
  miss in review and produces no local error; rejected.
- **Raw (non-gzipped) Vite chunk-size warning only.** A warning does not fail
  the build, and raw size is an orthogonal metric to the gzipped budget;
  kept as an independent signal, not as the gate.

## Consequences

- Adding a telemetry-adjacent package requires amending the denylist in
  `scripts/check-supply-chain.mjs` and this ADR (and ADR-0001).
- The supply-chain check is lenient on `xlsx` absence, strict on presence —
  it does not block early phases that have not yet added the dependency.
- The bundle-size check is a no-op until a chart is wired into the production
  graph (no ECharts chunk yet → exits 0), then enforces the 300 KB gz budget.
- Resolving an audit/OSV finding means upgrading the offending dependency,
  never `npm audit fix --force`.
