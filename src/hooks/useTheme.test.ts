import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useTheme } from './useTheme'

const STORAGE_KEY = 'patlas-theme'

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('defaults to `auto` preference when localStorage is empty', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.preference).toBe('auto')
  })

  it('reads a stored `dark` preference from localStorage[patlas-theme]', () => {
    localStorage.setItem(STORAGE_KEY, 'dark')
    const { result } = renderHook(() => useTheme())
    expect(result.current.preference).toBe('dark')
    expect(result.current.resolved).toBe('dark')
  })

  it('setPreference(dark) writes to localStorage and adds the dark class', () => {
    const { result } = renderHook(() => useTheme())
    act(() => {
      result.current.setPreference('dark')
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('setPreference(light) removes the dark class', () => {
    document.documentElement.classList.add('dark')
    const { result } = renderHook(() => useTheme())
    act(() => {
      result.current.setPreference('light')
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('setPreference(auto) removes the persisted key', () => {
    localStorage.setItem(STORAGE_KEY, 'dark')
    const { result } = renderHook(() => useTheme())
    act(() => {
      result.current.setPreference('auto')
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(result.current.preference).toBe('auto')
  })

  it('auto preference resolves via matchMedia', () => {
    // The matchMedia stub in src/test/setup.ts returns `matches: false`, so
    // auto resolves to `light`.
    const { result } = renderHook(() => useTheme())
    expect(result.current.preference).toBe('auto')
    expect(result.current.resolved).toBe('light')
  })
})
