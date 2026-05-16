// Test-only helper: narrow an array element under
// `noUncheckedIndexedAccess` without scattering non-null assertions.
// Lives under src/test/ so it is outside every coverage `include` glob.
export const first = <T>(xs: readonly T[]): T => {
  const x = xs[0]
  if (x === undefined) throw new Error('expected at least one element')
  return x
}
