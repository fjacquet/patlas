// Branded number types — runtime is a plain `number`; the brand is a
// compile-time discriminator only. The constructors below are the single
// sanctioned location for each `as` cast. KISS: no helper library, no `uuid`,
// no Zod (engines stay Zod-free — see 01-RESEARCH.md A8; Zod lives only at the
// parser boundary in plan 01-04).

export type MiB = number & { readonly __brand: 'MiB' }
export type GiB = number & { readonly __brand: 'GiB' }
export type TiB = number & { readonly __brand: 'TiB' }
export type Bytes = number & { readonly __brand: 'Bytes' }
export type MHz = number & { readonly __brand: 'MHz' }
export type GHz = number & { readonly __brand: 'GHz' }
export type Cores = number & { readonly __brand: 'Cores' }
export type Sockets = number & { readonly __brand: 'Sockets' }

export const mib = (n: number): MiB => n as MiB
export const gib = (n: number): GiB => n as GiB
export const tib = (n: number): TiB => n as TiB
export const bytes = (n: number): Bytes => n as Bytes
export const mhz = (n: number): MHz => n as MHz
export const ghz = (n: number): GHz => n as GHz
export const cores = (n: number): Cores => n as Cores
export const sockets = (n: number): Sockets => n as Sockets
