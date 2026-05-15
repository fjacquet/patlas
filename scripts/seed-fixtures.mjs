#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

// Idempotent harvester: copies the real RVTools exports from the user's
// local OneDrive + the vsizer synthetic sample into tests/fixtures/.
// tests/fixtures/*.xlsx is gitignored — these large binaries never enter git.
// CI environments won't have the user's OneDrive; exit 0 regardless so the
// pipeline never depends on local-only files.

const fixturesDir = join(process.cwd(), 'tests', 'fixtures')
mkdirSync(fixturesDir, { recursive: true })

const SOURCES = [
  join(homedir(), 'Library/CloudStorage/OneDrive-Home/RVTools_export_all_2026-01-07_10.23.35.xlsx'),
  join(
    homedir(),
    'Library/CloudStorage/OneDrive-Home/JTI/RVTools_export_all_2026-04-17_16.51.38-MOM-vCenter.xlsx',
  ),
  join(
    homedir(),
    'Library/CloudStorage/OneDrive-Home/live-optics/RVTools_export_all_2026-01-14_17.23.32.xlsx',
  ),
  '/Users/fjacquet/Projects/vsizer/public/samples/rvtools-sample.xlsx',
]

let harvested = 0
for (const src of SOURCES) {
  if (!existsSync(src)) {
    console.warn(`SKIP (not found on disk): ${src}`)
    continue
  }
  const dest = join(fixturesDir, basename(src))
  copyFileSync(src, dest)
  const size = statSync(dest).size
  console.log(`HARVEST: ${basename(src)}  (${(size / 1024).toFixed(0)} KB)`)
  harvested += 1
}

console.log(`\nHarvested ${harvested}/${SOURCES.length} fixtures into ${fixturesDir}`)
if (harvested === 0) {
  console.error('No fixtures harvested. Integration tests limited to the synthetic canary.')
}
process.exit(0)
