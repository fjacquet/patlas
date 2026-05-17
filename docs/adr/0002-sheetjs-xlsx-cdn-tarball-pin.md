<!-- generated-by: gsd-doc-writer -->
# ADR-0002: SheetJS `xlsx` Pinned to the Official CDN Tarball (Never the npm Package)

**Status:** Accepted
**Date:** 2026-05-15
**Inherited from:** vsizer ADR-0002
**Project:** vatlas
**Phase:** 1 — Foundation & Invariants

## Context

vatlas parses RVTools `.xlsx` workbooks with SheetJS. SheetJS stopped
publishing current releases to the npm registry: the npm `xlsx` package is
frozen at `0.18.5` and carries CVE-2023-30533 (prototype pollution) and
CVE-2024-22363 (ReDoS). The current SheetJS release is distributed only from
the SheetJS CDN. A tool such as `npm audit fix --force` can silently rewrite a
tarball dependency to a registry version range, swapping the maintained code
for the CVE-affected frozen package.

## Decision

`dependencies.xlsx` in `package.json` is pinned to the exact official CDN
tarball:

```
https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

The npm `xlsx` package and any semver range resolving to it are never used.
The pin is enforced by `node scripts/check-supply-chain.mjs` (the
`check:supply-chain` npm script, also wired as the `prebuild` hook and as a CI
step that runs *before* `npm ci`): if `dependencies.xlsx` is present and not
exactly the required URL, the script exits non-zero with the expected/found
values.

## Rationale

- The npm package is not the same code as the current CDN release; only the
  CDN tarball is maintained and CVE-clear at `0.20.3`.
- Enforcing the pin in a bare-Node script that runs before `npm ci` means a
  tainted `package.json` never installs in CI.
- Running the same check as a `prebuild` hook catches local drift before a
  build is produced.

## Alternatives Considered

- **`npm install xlsx` from the registry.** Frozen at `0.18.5`, two open
  CVEs; rejected.
- **Vendoring the SheetJS source into the repo.** Larger maintenance and
  review surface than a pinned, hash-resolvable tarball; rejected.

## Consequences

- `npm audit fix --force` is forbidden — it would rewrite the tarball URL to a
  registry range and reintroduce the CVEs (see ADR-0016).
- Bumping SheetJS is a deliberate edit to the pinned URL plus an amendment to
  this ADR and `scripts/check-supply-chain.mjs`'s `REQUIRED_XLSX_PIN`.
- The `xlsx` import is confined to the parser Web Worker; the pin guarantees
  every environment resolves the identical CDN artefact.
- This decision must be revisited when a newer SheetJS CDN release supersedes
  `0.20.3`.
