/**
 * Storage slide — VM-storage KPI cards (real used / capacity in readable TiB)
 * plus a per-role breakdown table (Role · Used · Capacity · Free). cv4pve
 * datastores split into VM data / backup / node-local roles; a few PBS backup
 * repos routinely dwarf VM storage, so a single "capacity" figure misleads.
 * Used comes from the Storages sheet — never the always-zero per-VM "Disk
 * Usage GB". Brand-free (navy/gold/grey).
 */
import type PptxGenJS from 'pptxgenjs'
import type { EstateView } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxMemMib, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { drawKpiCard } from '../primitives/draw'
import { addHeader, CONTENT_W, M } from './_layout'

export function addStorageSlide(
  pptx: PptxGenJS,
  view: EstateView,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const e = view.storage.estate
  const vm = view.storage.byRole.find((g) => g.role === 'vmdata')
  const t = (k: string, fallback: string) => strings[`storage.${k}`] ?? fallback
  const y = addHeader(s, t('title', 'Storage'))

  const gap = 0.15
  const cw = (CONTENT_W - gap * 3) / 4
  // VM data leads, used before capacity (per the "used / capacity" framing).
  const cards = [
    { big: pptxMemMib(Number(vm?.usedMib ?? 0), locale), small: t('vmUsed', 'VM used') },
    {
      big: pptxMemMib(Number(vm?.capacityMib ?? 0), locale),
      small: t('vmCapacity', 'VM capacity'),
    },
    { big: pptxMemMib(Number(e.provisionedMib), locale), small: t('vmAllocated', 'VM allocated') },
    {
      big: pptxNumber(view.flags.counts.ds + view.flags.counts.lu, locale),
      small: t('flagged', 'Flagged storages'),
    },
  ]
  cards.forEach((c, i) => {
    drawKpiCard(s, { x: M + i * (cw + gap), y, w: cw, h: 1.05, big: c.big, small: c.small })
  })

  // Per-role breakdown (VM data / backup / local / other) — used before
  // capacity. Real datastore usage from the Storages sheet.
  const rows = view.storage.byRole.map((g) => ({
    role: t(`role.${g.role}`, g.role),
    used: Number(g.usedMib),
    cap: Number(g.capacityMib),
    free: Number(g.freeMib),
  }))

  const tableY = y + 1.4
  const colW = CONTENT_W
  const c1 = M
  const c2 = M + colW * 0.4
  const c3 = M + colW * 0.6
  const c4 = M + colW * 0.8
  const head = (x: number, w: number, txt: string, align: 'left' | 'right') =>
    s.addText(pptxSafeFormat(txt), {
      x,
      y: tableY,
      w,
      h: 0.3,
      fontFace: 'Arial',
      fontSize: 11,
      bold: true,
      color: PPTX_COLORS.inkMuted,
      align,
      margin: 0,
    })
  head(c1, colW * 0.4, t('colRole', 'Role'), 'left')
  head(c2, colW * 0.2 - 0.1, t('colUsed', 'Used'), 'right')
  head(c3, colW * 0.2 - 0.1, t('colCapacity', 'Capacity'), 'right')
  head(c4, colW * 0.2, t('colFree', 'Free'), 'right')
  s.addShape('rect', {
    x: M,
    y: tableY + 0.32,
    w: CONTENT_W,
    h: 0.012,
    fill: { color: PPTX_COLORS.hairline },
    line: { type: 'none' },
  })

  const rowH = 0.34
  rows.forEach((r, i) => {
    const ry = tableY + 0.42 + i * rowH
    s.addText(pptxSafeFormat(r.role), {
      x: c1,
      y: ry,
      w: colW * 0.4,
      h: rowH,
      fontFace: 'Arial',
      fontSize: 11,
      color: PPTX_COLORS.ink,
      margin: 0,
    })
    const numCell = (x: number, w: number, value: number) =>
      s.addText(pptxMemMib(value, locale), {
        x,
        y: ry,
        w,
        h: rowH,
        fontFace: 'Consolas',
        fontSize: 11,
        color: PPTX_COLORS.ink,
        align: 'right',
        margin: 0,
      })
    numCell(c2, colW * 0.2 - 0.1, r.used)
    numCell(c3, colW * 0.2 - 0.1, r.cap)
    numCell(c4, colW * 0.2, r.free)
  })
}
