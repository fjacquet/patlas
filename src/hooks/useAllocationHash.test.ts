import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_RATIOS, parseAllocHash, useAllocationHash } from './useAllocationHash'

describe('parseAllocHash — bounded-regex codec (ALC / Security V5)', () => {
  it('empty / absent hash → defaults {cpu:4, ram:1}', () => {
    expect(parseAllocHash('')).toEqual(DEFAULT_RATIOS)
    expect(parseAllocHash('#')).toEqual(DEFAULT_RATIOS)
  })

  it('well-formed hash parses', () => {
    expect(parseAllocHash('#alloc=cpu:8,ram:1.25')).toEqual({ cpu: 8, ram: 1.25 })
    expect(parseAllocHash('alloc=cpu:1,ram:0.5')).toEqual({ cpu: 1, ram: 0.5 })
  })

  it('out-of-bounds values clamp to slider range (CPU 1–16 / RAM 0.5–4)', () => {
    expect(parseAllocHash('#alloc=cpu:99,ram:99')).toEqual({ cpu: 16, ram: 4 })
    // A leading '-' makes the strict regex fail entirely → safe default.
    expect(parseAllocHash('#alloc=cpu:-3,ram:-3')).toEqual(DEFAULT_RATIOS)
  })

  it('malformed / injection / oversized → defaults (no eval, no JSON.parse)', () => {
    expect(parseAllocHash('#alloc=<script>alert(1)</script>')).toEqual(DEFAULT_RATIOS)
    expect(parseAllocHash('#alloc=cpu:4')).toEqual(DEFAULT_RATIOS)
    expect(parseAllocHash('#alloc=cpu:4,ram:1;DROP TABLE')).toEqual(DEFAULT_RATIOS)
    expect(parseAllocHash(`#alloc=cpu:${'9'.repeat(5000)},ram:1`)).toEqual(DEFAULT_RATIOS)
  })

  it('regex is ReDoS-safe — adversarial input returns fast', () => {
    const start = performance.now()
    parseAllocHash(`#alloc=cpu:${'1'.repeat(60)}`)
    expect(performance.now() - start).toBeLessThan(50)
  })
})

describe('useAllocationHash — URL-hash-only state (ALC-03 / privacy)', () => {
  beforeEach(() => {
    history.replaceState(null, '', `${window.location.pathname}`)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('first load with no hash → defaults', () => {
    const { result } = renderHook(() => useAllocationHash())
    expect(result.current[0]).toEqual(DEFAULT_RATIOS)
  })

  it('setRatios writes the hash via replaceState and NEVER localStorage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useAllocationHash())
    act(() => result.current[1]({ cpu: 8, ram: 2 }))
    expect(window.location.hash).toBe('#alloc=cpu:8,ram:2')
    expect(result.current[0]).toEqual({ cpu: 8, ram: 2 })
    expect(setItem).not.toHaveBeenCalled()
  })

  it('setRatios clamps out-of-range input before writing', () => {
    const { result } = renderHook(() => useAllocationHash())
    act(() => result.current[1]({ cpu: 999, ram: 0.01 }))
    expect(result.current[0]).toEqual({ cpu: 16, ram: 0.5 })
    expect(window.location.hash).toBe('#alloc=cpu:16,ram:0.5')
  })

  it('restores from an existing hash on mount (reload survival)', () => {
    history.replaceState(null, '', '#alloc=cpu:10,ram:1.5')
    const { result } = renderHook(() => useAllocationHash())
    expect(result.current[0]).toEqual({ cpu: 10, ram: 1.5 })
  })
})
