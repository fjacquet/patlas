/**
 * Public surface of the DR-simulation engine. `useEstateView` calls
 * `runScenario` inside the project's single `useMemo` (via
 * `buildEstateView`). Mirrors the `engines/aggregation/index.ts` barrel.
 */
export { survivorVerdict, type Verdict } from './allocate'
export { runScenario } from './runScenario'
