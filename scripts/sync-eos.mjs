#!/usr/bin/env node
// Maintainer-run EOS catalogue refresher (vatlas privacy invariant, ADR-0001).
//
// This is the ONLY place in vatlas where a network call to a third party is
// allowed, and it runs ONLY when a maintainer types `npm run sync:eos`. It is
// NEVER in the CI deploy path: the GitHub Pages build only validates the
// committed snapshot, it never fetches. The runtime app NEVER fetches the
// catalogue — the P1 privacy guard throws on any non-same-origin fetch; the
// catalogue is a static `import` validated by Zod at one boundary
// (src/engines/eos/catalogue.ts).
//
// Fail-closed (D-02): on ANY non-2xx response, fetch throw, or shape
// mismatch, the script exits non-zero WITHOUT writing — the last-good
// committed snapshot is left untouched, so a third-party outage can never
// corrupt the snapshot or block a deploy.
//
// Single standard-support EOL model (D-04): each release is projected down to
// { name, label, releaseDate, isEol, eolFrom, isMaintained }. Paid
// extended-support tier fields are deliberately dropped by construction.
//
// Runs on a bare Node runtime (Node 24+ global fetch, only node:fs — no deps).
//
// Exit 0 = snapshot written. Exit 1 = failure, snapshot NOT touched.
import { writeFileSync } from 'node:fs'

// Curated endoflife.date product slugs (verified live 2026-05-17).
const SLUGS = [
  'esxi',
  'rhel',
  'oracle-linux',
  'windows-server',
  'windows',
  'centos',
  'debian',
  'ubuntu',
  'sles',
  'almalinux',
  'rocky-linux',
]

const API = 'https://endoflife.date/api/v1/products'
const OUT = 'src/engines/eos/catalogue.json'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function projectRelease(r) {
  // D-04: keep ONLY the single standard-support date. Paid ESU/ELS tier
  // fields are not copied — every extended-support field is dropped here.
  return {
    name: String(r.name),
    label: String(r.label ?? r.name),
    releaseDate: r.releaseDate ?? null,
    isEol: Boolean(r.isEol),
    eolFrom: r.eolFrom ?? null,
    isMaintained: Boolean(r.isMaintained),
  }
}

async function fetchProduct(slug) {
  const res = await fetch(`${API}/${slug}/`, {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`GET ${slug}: HTTP ${res.status}`)
  }
  const body = await res.json()
  const result = body?.result
  if (!result || !Array.isArray(result.releases)) {
    throw new Error(`GET ${slug}: unexpected shape (no result.releases[])`)
  }
  return {
    name: String(result.name ?? slug),
    releases: result.releases.map(projectRelease),
  }
}

async function main() {
  const products = {}
  for (const slug of SLUGS) {
    products[slug] = await fetchProduct(slug)
  }
  const snapshot = { lastVerified: todayIso(), products }
  writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`sync-eos: OK — wrote ${OUT} (${SLUGS.length} products)`)
  process.exit(0)
}

main().catch((err) => {
  console.error(`sync-eos: FAILED — ${err.message}`)
  console.error('sync-eos: committed snapshot left untouched (D-02 fail-closed)')
  process.exit(1)
})
