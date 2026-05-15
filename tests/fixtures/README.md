# tests/fixtures/

Real RVTools workbooks live here for the integration test suite. They are
**NOT** committed to the repo (`.gitignore` excludes `*.xlsx`). On a fresh
checkout, run `node scripts/seed-fixtures.mjs` to populate the directory from
the user's local OneDrive + the vsizer synthetic sample.

The MiB canary fixture (`src/__fixtures__/rvtools-mib-canary.xlsx`) is
different — it IS committed because it's synthetic, deterministic, and small.
See Plan 03.
