import { describe, expect, it } from 'vitest'
import { CONTENTION_THRESHOLDS, TOP_N_DEFAULT } from './contention'

describe('contention constants', () => {
  it('CONTENTION_THRESHOLDS matches the VMware sizing-guide values', () => {
    expect(CONTENTION_THRESHOLDS.warning).toBe(5)
    expect(CONTENTION_THRESHOLDS.serious).toBe(10)
  })

  it('TOP_N_DEFAULT is 10', () => {
    expect(TOP_N_DEFAULT).toBe(10)
  })
})
