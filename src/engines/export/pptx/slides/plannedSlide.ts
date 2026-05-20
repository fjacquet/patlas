/**
 * Phase 18-03 — Planned vs measured estate, brought to Phase-16 parity with
 * the website's PlannedEstatePanel: measured-vs-planned capacity headroom
 * (vCPU + vRAM) against the constant allocated demand. Brand-free
 * (navy/gold/grey), factual, no editorial verbs. "—" note when plannedView
 * is null.
 */
import type PptxGenJS from 'pptxgenjs'
import type { EstateView } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxMemMib, pptxNumber } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { drawKpiCard } from '../primitives/draw'
import { addHeader, addNote, CONTENT_W, M } from './_layout'

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)

export function addPlannedSlide(
  pptx: PptxGenJS,
  view: EstateView,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const t = (k: string, fallback: string) => strings[`planned.${k}`] ?? fallback
  const y = addHeader(s, t('title', 'Planned vs measured estate'))
  if (view.plannedView === null) {
    addNote(s, t('none', '—'), y)
    return
  }
  const pv = view.plannedView
  const n = (v: number) => pptxNumber(Math.round(v), locale)
  const mCapV = sum(view.clusters.map((c) => Number(c.capacityVcpu)))
  const pCapV = sum(pv.clusters.map((c) => Number(c.capacityVcpu)))
  const allocV = Number(view.globals.vcpuAllocated)
  const mCapR = sum(view.clusters.map((c) => Number(c.capacityRamMib)))
  const pCapR = sum(pv.clusters.map((c) => Number(c.capacityRamMib)))
  const allocR = Number(view.globals.vramAllocatedMib)
  const signed = (v: number) => (v >= 0 ? '+' : '−') + n(Math.abs(v))

  const row = (yy: number, cards: { big: string; small: string; accent?: string }[]) => {
    const gap = 0.15
    const cw = (CONTENT_W - gap * (cards.length - 1)) / cards.length
    cards.forEach((c, i) => {
      drawKpiCard(s, {
        x: M + i * (cw + gap),
        y: yy,
        w: cw,
        h: 1.15,
        big: c.big,
        small: c.small,
        accent: c.accent ?? PPTX_COLORS.primary500,
      })
    })
    return yy + 1.15 + 0.25
  }

  let yy = y + 0.1
  yy = row(yy, [
    { big: n(mCapV), small: t('capMeasured', 'vCPU capacity (measured)') },
    {
      big: n(pCapV),
      small: t('capPlanned', 'vCPU capacity (planned)'),
      accent: PPTX_COLORS.accent,
    },
    { big: n(allocV), small: t('vcpuDemand', 'vCPU allocated (demand)') },
    { big: signed(pCapV - allocV), small: t('headroomPlanned', 'vCPU headroom (planned)') },
  ])
  yy = row(yy, [
    { big: pptxMemMib(mCapR, locale), small: t('ramCapMeasured', 'vRAM capacity (measured)') },
    {
      big: pptxMemMib(pCapR, locale),
      small: t('ramCapPlanned', 'vRAM capacity (planned)'),
      accent: PPTX_COLORS.accent,
    },
    { big: pptxMemMib(allocR, locale), small: t('ramDemand', 'vRAM allocated (demand)') },
    {
      big: pptxMemMib(pCapR - allocR, locale),
      small: t('ramHeadroomPlanned', 'vRAM headroom (planned)'),
    },
  ])
  // Factual ratio echo (no verdict).
  s.addText(
    `${t('vcpuMeasured', 'vCPU:pCPU measured')}: ${pptxNumber(Number(view.globals.vcpuPerPcpu), locale, 1)} · ` +
      `${t('vcpuPlanned', 'vCPU:pCPU planned')}: ${pptxNumber(Number(pv.globals.vcpuPerPcpu), locale, 1)} · ` +
      `${t('vmMeasured', 'VMs measured')}: ${pptxNumber(view.globals.vmCount, locale)} · ` +
      `${t('vmPlanned', 'VMs planned')}: ${pptxNumber(pv.globals.vmCount, locale)}`,
    {
      x: M,
      y: yy,
      w: CONTENT_W,
      h: 0.4,
      fontFace: 'Calibri',
      fontSize: 12,
      color: PPTX_COLORS.inkMuted,
      valign: 'middle',
      margin: 0,
    },
  )
}
