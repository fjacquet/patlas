/**
 * VMware-standard CPU Ready (contention) thresholds, expressed as
 * percentages (0..100). Ported verbatim from vsizer `contention.ts`.
 *
 *   < `warning` (5 %)            → no notable scheduling pressure
 *   `warning`..`serious` (5..10) → scheduling pressure worth surfacing
 *   > `serious` (10 %)           → sustained scheduling pressure
 *
 * Single source of truth shared by `vinfoMerge.ts:readinessStats` (counts
 * "VMs above warning") and `perEsx.ts` (same helper, DRY).
 *
 * Per ADR-0003 these are **status** thresholds, not verdicts. No code
 * appends "warning"/"bad"/"critical" adjectives to rendered output.
 * See ADR-0012 for the full rationale.
 */
export const CONTENTION_THRESHOLDS = {
  warning: 5,
  serious: 10,
} as const

/**
 * Default size of the per-cluster "top contended VMs" list, consumed by
 * `topReadinessVmsByCluster`.
 */
export const TOP_N_DEFAULT = 10
