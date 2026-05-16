import type { ClusterAggregate } from '@/types/estate'

/**
 * Factual per-survivor headroom verdict — NO color, NO "good/poor"
 * (UI-SPEC §Color / PROJECT.md line 39 denylist). Numbers only; the UI
 * renders the localized enum word next to the figure, never a traffic
 * light.
 */
export type Verdict = 'absorbs' | 'tight' | 'overflows'

const ORDER: Record<Verdict, number> = { absorbs: 0, tight: 1, overflows: 2 }

/** Worse of two verdicts (a survivor tight on RAM but absorbing on CPU is
 *  reported `tight` — the binding constraint wins). */
const worse = (a: Verdict, b: Verdict): Verdict => (ORDER[a] >= ORDER[b] ? a : b)

/**
 * One-resource band (RESEARCH "Allocation headroom verdict" verbatim):
 *   allocated ≤ 0.8·capacity → absorbs
 *   allocated ≤ capacity      → tight
 *   allocated > capacity      → overflows
 * Zero/negative capacity is degenerate: any allocation overflows, none
 * absorbs (no NaN — grade-school arithmetic, no library).
 */
const band = (allocated: number, capacity: number): Verdict => {
  if (capacity <= 0) return allocated > 0 ? 'overflows' : 'absorbs'
  if (allocated <= 0.8 * capacity) return 'absorbs'
  if (allocated <= capacity) return 'tight'
  return 'overflows'
}

/**
 * Combined CPU+RAM verdict for one survivor cluster. Capacity is the
 * ratio-applied `capacityVcpu` / `capacityRamMib` already computed by
 * `aggregateClusters` (DRY — the slider ratios are baked in there, ALC),
 * so this is pure comparison, never re-derives the ratio.
 */
export const survivorVerdict = (
  c: Pick<
    ClusterAggregate,
    'vcpuAllocated' | 'vramAllocatedMib' | 'capacityVcpu' | 'capacityRamMib'
  >,
): Verdict => {
  const cpu = band(c.vcpuAllocated as number, c.capacityVcpu as number)
  const ram = band(c.vramAllocatedMib as number, c.capacityRamMib as number)
  return worse(cpu, ram)
}
