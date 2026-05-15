#!/usr/bin/env node
// Generate a deterministic, tiny RVTools-shaped .xlsx for the MiB canary
// regression test. The canary VM row has Provisioned MB = 102400 (exactly
// 100 GiB). If a contributor reintroduces the SI MB→MiB inflation factor
// anywhere in the parser, Plan 04's integration test asserts
// `mibToGib(parsed.vinfo[0].provisionedMib) === gib(100)` and fails loudly.
//
// Run: `npm run generate-mib-canary`. The fixture IS committed to git
// (small, deterministic, < 10 KB). Re-running yields byte-identical output.

import * as fs from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

// SheetJS in Node ESM does not auto-bind a filesystem; `writeFile` throws
// "cannot save file" until `set_fs` is called explicitly.
XLSX.set_fs(fs)

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'src', '__fixtures__')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'rvtools-mib-canary.xlsx')

// vInfo sheet — one VM row. Hand-computable totals:
//   Provisioned MiB = 102400 → mibToGib = 100 GiB exactly
//   In Use MiB      = 51200  → mibToGib = 50 GiB exactly
//   Memory          = 4096 MiB = 4 GiB
const vInfo = [
  [
    'VM',
    'Powerstate',
    'Cluster',
    'Host',
    '# CPUs',
    'Memory',
    'Provisioned MB',
    'In Use MB',
    'OS according to the configuration file',
    'OS according to the VMware Tools',
    'VM UUID',
    'VI SDK UUID',
    'VI SDK Server',
  ],
  [
    'canary-vm-01',
    'poweredOn',
    'canary-cluster-01',
    'canary-host-01',
    2,
    4096,
    102400,
    51200,
    'Red Hat Enterprise Linux 8 (64-bit)',
    'Red Hat Enterprise Linux 8.10',
    '01234567-89ab-cdef-0123-456789abcdef',
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'vcenter.canary.local',
  ],
]

// vHost sheet — one ESX row. 2 sockets * 12 cores * 2600 MHz = 62.4 GHz
// (matches the Phase 2 / ROADMAP success-criterion test).
//   Memory = 65536 MiB = 64 GiB
const vHost = [
  ['Host', 'Cluster', '# CPU', '# Cores', 'Speed', '# Memory', 'BIOS UUID', 'OS', 'Service tag'],
  [
    'canary-host-01',
    'canary-cluster-01',
    2,
    12,
    2600,
    65536,
    'host-bios-uuid-001',
    'VMware ESXi 8.0.3',
    'CN-SVC-001',
  ],
]

// vMetaData — capture date + RVTools version (Plan 4 reads this for
// inferRvtoolsVersion).
const vMetaData = [
  ['Property', 'Value'],
  ['RVTools Version', '4.4.0'],
  ['Exported Timestamp', '2026-05-15 10:00:00'],
]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vInfo), 'vInfo')
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vHost), 'vHost')
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vMetaData), 'vMetaData')

// Deterministic write — disable compression so the bytes are stable across
// runs (necessary for clean git diffs and the byte-identical re-run check).
XLSX.writeFile(wb, outPath, { bookType: 'xlsx', compression: false })

console.warn(`Generated: ${outPath}`)
