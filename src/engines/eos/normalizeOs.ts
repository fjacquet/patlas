import { classifyOsFamily } from '@/engines/aggregation/osFamily'

/**
 * RVTools guest-OS string → endoflife.date `{ slug, version }` — pure,
 * Zod-free, dependency-free. Finer than `classifyOsFamily` (which it
 * COMPOSES as the coarse gate — DRY, never re-implements the windows/linux
 * family regexes). Matching is case-insensitive and whitespace-normalized
 * for MATCHING ONLY; the raw RVTools string is never mutated or returned
 * (D-12 — the caller preserves it verbatim for the unknown list).
 *
 * Anything without a single resolvable catalogue version returns `null` and
 * lands in the first-class unknown bucket (D-10) — never force-fit:
 *  - multi-version range strings ("CentOS 4/5/6/7") → unknown (Pitfall 3, A3):
 *    collapsing several guest-OS generations to one EOL would fabricate a
 *    verdict (violates D-00). Surfaced verbatim so the maintainer sees it.
 *  - versionless forms ("Ubuntu Linux", "Rocky Linux", "AlmaLinux") →
 *    unknown: RVTools carries no catalogue-keyable version for them.
 *  - "VMware ESXi … or later / 6.x" guest rows are nested-ESXi VMs, not
 *    hosts (Pitfall 6, D-09a/b) → unknown in the VM partition; real host
 *    EOS is handled separately by classifyEsxi against vhost.esxVersion.
 */

const MULTI_VERSION = /\d+\s*\/\s*\d+/

const RULES: {
  slug: string
  re: RegExp
  ver: (m: RegExpMatchArray) => string | null
}[] = [
  {
    slug: 'rhel',
    re: /red\s*hat\s*enterprise\s*linux\s*(\d+)|^rhel\s*(\d+)/i,
    ver: (m) => m[1] ?? m[2] ?? null,
  },
  {
    slug: 'oracle-linux',
    re: /oracle\s*(?:enterprise\s*)?linux(?:\s*server)?\s*(\d+)/i,
    ver: (m) => m[1] ?? null,
  },
  // CentOS: LXC template "centos-7-default" or bare "CentOS 7 (64-bit)"
  { slug: 'centos', re: /cent[-\s]*os[-\s]*(\d+)/i, ver: (m) => m[1] ?? null },
  // AlmaLinux: LXC template "almalinux-9-default" or bare "AlmaLinux 9"
  { slug: 'almalinux', re: /alma\s*linux[-\s]*(\d+)/i, ver: (m) => m[1] ?? null },
  // Rocky Linux: LXC template "rockylinux-9-default" or bare "Rocky Linux 9"
  { slug: 'rocky-linux', re: /rocky[-\s]*linux[-\s]*(\d+)/i, ver: (m) => m[1] ?? null },
  // Debian: RVTools "Debian GNU/Linux 12 (64-bit)", Proxmox QEMU "Debian 12",
  // Proxmox LXC template "debian-12-standard"
  {
    slug: 'debian',
    re: /debian[-\s](?:gnu\/linux[-\s])?(\d+)/i,
    ver: (m) => m[1] ?? null,
  },
  { slug: 'sles', re: /suse\s*linux\s*enterprise\s*(\d+)/i, ver: (m) => m[1] ?? null },
  // Ubuntu: extract "NN.NN" when present (Proxmox QEMU "Ubuntu 22.04",
  // LXC template "ubuntu-22.04-standard"); versionless forms → null (D-10)
  {
    slug: 'ubuntu',
    re: /ubuntu[-\s]*(\d+\.\d+)?/i,
    ver: (m) => m[1] ?? null,
  },
  {
    slug: 'windows-server',
    re: /windows\s*server\s*(\d{4}(?:\s*r2)?)/i,
    ver: (m) => m[1]?.replace(/\s+/, ' ') ?? null,
  },
  { slug: 'windows', re: /windows\s*(\d+|xp|vista|2000)/i, ver: (m) => m[1] ?? null },
]

export function normalizeOs(raw: string): { slug: string; version: string } | null {
  const norm = raw.replace(/\s+/g, ' ').trim()

  // Multi-version range ("CentOS 4/5/6/7") is not determinable to a single
  // EOL → first-class unknown (Pitfall 3). Checked before the bank so the
  // bare \d+ capture cannot silently pick one generation.
  if (MULTI_VERSION.test(norm)) return null

  for (const r of RULES) {
    const m = norm.match(r.re)
    if (m) {
      const version = r.ver(m)
      return version === null ? null : { slug: r.slug, version }
    }
  }

  // Coarse gate (DRY — compose, do not re-implement the family regexes).
  // No slug rule matched: the family is informational only; an unmatched
  // string is honestly unknown regardless of windows/linux/other.
  classifyOsFamily(norm, '')
  return null
}
