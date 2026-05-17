import type { ClusterAggregate, Verdict } from '@/types/estate'

/**
 * `Verdict` is the factual per-survivor headroom enum — NO color, NO
 * "good/poor" (UI-SPEC §Color / PROJECT.md line 39 denylist). Numbers
 * only; the UI renders the localized enum word next to the figure, never
 * a traffic light. The type lives in `@/types/estate` (engines depend on
 * types, not the reverse); re-exported here for ergonomic local imports.
 */
export type { Verdict }

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

/**
 * PHYSICAL-basis survivor verdict (Phase-6 D-09): the DR survivor
 * headroom judged against PHYSICAL capacity, never vCPU. Load is the
 * physically-consumed resource (`consumedGhz`/`consumedRamMib`);
 * capacity is the PHYSICAL host capacity NET of the stretched DR
 * reservation (`physicalGhz − drReservedGhz`, `physicalRamMib −
 * drReservedRamMib`) — the ratio is NOT re-derived here (the
 * `aggregateClusters` DRY contract holds; the reservation was already
 * baked there). Sibling to `survivorVerdict` so existing measured
 * consumers keep their signature (minimal blast radius).
 */
export const survivorPhysicalVerdict = (
  c: Pick<
    ClusterAggregate,
    'consumedGhz' | 'physicalGhz' | 'drReservedGhz' | 'consumedRamMib' | 'physicalRamMib' | 'drReservedRamMib'
  >,
): Verdict => {
  const cpuCap = (c.physicalGhz as number) - (c.drReservedGhz as number)
  const ramCap = (c.physicalRamMib as number) - (c.drReservedRamMib as number)
  const cpu = band(c.consumedGhz as number, cpuCap)
  const ram = band(c.consumedRamMib as number, ramCap)
  return worse(cpu, ram)
}
