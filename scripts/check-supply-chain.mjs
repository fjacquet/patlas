#!/usr/bin/env node
// Supply-chain gate for the vatlas privacy invariant (ADR-0001).
//
// Two checks, one script (KISS — see 01-PATTERNS.md L613):
//   1. Telemetry denylist — no error-reporting / analytics SDK may appear in
//      package.json dependencies OR devDependencies. A telemetry SDK is a
//      latent exfiltration path for workbook contents.
//   2. SheetJS pin — `dependencies.xlsx`, if present, MUST be the exact
//      official CDN tarball. The npm `xlsx` package is frozen at 0.18.5 and
//      carries CVE-2023-30533 + CVE-2024-22363. `xlsx` is not in deps yet
//      (it lands in plan 01-04); the check is lenient on absence, strict on
//      presence.
//
// Runs on a bare Node runtime (only reads package.json — no deps). Wired as
// the `check:supply-chain` + `prebuild` npm scripts and as a CI step BEFORE
// `npm ci` so a tainted package.json never installs.
//
// Exit 0 = clean. Exit 1 = violation (with a clear message).
import { readFileSync } from 'node:fs'

const FORBIDDEN_PATTERNS = [
  /^@sentry\//,
  /^posthog-/,
  /^@posthog\//,
  /^posthog$/,
  /^@amplitude\//,
  /^amplitude-/,
  /^mixpanel/,
  /^@datadog\//,
  /^logrocket/,
  /^@bugsnag\//,
  /^heap-analytics/,
  /^segment-analytics/,
  /^@segment\//,
  /^fullstory/,
  /^@fullstory\//,
  /^@hotjar\//,
  /^hotjar/,
]

const REQUIRED_XLSX_PIN = 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz'

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }

let exitCode = 0

const offenders = Object.keys(allDeps).filter((name) =>
  FORBIDDEN_PATTERNS.some((re) => re.test(name)),
)

if (offenders.length > 0) {
  console.error('SUPPLY-CHAIN VIOLATION — forbidden telemetry packages in package.json:')
  for (const o of offenders) console.error(`  - ${o}`)
  exitCode = 1
}

// xlsx is allowed to be ABSENT (it lands in plan 01-04). If present it MUST be
// the official tarball pin — never the CVE-affected npm version range.
if (allDeps.xlsx !== undefined && allDeps.xlsx !== REQUIRED_XLSX_PIN) {
  console.error('SUPPLY-CHAIN VIOLATION — xlsx must pin to the SheetJS tarball.')
  console.error(`  expected: ${REQUIRED_XLSX_PIN}`)
  console.error(`  found:    ${allDeps.xlsx}`)
  exitCode = 1
}

if (allDeps['service-worker'] || /\bservice-worker\b/.test(JSON.stringify(allDeps))) {
  console.error(
    'SUPPLY-CHAIN VIOLATION — service worker libraries are forbidden (PITFALLS.md Critical-2).',
  )
  exitCode = 1
}

if (exitCode === 0) console.log('check-supply-chain: OK')
process.exit(exitCode)
