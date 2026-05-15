// Unit conversion constants — NEVER edit without updating
// docs/adr/0010-rvtools-mb-as-mib.md.
//
// `1_048_576` is `1024 * 1024` (base-2 MiB → bytes). FORBIDDEN: the SI MB→MiB
// inflation factor 1.048576 as a multiplicand. RVTools "MB" columns are
// already base-2 MiB; they are reinterpreted, not converted. See ADR-0010 and
// PITFALLS.md Critical-1. Applying that factor would inflate capacity ~4.9%.

export const BYTES_PER_MIB = 1_048_576 as const
export const MIB_PER_GIB = 1_024 as const
export const GIB_PER_TIB = 1_024 as const
export const MHZ_PER_GHZ = 1_000 as const
