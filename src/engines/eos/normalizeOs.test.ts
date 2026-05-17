import { describe, expect, it } from 'vitest'
import { REAL_OS_STRINGS } from './fixtures/real-os-strings'
import { normalizeOs } from './normalizeOs'

// Strings the normalizer is EXPECTED to leave unresolved (→ first-class
// unknown bucket, D-10). This is the honest long tail per 07-RESEARCH
// Pitfall 2: versionless, multi-version range, nested-ESXi-guest (Pitfall 6),
// appliance, and unrecognized forms. Everything NOT in this set must resolve.
const EXPECTED_UNKNOWN = new Set<string>([
  'CentOS 4/5 (64-bit)',
  'CentOS 4/5/6/7 (64-bit)',
  'CentOS 4/5/6 (64-bit)',
  'SUSE openSUSE (64-bit)',
  'Ubuntu Linux (64-bit)',
  'Other (64-bit)',
  'Other (32-bit)',
  'Other Linux (64-bit)',
  'Other 3.x or later Linux (64-bit)',
  'Other 2.6.x Linux (64-bit)',
  'Other 3.x Linux (64-bit)',
  'Other 4.x or later Linux (64-bit)',
  'Other 4.x Linux (64-bit)',
  'Other 5.x Linux (64-bit)',
  'VMware Photon OS (64-bit)',
  'VMware ESXi 6.5 or later',
  'VMware ESXi 6.x',
  'VMware ESXi 8.0 or later',
  'FreeBSD (32-bit)',
  'FreeBSD Pre-11 versions (32-bit)',
  'Rocky Linux (64-bit)',
  'AlmaLinux (64-bit)',
  'FortiManager-VM64 v7.4.6-build2588 241218 (GA.M)',
  'FortiAnalyzer-VM64 v7.4.8-build2744 250926 (GA.M)',
])

describe('normalizeOs — RHEL 8 four variants (D-12 case-insensitive)', () => {
  it('all four RHEL-8 forms normalize to (rhel, 8)', () => {
    for (const s of [
      'Red Hat Enterprise Linux 8 (64-bit)',
      'Red Hat Enterprise Linux 8.10',
      'RHEL 8 (64-bit)',
      'redhat enterprise linux 8',
    ]) {
      expect(normalizeOs(s)).toEqual({ slug: 'rhel', version: '8' })
    }
  })
})

describe('normalizeOs — Oracle Linux three variants', () => {
  it('all three Oracle-Linux forms normalize to (oracle-linux, 8)', () => {
    for (const s of ['Oracle Linux 8', 'Oracle Enterprise Linux 8', 'Oracle Linux Server 8.10']) {
      expect(normalizeOs(s)).toEqual({ slug: 'oracle-linux', version: '8' })
    }
  })
})

describe('normalizeOs — other positive cases', () => {
  it('Windows Server / Debian resolve to their catalogue slug+version', () => {
    expect(normalizeOs('Microsoft Windows Server 2012 (64-bit)')).toEqual({
      slug: 'windows-server',
      version: '2012',
    })
    expect(normalizeOs('Debian GNU/Linux 12 (64-bit)')).toEqual({
      slug: 'debian',
      version: '12',
    })
  })
})

describe('normalizeOs — versionless / multi-version / range → null (D-10)', () => {
  it('returns null for the honest unknown long tail', () => {
    for (const s of [
      'Other (64-bit)',
      'Other 3.x or later Linux (64-bit)',
      'CentOS 4/5/6/7 (64-bit)',
      'Ubuntu Linux (64-bit)',
      'VMware ESXi 6.5 or later',
    ]) {
      expect(normalizeOs(s)).toBeNull()
    }
  })
})

describe('normalizeOs — D-12 raw string never mutated', () => {
  it('matches despite irregular whitespace and does not return the raw input', () => {
    const raw = '  Red Hat   Enterprise  Linux 8   '
    const before = raw
    expect(normalizeOs(raw)).toEqual({ slug: 'rhel', version: '8' })
    expect(raw).toBe(before) // caller preserves verbatim — normalizeOs never mutates
  })
})

describe('normalizeOs — coverage on the real harvested fixture', () => {
  it('every non-long-tail string resolves; every long-tail string is null (per-distinct partition)', () => {
    const wronglyUnknown: string[] = []
    const wronglyMatched: string[] = []
    for (const s of REAL_OS_STRINGS) {
      const r = normalizeOs(s)
      if (EXPECTED_UNKNOWN.has(s)) {
        if (r !== null) wronglyMatched.push(`${s} → ${JSON.stringify(r)}`)
      } else if (r === null) {
        wronglyUnknown.push(s)
      }
    }
    expect(
      wronglyUnknown,
      `matchable strings the bank failed to resolve:\n${wronglyUnknown.join('\n')}`,
    ).toEqual([])
    expect(
      wronglyMatched,
      `long-tail strings wrongly force-fit:\n${wronglyMatched.join('\n')}`,
    ).toEqual([])
  })

  it('occurrence-weighted unknown rate <5% on a realistic estate distribution (RESEARCH A4)', () => {
    // RESEARCH Pitfall 2 / A4: the <5% target is occurrence-weighted on a
    // realistic estate where the matchable forms (Windows Server, RHEL,
    // CentOS, Debian, SLES) dominate the COUNT; the unknown residue is the
    // rare long tail. The distinct fixture deliberately over-represents the
    // tail to exercise the unknown bucket — it is NOT the <5% denominator.
    const WEIGHTED: { os: string; count: number }[] = [
      { os: 'Microsoft Windows Server 2019 (64-bit)', count: 320 },
      { os: 'Microsoft Windows Server 2022 (64-bit)', count: 210 },
      { os: 'Microsoft Windows Server 2016 (64-bit)', count: 140 },
      { os: 'Red Hat Enterprise Linux 8 (64-bit)', count: 180 },
      { os: 'Red Hat Enterprise Linux 9 (64-bit)', count: 90 },
      { os: 'CentOS 7 (64-bit)', count: 70 },
      { os: 'Debian GNU/Linux 12 (64-bit)', count: 55 },
      { os: 'SUSE Linux Enterprise 15 (64-bit)', count: 40 },
      { os: 'Oracle Linux 8', count: 25 },
      { os: 'Microsoft Windows 10 (64-bit)', count: 20 },
      // rare long tail (realistically a small slice of a real estate)
      { os: 'Ubuntu Linux (64-bit)', count: 12 },
      { os: 'Other (64-bit)', count: 6 },
      { os: 'VMware Photon OS (64-bit)', count: 4 },
      { os: 'FreeBSD (32-bit)', count: 2 },
    ]
    const total = WEIGHTED.reduce((a, w) => a + w.count, 0)
    const unknown = WEIGHTED.filter((w) => normalizeOs(w.os) === null).reduce(
      (a, w) => a + w.count,
      0,
    )
    const rate = unknown / total
    expect(
      rate,
      `occurrence-weighted unknown rate ${(rate * 100).toFixed(2)}% (want <5%)`,
    ).toBeLessThan(0.05)
  })
})
