/**
 * Public surface of the trends engine. The single `buildEstateView` pass
 * imports `buildTrendSeries` from here; nothing else reaches into the
 * private modules (mirrors `engines/aggregation/index.ts`).
 */
export { buildTrendSeries } from './buildTrendSeries'
export { type CaptureOrdinal, captureDateOrdinal } from './captureDateOrdinal'
