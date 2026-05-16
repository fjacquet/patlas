#!/usr/bin/env node
// Generate a deterministic, synthetic ~10 000-VM RVTools-shaped .xlsx for
// the Phase-3 inventory stress test (ROADMAP Phase-3 success #1/#2: tree
// expand/collapse stays a bounded virtualised window, VM-table sort by
// Provisioned MB completes < 200 ms at 10k). Real RVTools fixtures top out
// at 249 VMs — 10k is synthetic-stress territory only.
//
// Deterministic: a pure seeded counter varies vmName/cluster/host/vCPU/
// memory/provisioned so sort + filter exercise realistic distributions;
// re-running yields byte-identical output (compression disabled). One row
// carries an embedded "\n" in its annotation-shaped OS column to exercise
// the oneLine display path / RFC-4180 CSV-quoting path (Pitfall 4).
//
// This fixture is NOT bundled in the app — it is generated under
// src/__fixtures__/ for tests/stress only and is large; do NOT import it
// from any production module. Run: `npm run generate-inventory-10k`.

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
const outPath = join(outDir, 'rvtools-inventory-10k.xlsx')

const VM_COUNT = 10000
const CLUSTERS = 8
const HOSTS_PER_CLUSTER = 6
const OS_POOL = [
  'Microsoft Windows Server 2019 (64-bit)',
  'Microsoft Windows Server 2022 (64-bit)',
  'Red Hat Enterprise Linux 8 (64-bit)',
  'Red Hat Enterprise Linux 9 (64-bit)',
  'Ubuntu Linux (64-bit)',
  'SUSE Linux Enterprise 15 (64-bit)',
  'Other 5.x or later Linux (64-bit)',
]

const vInfoHeader = [
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
]

const vInfo = [vInfoHeader]
for (let i = 0; i < VM_COUNT; i++) {
  const cl = i % CLUSTERS
  const hostIdx = i % HOSTS_PER_CLUSTER
  const cluster = `cluster-${String(cl + 1).padStart(2, '0')}`
  const host = `esx-${String(cl + 1).padStart(2, '0')}-${String(hostIdx + 1).padStart(2, '0')}.lab.local`
  const vcpu = 1 + (i % 16)
  const memMib = 2048 * (1 + (i % 12))
  // Spread provisioned widely + monotone-ish so a descending sort is a real
  // O(n log n) shuffle, not a near-sorted best case.
  const provisionedMib = 20480 + ((i * 8191) % 4096000)
  const inUseMib = Math.floor(provisionedMib * 0.6)
  const osConfig = OS_POOL[i % OS_POOL.length]
  // Exactly one row carries an embedded newline to exercise Pitfall 4
  // (oneLine display collapse vs. CSV RFC-4180 newline preservation).
  const osTools =
    i === 4242
      ? 'Red Hat Enterprise Linux 9.4\nmaintenance window: Sundays 02:00-04:00 UTC'
      : osConfig
  vInfo.push([
    `vm-${String(i + 1).padStart(5, '0')}`,
    i % 5 === 0 ? 'poweredOff' : 'poweredOn',
    cluster,
    host,
    vcpu,
    memMib,
    provisionedMib,
    inUseMib,
    osConfig,
    osTools,
    `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'vcenter.lab.local',
  ])
}

const vHostHeader = [
  'Host',
  'Cluster',
  '# CPU',
  '# Cores',
  'Speed',
  '# Memory',
  'BIOS UUID',
  'OS',
  'Service tag',
]
const vHost = [vHostHeader]
for (let cl = 0; cl < CLUSTERS; cl++) {
  for (let h = 0; h < HOSTS_PER_CLUSTER; h++) {
    const cluster = `cluster-${String(cl + 1).padStart(2, '0')}`
    const host = `esx-${String(cl + 1).padStart(2, '0')}-${String(h + 1).padStart(2, '0')}.lab.local`
    vHost.push([
      host,
      cluster,
      2,
      24,
      2600,
      786432,
      `host-bios-${String(cl)}${String(h)}`,
      'VMware ESXi 8.0.3',
      `CN-SVC-${String(cl)}${String(h)}`,
    ])
  }
}

const vMetaData = [
  ['Property', 'Value'],
  ['RVTools Version', '4.4.0'],
  ['Exported Timestamp', '2026-05-16 09:00:00'],
]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vInfo), 'vInfo')
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vHost), 'vHost')
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vMetaData), 'vMetaData')

// Deterministic write — disable compression so the bytes are stable across
// runs (necessary for the byte-identical re-run check).
XLSX.writeFile(wb, outPath, { bookType: 'xlsx', compression: false })

console.warn(`Generated: ${outPath} (${VM_COUNT} VMs, ${CLUSTERS * HOSTS_PER_CLUSTER} hosts)`)
