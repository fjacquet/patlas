import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const parseInWorkerMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('@/engines/parser', () => ({
  parseInWorker: (file: File) => parseInWorkerMock(file),
}))

vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
}))

import { useSnapshotStore } from '@/store/snapshotStore'
import { useSnapshotUpload } from './useSnapshotUpload'

const makeFile = (name: string) =>
  new File([new Uint8Array([1, 2, 3])], name, { type: 'application/octet-stream' })

const okPayload = (filename: string) => ({
  snapshot: {
    filename,
    fileSize: 3,
    capturedAt: new Date('2026-05-15T00:00:00Z'),
    vCenterLabel: 'vcenter.test.local',
    rvtoolsVersion: '4.4.0',
    source: 'rvtools' as const,
    viSdkUuid: null,
    vinfo: [],
    vhost: [],
    vdatastore: [],
    vpartition: [],
    parseErrors: [],
  },
  warnings: [],
})

describe('useSnapshotUpload', () => {
  beforeEach(() => {
    useSnapshotStore.getState().clearAll()
    parseInWorkerMock.mockReset()
    toastErrorMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('early-returns on an empty files array (no parse, no store change)', async () => {
    const { result } = renderHook(() => useSnapshotUpload())
    await act(async () => {
      await result.current.upload([])
    })
    expect(parseInWorkerMock).not.toHaveBeenCalled()
    expect(useSnapshotStore.getState().snapshots.size).toBe(0)
  })

  it('parses one file, stamps a UUID + parsedAt, and adds it to the store', async () => {
    parseInWorkerMock.mockResolvedValueOnce(okPayload('a.xlsx'))
    const { result } = renderHook(() => useSnapshotUpload())
    await act(async () => {
      await result.current.upload([makeFile('a.xlsx')])
    })
    expect(parseInWorkerMock).toHaveBeenCalledTimes(1)
    const store = useSnapshotStore.getState()
    expect(store.snapshots.size).toBe(1)
    const snap = [...store.snapshots.values()][0]
    expect(snap).toBeDefined()
    expect(snap?.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(snap?.parsedAt).toBeInstanceOf(Date)
    expect(snap?.filename).toBe('a.xlsx')
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('isUploading toggles true during the loop then false at the end', async () => {
    let resolveParse: (v: unknown) => void = () => undefined
    parseInWorkerMock.mockImplementationOnce(
      () => new Promise((res) => { resolveParse = res }),
    )
    const { result } = renderHook(() => useSnapshotUpload())
    expect(result.current.isUploading).toBe(false)
    let p: Promise<void>
    act(() => {
      p = result.current.upload([makeFile('a.xlsx')])
    })
    expect(result.current.isUploading).toBe(true)
    await act(async () => {
      resolveParse(okPayload('a.xlsx'))
      await p
    })
    expect(result.current.isUploading).toBe(false)
  })

  it('continues processing after one file fails and toasts the error message', async () => {
    parseInWorkerMock
      .mockResolvedValueOnce(okPayload('good.xlsx'))
      .mockRejectedValueOnce(
        Object.assign(new Error('missing sheet: vInfo (workbook contained: x)'), {
          name: 'ParseError',
        }),
      )
    const { result } = renderHook(() => useSnapshotUpload())
    await act(async () => {
      await result.current.upload([makeFile('good.xlsx'), makeFile('bad.xlsx')])
    })
    expect(parseInWorkerMock).toHaveBeenCalledTimes(2)
    expect(useSnapshotStore.getState().snapshots.size).toBe(1)
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    const call = toastErrorMock.mock.calls[0] ?? []
    const [message, opts] = call
    expect(String(message)).toMatch(/missing sheet: vInfo/)
    expect(opts).toMatchObject({ description: 'bad.xlsx' })
  })
})
