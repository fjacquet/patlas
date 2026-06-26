import type { EosBucketKey, EosProjection, EosRow, NodeHostRow } from '@/types/estate'
import type { GuestRow } from '@/types/guest'
import type { NodeRow } from '@/types/node'
import type { EosCatalogue } from './catalogueSchema'
import { classifyPve } from './classifyPve'
import { normalizeOs } from './normalizeOs'

// EOS projection types live in @/types/estate (types→engines direction,
// no cycle); re-exported here so the engine module still surfaces them.
export type { EosBucketKey, EosProjection, EosRow, NodeHostRow } from '@/types/estate'

/**
 * Lifecycle bucketer — pure, Zod-free. Receives the typed catalogue and the
 * reference `today` as parameters; it never constructs its own clock
 * instance (Pitfall 4 / D-07 — the reference is the workbook-load date
 * injected from the boundary so tests are deterministic; only Date.UTC /
 * Date.parse / the injected Date's getters are used). Uses standard-support
 * EOL only — an OS past
 * `eolFrom` but under paid support still buckets overdue (D-04); no paid
 * extended-support field is ever consulted.
 *
 * The `partition` is a DISJOINT cover of the VM entity total (overdue · ≤3 ·
 * (3,6] · (6,9] · (9,12] · beyond12 · unknown) whose member counts sum
 * EXACTLY to `vinfo.length` — nothing silently dropped (D-06/D-10). A row
 * that does not normalize, or whose (slug,version) has no catalogue EOL,
 * lands in `unknown`; its verbatim raw OS string (D-12) is occurrence-counted
 * in `rawUnknown` (D-11 — never aggregated-count-only). `cumulative` is a
 * presentation overlay DERIVED from the disjoint partition (never the
 * reconciliation source). ESXi hosts are classified into a SEPARATE `esxi`
 * sub-structure; host counts are never summed into the VM partition (D-09b).
 */

function isoDay(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Days in a given UTC (year, 0-based month) — pure, no Date construction
 *  (keeps the "Date.UTC / Date.parse / getters only" contract above true). */
function daysInUTCMonth(year: number, month: number): number {
  if (month === 1) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return leap ? 29 : 28
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month] as number
}

/** UTC ms midnight `n` calendar months after `today` — clock-free (Pitfall
 *  4). The day is clamped to the target month's last day so end-of-month
 *  inputs (e.g. Jan 31 + 1mo) do NOT overflow into the following month. */
function monthsAfter(today: Date, n: number): number {
  const total = today.getUTCMonth() + n
  const year = today.getUTCFullYear() + Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  const day = Math.min(today.getUTCDate(), daysInUTCMonth(year, month))
  return Date.UTC(year, month, day)
}

function bucketFor(
  eolFrom: string | null,
  todayMs: number,
  m: [number, number, number, number],
): EosBucketKey {
  if (eolFrom === null) return 'unknown'
  const eolMs = Date.parse(eolFrom)
  if (Number.isNaN(eolMs)) return 'unknown'
  if (eolMs < todayMs) return 'overdue'
  if (eolMs <= m[0]) return 'w3'
  if (eolMs <= m[1]) return 'w3to6'
  if (eolMs <= m[2]) return 'w6to9'
  if (eolMs <= m[3]) return 'w9to12'
  return 'beyond12'
}

function emptyPartition(): Record<EosBucketKey, EosRow[]> {
  return { overdue: [], w3: [], w3to6: [], w6to9: [], w9to12: [], beyond12: [], unknown: [] }
}

export function buildEosProjection(args: {
  guests: GuestRow[]
  nodes: NodeRow[]
  catalogue: EosCatalogue
  today: Date
}): EosProjection {
  const { guests: vinfo, nodes: vhost, catalogue, today } = args
  // Date-only: drop time-of-day so a same-day EOL (catalogue dates are UTC
  // midnight via Date.parse) is not flipped to `overdue` later in the day.
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const m: [number, number, number, number] = [
    monthsAfter(today, 3),
    monthsAfter(today, 6),
    monthsAfter(today, 9),
    monthsAfter(today, 12),
  ]

  const partition = emptyPartition()
  const rawUnknownCounts = new Map<string, number>()

  for (const v of vinfo) {
    // Pitfall 2 precedence (mirrors classifyOsFamily): configured OS first,
    // running-tools OS as fallback. Preserved verbatim for the unknown list.
    const rawOs = v.osConfig || v.osTools
    const norm = normalizeOs(rawOs)
    const release =
      norm === null
        ? undefined
        : catalogue.products[norm.slug]?.releases.find((rel) => rel.name === norm.version)
    const eolFrom = release?.eolFrom ?? null
    const bucket: EosBucketKey =
      norm === null || release === undefined ? 'unknown' : bucketFor(eolFrom, todayMs, m)

    if (bucket === 'unknown') {
      rawUnknownCounts.set(rawOs, (rawUnknownCounts.get(rawOs) ?? 0) + 1)
    }
    partition[bucket].push({
      vmName: v.vmName,
      cluster: v.cluster,
      host: v.host,
      os: rawOs,
      slug: norm?.slug ?? null,
      version: norm?.version ?? null,
      eolFrom,
      bucket,
    })
  }

  const cumulative = {
    overdue: partition.overdue.length,
    le3: partition.overdue.length + partition.w3.length,
    le6: partition.overdue.length + partition.w3.length + partition.w3to6.length,
    le9:
      partition.overdue.length +
      partition.w3.length +
      partition.w3to6.length +
      partition.w6to9.length,
    le12:
      partition.overdue.length +
      partition.w3.length +
      partition.w3to6.length +
      partition.w6to9.length +
      partition.w9to12.length,
    unknown: partition.unknown.length,
  }

  const nodeCounts: Record<EosBucketKey, number> = {
    overdue: 0,
    w3: 0,
    w3to6: 0,
    w6to9: 0,
    w9to12: 0,
    beyond12: 0,
    unknown: 0,
  }
  const hosts: NodeHostRow[] = vhost.map((h) => {
    const c = classifyPve(h.esxVersion, catalogue)
    const bucket = bucketFor(c.majorEol, todayMs, m)
    nodeCounts[bucket] += 1
    return {
      hostName: h.hostName,
      pveVersion: h.esxVersion,
      major: c.major,
      majorEol: c.majorEol,
      patchEol: c.patchEol,
      bucket,
    }
  })

  return {
    reference: { today: isoDay(today), lastVerified: catalogue.lastVerified },
    partition,
    cumulative,
    rawUnknown: [...rawUnknownCounts].map(([osString, count]) => ({ osString, count })),
    nodes: { hosts, partition: nodeCounts },
  }
}
