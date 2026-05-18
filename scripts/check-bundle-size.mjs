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

// Sibling gate for the @tanstack/react-table + @tanstack/react-virtual
// infrastructure (Phase-3 INV-05/06). Same structural defense as the
// echarts gate, scoped to whatever chunk the TanStack source lands in.
// Marker substring '@tanstack' — TanStack ships its own '@tanstack/...'
// package-path identifier strings into the emitted chunk regardless of
// Rolldown's chunk-naming, so a case-insensitive scan reliably selects
// the TanStack-bearing chunk(s). Threshold 60 KiB gz (03-RESEARCH A6:
// generous headroom over the measured tree-shaken table+virtual cost;
// tighten after the first production build once 03-03 mounts a real
// consumer). Until then no chunk carries the marker → graceful no-op.
const MAX_TANSTACK_GZIP_BYTES = 61440 // 60 KiB — 03-RESEARCH A6
const TANSTACK_MARKER = '@tanstack'

if (!existsSync(ASSETS_DIR)) {
  console.error(
    'check-bundle-size: dist/assets/ not found — run `npm run build` first (this is a post-build CI gate).',
  )
  process.exit(1)
}

const jsChunks = readdirSync(ASSETS_DIR).filter((f) => f.endsWith('.js'))

// The gate targets the INITIAL ECharts payload (ROADMAP Phase-2 #5 /
// T-02-02 — a non-tree-shaken barrel in the shipped page bundle). Web
// Worker chunks (`*.worker-<hash>.js`) are CODE-SPLIT and lazily fetched
// only when their feature runs (e.g. the Phase-10 export worker, fetched
// on an export click — never on initial paint). They legitimately bundle
// echarts SSR + pptxgenjs + react-dom/server and exceed 300 KiB by design;
// their tree-shaking is independently enforced by the renderCharts/spike
// no-`from 'echarts'`-barrel grep gates. Excluding them here keeps the
// initial-bundle protection intact without false-failing a deliberate
// lazy worker (P9→P10: export.worker is the first echarts-bearing worker).
const isWorkerChunk = (file) => /\.worker-[^/]*\.js$/.test(file)

const echartsChunks = jsChunks
  .filter((file) => {
    if (isWorkerChunk(file)) {
      console.log(`check-bundle-size: skipping lazy worker chunk ${file} (not initial bundle)`)
      return false
    }
    return true
  })
  .map((file) => {
    const bytes = readFileSync(join(ASSETS_DIR, file))
    return { file, bytes }
  })
  .filter(({ bytes }) => bytes.toString('latin1').toLowerCase().includes(ECHARTS_MARKER))

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

// Detect the TanStack chunk by FILENAME, not content: minification strips
// the literal `@tanstack` package string from the emitted code, so a
// content scan can never find it. The `vendor-tanstack` manualChunks rule
// (vite.config.ts) gives the chunk a stable, greppable name — that is the
// reliable LIVE-gate signal (03-RESEARCH A6).
const tanstackChunks = jsChunks
  .filter((file) => file.toLowerCase().includes(TANSTACK_MARKER.replace('@', '')))
  .map((file) => ({ file, bytes: readFileSync(join(ASSETS_DIR, file)) }))

if (tanstackChunks.length === 0) {
  // No consumer mounts <DataTable> into the production graph yet (03-01
  // builds the primitive; 03-03 wires the first real table). Nothing to
  // gate until then — graceful no-op, exactly like the echarts path.
  console.log('check-bundle-size: OK (no @tanstack chunk found — nothing to gate yet)')
} else {
  for (const { file, bytes } of tanstackChunks) {
    const gzBytes = gzipSync(bytes).length
    const gzKib = (gzBytes / 1024).toFixed(1)
    if (gzBytes > MAX_TANSTACK_GZIP_BYTES) {
      console.error(
        `BUNDLE-SIZE VIOLATION — @tanstack chunk exceeds the 60 KiB gz budget (03-RESEARCH A6).`,
      )
      console.error(`  chunk:    ${file}`)
      console.error(`  gzipped:  ${gzBytes} bytes (${gzKib} KiB)`)
      console.error(`  limit:    ${MAX_TANSTACK_GZIP_BYTES} bytes (60.0 KiB)`)
      console.error(
        `  hint:     pull only the headless table/virtual primitives — no kitchen-sink re-export, no extra @tanstack/* packages.`,
      )
      exitCode = 1
    } else {
      console.log(`check-bundle-size: ${file} = ${gzBytes} bytes gz (${gzKib} KiB) ≤ 60 KiB`)
    }
  }
}

if (exitCode === 0) console.log('check-bundle-size: OK')
process.exit(exitCode)
