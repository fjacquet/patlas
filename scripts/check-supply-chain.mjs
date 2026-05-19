#!/usr/bin/env node
// Supply-chain gate for the vatlas privacy invariant (ADR-0001 + the v2.0
// ADR-0001 service-worker exception; see docs/adr/0001-privacy-invariant.md).
//
// Three checks, one script (KISS — see 01-PATTERNS.md L613):
//   1. Telemetry denylist — no error-reporting / analytics SDK may appear in
//      package.json dependencies OR devDependencies. A telemetry SDK is a
//      latent exfiltration path for workbook contents.
//   2. SheetJS pin — `dependencies.xlsx`, if present, MUST be the exact
//      official CDN tarball (the npm `xlsx` is frozen at 0.18.5 and carries
//      CVE-2023-30533 + CVE-2024-22363). Lenient on absence, strict on presence.
//   3. Service-worker envelope — a service worker is permitted ONLY under the
//      ADR-0001 exception: the sole sanctioned toolchain is `vite-plugin-pwa`
//      (+ its `workbox-*` packages). Any OTHER service-worker-named dependency
//      is denied. When `vite-plugin-pwa` is present a worker is expected, so
//      `src/sw.ts` MUST exist and its FIRST executable statement MUST import
//      the runtime privacy guard (`./privacy/fetchGuard`) — that is what keeps
//      the SW global scope inside the three-layer privacy model rather than
//      poking a hole in it.
//
// Pure core (`evaluateSupplyChain`) + a thin CLI so the gate is unit-testable.
// Runs on a bare Node runtime (only reads files — no deps). Wired as the
// `check:supply-chain` + `prebuild` npm scripts and as a CI step BEFORE
// `npm ci` so a tainted package.json never installs.
//
// Exit 0 = clean. Exit 1 = violation (with a clear message).
import { existsSync, readFileSync } from 'node:fs'

export const REQUIRED_XLSX_PIN = 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz'
export const GUARD_IMPORT = './privacy/fetchGuard'

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

// The ONLY sanctioned service-worker toolchain (ADR-0001 exception).
const SW_TOOLCHAIN_ALLOW = [/^vite-plugin-pwa$/, /^workbox(-[a-z0-9-]+)?$/]
// A dependency NAME that looks like a service-worker library.
const SW_NAME_PATTERN = /service-?worker/i
const PWA_PLUGIN = 'vite-plugin-pwa'

// First executable line, ignoring leading blank lines, `//` line comments, and
// `/* … */` block comments. Returns '' if the source is only comments/blank.
function firstCodeLine(source) {
  const lines = source.split('\n')
  let inBlock = false
  for (const raw of lines) {
    let line = raw.trim()
    if (inBlock) {
      const end = line.indexOf('*/')
      if (end === -1) continue
      line = line.slice(end + 2).trim()
      inBlock = false
    }
    if (line === '') continue
    if (line.startsWith('//')) continue
    if (line.startsWith('/*')) {
      if (line.includes('*/')) {
        line = line.slice(line.indexOf('*/') + 2).trim()
        if (line === '') continue
      } else {
        inBlock = true
        continue
      }
    }
    return line
  }
  return ''
}

function importsGuardFirst(swSource) {
  const first = firstCodeLine(swSource)
  // `import './privacy/fetchGuard'` — single or double quotes, optional `;`,
  // optional trailing `// …` line comment (the established worker convention,
  // see src/engines/parser/parser.worker.ts).
  const path = GUARD_IMPORT.replace(/[.]/g, '\\.')
  return new RegExp(`^import\\s+['"]${path}['"];?\\s*(//.*)?$`).test(first)
}

/**
 * Pure supply-chain evaluation.
 * @param {{ pkg: object, swSource: string|null }} input
 *   pkg      — parsed package.json
 *   swSource — contents of src/sw.ts, or null when the file does not exist
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function evaluateSupplyChain({ pkg, swSource }) {
  const errors = []
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
  const names = Object.keys(allDeps)

  const telemetry = names.filter((name) => FORBIDDEN_PATTERNS.some((re) => re.test(name)))
  if (telemetry.length > 0) {
    errors.push(`forbidden telemetry packages in package.json: ${telemetry.join(', ')}`)
  }

  if (allDeps.xlsx !== undefined && allDeps.xlsx !== REQUIRED_XLSX_PIN) {
    errors.push(
      `xlsx must pin to the SheetJS tarball — expected ${REQUIRED_XLSX_PIN}, found ${allDeps.xlsx}`,
    )
  }

  // Any service-worker-named dependency that is NOT the sanctioned toolchain.
  const rogue = names.filter(
    (name) => SW_NAME_PATTERN.test(name) && !SW_TOOLCHAIN_ALLOW.some((re) => re.test(name)),
  )
  if (rogue.length > 0) {
    errors.push(
      `service-worker library outside the ADR-0001 exception (only ${PWA_PLUGIN} + workbox-* allowed): ${rogue.join(', ')}`,
    )
  }

  // When the sanctioned plugin is present a worker is expected — enforce the
  // guard-first envelope so the SW scope stays inside the privacy model.
  if (names.includes(PWA_PLUGIN)) {
    if (swSource === null) {
      errors.push(
        `${PWA_PLUGIN} is a dependency but src/sw.ts is missing — the ADR-0001 SW exception requires an audited src/sw.ts`,
      )
    } else if (!importsGuardFirst(swSource)) {
      errors.push(
        `src/sw.ts must import '${GUARD_IMPORT}' as its first executable statement (ADR-0001 SW exception)`,
      )
    }
  }

  return { ok: errors.length === 0, errors }
}

// ── CLI ───────────────────────────────────────────────────────────────────
// Only runs when executed directly, not when imported by the test.
const invokedDirectly = process.argv[1] && import.meta.url === `file://${process.argv[1]}`

if (invokedDirectly) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
  const swSource = existsSync('src/sw.ts') ? readFileSync('src/sw.ts', 'utf-8') : null
  const { ok, errors } = evaluateSupplyChain({ pkg, swSource })
  if (!ok) {
    console.error('SUPPLY-CHAIN VIOLATION (ADR-0001):')
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }
  console.log('check-supply-chain: OK')
  process.exit(0)
}
