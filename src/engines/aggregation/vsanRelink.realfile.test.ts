import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSnapshot } from '@/engines/parser/normalizeColumns'
import { parseXlsx } from '@/engines/parser/parseXlsx'
import { relinkBlankClusterDatastores } from './vsanRelink'

/**
 * P9 D-09 — the MANDATORY real-file vSAN relink validation gate (the
 * STR-04 regression guard). The binding project memory
 * (`rvtools-vdatastore-hosts-is-count`) and 09-CONTEXT §D-09 are explicit:
 * unit tests alone are INSUFFICIENT — the relink must be proven on a real
 * RVTools workbook with blank-`Cluster name` datastores. A resolved count
 * of 0 on this file is the exact STR-04 failure mode and MUST fail.
 *
 * Env-guarded (the `canary.test.ts` real-file pattern): asserts when the
 * named workbook is present locally; skips gracefully with a logged reason
 * in CI / on machines without it (never fails CI for absence).
 */
const REAL_FILE = join(
  homedir(),
  'Library/CloudStorage/OneDrive-Home/20260430_1400_allvCenters.xlsx',
)

const present = existsSync(REAL_FILE)

;(present ? describe : describe.skip)(
  'vSAN relink — real-file STR-04 regression guard (20260430_1400_allvCenters.xlsx)',
  () => {
    if (!present) {
      // eslint-disable-next-line no-console
      console.warn(
        `[vsanRelink.realfile] SKIPPED — ${REAL_FILE} not present (expected in CI / on machines without the real workbook).`,
      )
    }

    it('resolves a NON-ZERO count of blank-cluster datastores (a count of 0 is the STR-04 failure)', () => {
      const buf = readFileSync(REAL_FILE)
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
      const { snapshot } = parseSnapshot(parseXlsx(ab))
      const res = relinkBlankClusterDatastores(snapshot.vinfo, snapshot.vdatastore)

      // (a) STR-04 closure: a non-zero lower bound (NOT a brittle exact
      // count — empirically ≈25 distinct blank-cluster datastores resolve).
      expect(res.attributed.size).toBeGreaterThan(0)
      // The vInfo.Path single-source map is populated (the relink ran).
      expect(res.datastoreVms.size).toBeGreaterThan(0)

      // (b) D-10 shared-LUN: every shared entry spans >1 cluster and is
      // EXCLUDED from the single-cluster `attributed` map (no allocation
      // guess, no double-count). Empirically ≈1 such datastore.
      for (const [key, count] of res.shared) {
        expect(count).toBeGreaterThan(1)
        expect(res.attributed.has(key)).toBe(false)
      }

      // (c) unrelinkable blank-cluster datastores stay estate-only — never
      // fabricated onto a cluster (no key in both unrelinkable + attributed).
      for (const key of res.unrelinkable) {
        expect(res.attributed.has(key)).toBe(false)
        expect(res.shared.has(key)).toBe(false)
      }

      // eslint-disable-next-line no-console
      console.info(
        `[vsanRelink.realfile] resolved=${res.attributed.size} shared=${res.shared.size} unrelinkable=${res.unrelinkable.size} (STR-04 guard PASS)`,
      )
    })
  },
)
