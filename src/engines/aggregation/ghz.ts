/**
 * GHz primitives — ported from vsizer `engines/aggregation/ghz.ts` with the
 * brand retrofit (the ONE worked example, 02-PATTERNS §ghz.ts):
 * brand on the boundary → `x as number` for arithmetic → re-wrap via the
 * `units` constructor.
 *
 * DRY (Pitfall 7): vsizer's own `mhzToGhz` is NOT ported — `@/engines/units`
 * already owns it. Two `mhzToGhz` definitions in src/ is the DRY violation
 * PROJECT.md forbids. Only the composite helpers live here.
 */
import { type Cores, type GHz, ghz, type MHz } from '@/engines/units'

/**
 * Total physical GHz a host advertises: nominal CPU speed × physical cores.
 * Inputs are `MHz` / `Cores`; the result is branded `GHz`.
 */
export const physicalGhz = (speedMhz: MHz, cores: Cores): GHz =>
  ghz(((speedMhz as number) * (cores as number)) / 1000)

/**
 * GHz consumed by a host: physical capacity scaled by its mean CPU
 * utilization ratio (0..1 — bare `number` by design, not branded).
 */
export const consumedGhz = (speedMhz: MHz, cores: Cores, cpuRatio: number): GHz =>
  ghz((physicalGhz(speedMhz, cores) as number) * cpuRatio)
