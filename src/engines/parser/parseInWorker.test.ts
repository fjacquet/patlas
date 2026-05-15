import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * jsdom can't drive a real module Worker, so we stub the global `Worker`
 * constructor. This exercises `parseInWorker`'s main-thread half: the
 * singleton, the transferable post, and the ok/err response branches.
 */

type Listener = (e: MessageEvent) => void

class FakeWorker {
  static instances = 0
  static lastResponse: unknown = { kind: 'ok', snapshot: { vinfo: [] }, warnings: [] }
  listeners = new Set<Listener>()
  posted: unknown[] = []
  constructor(_url: URL, _opts: unknown) {
    FakeWorker.instances += 1
  }
  addEventListener(_type: 'message', cb: Listener) {
    this.listeners.add(cb)
  }
  removeEventListener(_type: 'message', cb: Listener) {
    this.listeners.delete(cb)
  }
  postMessage(msg: unknown, _transfer?: unknown[]) {
    this.posted.push(msg)
    queueMicrotask(() => {
      for (const cb of [...this.listeners]) {
        cb({ data: FakeWorker.lastResponse } as MessageEvent)
      }
    })
  }
}

vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker)

const file = (name = 'x.xlsx') =>
  ({
    name,
    lastModified: 123,
    arrayBuffer: async () => new ArrayBuffer(8),
  }) as unknown as File

afterEach(() => {
  vi.resetModules()
  FakeWorker.instances = 0
})

describe('parseInWorker', () => {
  it('resolves with snapshot + warnings on a kind:ok response', async () => {
    FakeWorker.lastResponse = {
      kind: 'ok',
      snapshot: { vinfo: [{ vmName: 'a' }] },
      warnings: [{ sheet: 'vDatastore', kind: 'missing-sheet', message: 'm' }],
    }
    const { parseInWorker } = await import('./parseInWorker')
    const out = await parseInWorker(file())
    expect(out.snapshot).toMatchObject({ vinfo: [{ vmName: 'a' }] })
    expect(out.warnings).toHaveLength(1)
  })

  it('reuses one worker across multiple parses (singleton)', async () => {
    FakeWorker.lastResponse = { kind: 'ok', snapshot: {}, warnings: [] }
    const { parseInWorker } = await import('./parseInWorker')
    await parseInWorker(file('a.xlsx'))
    await parseInWorker(file('b.xlsx'))
    expect(FakeWorker.instances).toBe(1)
  })

  it('rejects with a named Error carrying sheet/kind on a kind:err response', async () => {
    FakeWorker.lastResponse = {
      kind: 'err',
      error: {
        name: 'ParseError',
        message: 'missing sheet: vInfo (workbook contained: vHost)',
        sheet: 'vInfo',
        kind: 'missing-sheet',
      },
    }
    const { parseInWorker } = await import('./parseInWorker')
    await expect(parseInWorker(file())).rejects.toMatchObject({
      name: 'ParseError',
      message: /missing sheet: vInfo/,
      sheet: 'vInfo',
      kind: 'missing-sheet',
    })
  })
})
