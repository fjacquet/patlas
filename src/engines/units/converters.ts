import { BYTES_PER_MIB, GIB_PER_TIB, MHZ_PER_GHZ, MIB_PER_GIB } from './constants'
import {
  type Bytes,
  bytes,
  type GHz,
  type GiB,
  ghz,
  gib,
  type MHz,
  type MiB,
  type TiB,
  tib,
} from './types'

// Pure functions. No I/O. No mutation. No exceptions. NaN-in → NaN-out.
// CRITICAL: never multiply by the SI MB→MiB inflation factor (1_048_576 /
// 1_000_000). RVTools "MB" is already base-2 MiB — see ADR-0010.

export const mibToGib = (n: MiB): GiB => gib(n / MIB_PER_GIB)
export const gibToTib = (n: GiB): TiB => tib(n / GIB_PER_TIB)
export const mibToTib = (n: MiB): TiB => tib(n / (MIB_PER_GIB * GIB_PER_TIB))
export const mibToBytes = (n: MiB): Bytes => bytes(n * BYTES_PER_MIB)
export const mhzToGhz = (n: MHz): GHz => ghz(n / MHZ_PER_GHZ)
