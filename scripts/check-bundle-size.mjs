#!/usr/bin/env node
// Bundle-size gate for the ECharts SVG-renderer infrastructure (VIZ-01/02/03,
// ROADMAP Phase-2 success #5).
//
// One check, one script (KISS — mirrors scripts/check-supply-chain.mjs's
// bare-Node shape):
//   The production chunk that carries Apache ECharts MUST be ≤300 KB
//   gzipped (307200 bytes). This is the structural defense for T-02-02:
//   an accidental or malicious `import * as echarts from 'echarts'`
//   (~1 MB un-tree-shaken) blows past the gate and fails CI, where the
//   tree-shaken `echarts/core` + `echarts.use([...])` path stays well
//   under budget. Phase-1's 700 KB *raw* Vite chunk warning is an
//   orthogonal metric (raw vs gz, warning vs hard-gate) — untouched here.
//
// Runs on a bare Node runtime (only node:fs + node:zlib — no deps). This is
// a POST-build CI step (NOT a prebuild hook — prebuild stays the
// supply-chain gate only, per 01-03-SUMMARY). It requires `dist/assets/`
// to exist: run `npm run build` first.
//
// Marker substring: 'echarts' — the ECharts source ships its own
// 'echarts' identifier strings (e.g. the registered global / version
// banner / module markers) into whichever emitted chunk it lands in, so a
// case-insensitive scan for the literal `echarts` reliably selects the
// ECharts-bearing chunk(s) regardless of Rolldown's chunk-naming. If no
// chunk contains the marker (no chart imported outside tests yet — the
// Phase-2 plan 02-01 state), the script reports "no echarts chunk found"
// and exits 0: there is nothing to gate until 02-03 imports <Chart> into
// the dashboard, at which point the ≤300 KB gz assertion goes live.
//
// Exit 0 = clean (or nothing to gate yet). Exit 1 = violation / misuse
// (with a clear message).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const ASSETS_DIR = 'dist/assets'
const MAX_GZIP_BYTES = 307200 // 300 KiB — ROADMAP Phase-2 success #5 authoritative
const ECHARTS_MARKER = 'echarts'

if (!existsSync(ASSETS_DIR)) {
  console.error(
    'check-bundle-size: dist/assets/ not found — run `npm run build` first (this is a post-build CI gate).',
  )
  process.exit(1)
}

const jsChunks = readdirSync(ASSETS_DIR).filter((f) => f.endsWith('.js'))

const echartsChunks = jsChunks
  .map((file) => {
    const bytes = readFileSync(join(ASSETS_DIR, file))
    return { file, bytes }
  })
  .filter(({ bytes }) =>
    bytes.toString('latin1').toLowerCase().includes(ECHARTS_MARKER),
  )

if (echartsChunks.length === 0) {
  // Nothing wired <Chart> into the bundle yet (plan 02-01 state — charts
  // get imported by the dashboard in 02-03). Nothing to gate.
  console.log('check-bundle-size: OK (no echarts chunk found — nothing to gate yet)')
  process.exit(0)
}

let exitCode = 0

for (const { file, bytes } of echartsChunks) {
  const gzBytes = gzipSync(bytes).length
  const gzKib = (gzBytes / 1024).toFixed(1)
  if (gzBytes > MAX_GZIP_BYTES) {
    console.error(
      `BUNDLE-SIZE VIOLATION — ECharts chunk exceeds the 300 KB gz budget (ROADMAP success #5).`,
    )
    console.error(`  chunk:    ${file}`)
    console.error(`  gzipped:  ${gzBytes} bytes (${gzKib} KiB)`)
    console.error(`  limit:    ${MAX_GZIP_BYTES} bytes (300.0 KiB)`)
    console.error(
      `  hint:     a non-tree-shaken \`import * as echarts from 'echarts'\` is the usual cause — use \`echarts/core\` + \`echarts.use([...])\`.`,
    )
    exitCode = 1
  } else {
    console.log(`check-bundle-size: ${file} = ${gzBytes} bytes gz (${gzKib} KiB) ≤ 300 KiB`)
  }
}

if (exitCode === 0) console.log('check-bundle-size: OK')
process.exit(exitCode)
