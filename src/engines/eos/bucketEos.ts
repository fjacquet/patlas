import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import type { EosCatalogue } from './catalogueSchema'
import { classifyEsxi } from './classifyEsxi'
import { normalizeOs } from './normalizeOs'

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

export type EosBucketKey = 'overdue' | 'w3' | 'w3to6' | 'w6to9' | 'w9to12' | 'beyond12' | 'unknown'

export interface EosRow {
  vmName: string
  cluster: string
  host: string
  /** Raw RVTools OS string, preserved verbatim (D-12). */
  os: string
  slug: string | null
  version: string | null
  eolFrom: string | null
  bucket: EosBucketKey
}

export interface EsxiHostRow {
  hostName: string
  esxVersion: string
  major: string | null
  majorEol: string | null
  patchEol: null
  bucket: EosBucketKey
}

export interface EosProjection {
  reference: { today: string; lastVerified: string }
  partition: Record<EosBucketKey, EosRow[]>
  cumulative: {
    overdue: number
    le3: number
    le6: number
    le9: number
    le12: number
    unknown: number
  }
  rawUnknown: { osString: string; count: number }[]
  esxi: { hosts: EsxiHostRow[]; partition: Record<EosBucketKey, number> }
}

function isoDay(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** UTC ms `n` calendar months after `today` — clock-free (Pitfall 4). */
function monthsAfter(today: Date, n: number): number {
  const total = today.getUTCMonth() + n
  const year = today.getUTCFullYear() + Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  return Date.UTC(year, month, today.getUTCDate())
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
  vinfo: VInfoRow[]
  vhost: VHostRow[]
  catalogue: EosCatalogue
  today: Date
}): EosProjection {
  const { vinfo, vhost, catalogue, today } = args
  const todayMs = today.getTime()
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

  const esxiCounts: Record<EosBucketKey, number> = {
    overdue: 0,
    w3: 0,
    w3to6: 0,
    w6to9: 0,
    w9to12: 0,
    beyond12: 0,
    unknown: 0,
  }
  const hosts: EsxiHostRow[] = vhost.map((h) => {
    const c = classifyEsxi(h.esxVersion, catalogue)
    const bucket = bucketFor(c.majorEol, todayMs, m)
    esxiCounts[bucket] += 1
    return {
      hostName: h.hostName,
      esxVersion: h.esxVersion,
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
    esxi: { hosts, partition: esxiCounts },
  }
}
