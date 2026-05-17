<!-- generated-by: gsd-doc-writer -->
# ADR-0005: Pure-Function Paths Gated at ≥75% Test Coverage

**Status:** Accepted
**Date:** 2026-05-15
**Inherited from:** vsizer ADR-0005
**Project:** vatlas
**Phase:** 1 — Foundation & Invariants

## Context

vatlas's correctness lives in pure functions: the parser, the analysis
engines, unit conversions, and the privacy guard. These are deterministic,
have no React/DOM dependencies, and are the parts most likely to silently
regress (a wrong allocation ratio, a dropped column alias, a guard that stops
throwing). UI components are exercised indirectly and are intentionally not
gated.

## Decision

The following globs are gated at ≥75% coverage (lines, functions, branches,
and statements) via `npm run test:coverage` (`vitest run --coverage`,
`@vitest/coverage-v8`), configured in `vitest.config.ts`:

- `src/engines/**/*.ts`
- `src/utils/**/*.ts`
- `src/engines/units/**/*.ts`
- `src/privacy/**/*.ts`

Type declarations and test files (`**/*.d.ts`, `**/*.test.ts`,
`**/*.spec.ts`) are excluded. All four threshold dimensions are set to `75`;
falling below any one fails the run.

## Rationale

- 75% is the inherited vsizer threshold — high enough to catch logic
  regressions, low enough not to force tests for trivial pass-through code.
- Gating the pure-function paths only keeps the signal tight: a coverage drop
  means engine/parser/units/privacy logic lost test protection, not that a
  component lacks a snapshot test.
- v8 coverage is the provider already wired in vsizer; no extra tooling.

## Alternatives Considered

- **Whole-`src/` coverage gate.** Forces brittle component tests and dilutes
  the signal that matters; rejected.
- **A higher (90%+) threshold.** Encourages coverage-padding tests with low
  defect-detection value; rejected in favour of the proven 75%.

## Consequences

- New code under the gated globs must ship with tests that keep all four
  dimensions ≥75% or the coverage run fails.
- Adding a new pure-function directory means adding its glob to the
  `coverage.include` list in `vitest.config.ts` and noting it here.
- The HTML-report builder is to be added to the gated paths once it lands
  (it is a pure function in `src/engines/`).
- CI runs `npm run test:run`; the coverage gate is enforced via
  `npm run test:coverage`.
