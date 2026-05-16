import { describe, expect, it } from 'vitest'
import { classifyOsFamily } from './osFamily'

describe('classifyOsFamily', () => {
  it('classifies Windows / Microsoft strings as windows', () => {
    expect(classifyOsFamily('Microsoft Windows Server 2019 (64-bit)', '')).toBe('windows')
    expect(classifyOsFamily('', 'Windows 10')).toBe('windows')
  })

  it('classifies the linux bank as linux', () => {
    for (const os of [
      'Ubuntu Linux (64-bit)',
      'Red Hat Enterprise Linux 9',
      'CentOS 7',
      'SUSE Linux Enterprise',
      'Debian GNU/Linux 12',
      'Oracle Linux',
      'Rocky Linux',
      'VMware Photon OS',
    ]) {
      expect(classifyOsFamily(os, '')).toBe('linux')
    }
  })

  it('returns other for anything else (a real bucket, never thrown)', () => {
    expect(classifyOsFamily('FreeBSD 13', '')).toBe('other')
    expect(classifyOsFamily('', '')).toBe('other')
  })

  it('prefers osConfig, falls back to osTools', () => {
    expect(classifyOsFamily('', 'Red Hat Enterprise Linux')).toBe('linux')
    expect(classifyOsFamily('Microsoft Windows', 'Ubuntu Linux')).toBe('windows')
  })
})
