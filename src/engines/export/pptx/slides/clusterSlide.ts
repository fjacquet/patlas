/**
 * Phase 18 — one rich slide per cluster (D-01, ALWAYS, no cap). Ported from
 * vsizer's proven `clusterSlide.ts` layout, rebrand-free per vatlas UI-SPEC
 * §Color (navy/gold/grey only — NO verdict green/orange/red): navy header
 * (cluster name + factual subtitle + simple stretched handling), a factual
 * CPU-Ready line, 5 KPI cards, two CPU/RAM utilization blocks (progress bar
 * + gold peak + min/mean/max), a navy KEY FIGURES banner, a RAM-available
 * line, and a source-provenance footer. Pure & sync. Factual, no editorial
 * verbs.
 */
import type PptxGenJS from 'pptxgenjs'
import { CONTENTION_THRESHOLDS } from '@/engines/aggregation/contention'
import type { ClusterAggregate } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { drawKpiCard, drawProgressBar } from '../primitives/draw'
import { SLIDE } from '../theme'
import { addHeader, CONTENT_W, M } from './_layout'

export interface ClusterSlideData {
  cluster: ClusterAggregate
  /** Per-cluster CPU gauge PNG — no longer placed (the block bars replace
   *  it); kept in the type for builder compatibility. */
  chartPng?: Uint8Array
}

export function addClusterSlide(
  pptx: PptxGenJS,
  d: ClusterSlideData,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const c = d.cluster
  const s = pptx.addSlide()

  const n = (v: number | { valueOf(): number }) => pptxNumber(Number(v), locale)
  const n1 = (v: number | { valueOf(): number }) => pptxNumber(Number(v), locale, 1)
  const ghz = (v: number | { valueOf(): number }) => `${n(v)} GHz`
  const gib = (mib: number | { valueOf(): number }) =>
    `${pptxNumber(Math.round(Number(mib) / 1024), locale)} GiB`
  const pct1 = (ratio: number) => `${pptxNumber(ratio * 100, locale, 1)} %`
  const pctW = (ratio: number) => `${pptxNumber(Math.round(ratio * 100), locale)} %`
  const t = (k: string, fallback: string) => strings[`cluster.${k}`] ?? fallback

  const cores = Number(c.physicalCores)
  const pGhz = Number(c.physicalGhz)
  const ghzPerCore = cores > 0 ? pGhz / cores : 0
  const stretchedSuffix = c.stretched
    ? ` · ${t('stretched', 'Stretched')} · ${t('drReserved', 'DR reserved')} ${ghz(c.drReservedGhz)} / ${gib(c.drReservedRamMib)}`
    : ''
  const subtitle =
    `${n(c.hostCount)} ${t('hostsWord', 'hosts')} · ${n(c.vmCount)} ${t('vmsWord', 'VMs')} · ` +
    `${n(cores)} ${t('coresWord', 'cores')} (${n1(ghzPerCore)} GHz/core) · ${gib(c.physicalRamMib)} ${t('ramWord', 'RAM')}` +
    stretchedSuffix

  const y = addHeader(s, c.cluster, subtitle)

  // ── CPU-Ready contention line (factual, NO verdict color) ──────────────
  const ready =
    c.readinessAvailable && c.meanCpuReadinessPercent !== null
      ? t('readyLine', 'CPU Ready: {{mean}} % mean · {{max}} % max · {{count}} VM(s) > {{thr}} %')
          .replace('{{mean}}', pptxNumber(c.meanCpuReadinessPercent, locale, 1))
          .replace(
            '{{max}}',
            pptxNumber(c.maxCpuReadinessPercent ?? c.meanCpuReadinessPercent, locale, 1),
          )
          .replace('{{count}}', n(c.vmsAboveReadinessWarning))
          .replace('{{thr}}', String(CONTENTION_THRESHOLDS.warning))
      : t('readyUnavailable', 'CPU Ready: unavailable (source: RVTools)')
  s.addText(pptxSafeFormat(ready), {
    x: M,
    y,
    w: CONTENT_W,
    h: 0.3,
    fontFace: 'Arial',
    fontSize: 11,
    bold: true,
    color: PPTX_COLORS.inkMuted,
    valign: 'middle',
    margin: 0,
  })

  // ── Row 1: 5 KPI cards ─────────────────────────────────────────────────
  const cardY = y + 0.42
  const cardH = 1.05
  const gap = 0.15
  const cw = (CONTENT_W - gap * 4) / 5
  const cards = [
    { big: pct1(c.meanCpuRatio), small: t('cpuMean', 'CPU mean') },
    { big: pct1(c.meanRamRatio), small: t('ramMean', 'RAM mean') },
    {
      big: `${n(c.consumedGhz)} / ${n(c.physicalGhz)}`,
      small: t('ghzUsedPhys', 'GHz used / phys.'),
    },
    {
      big: `${pptxNumber(Math.round(Number(c.mhzPerVcpu)), locale)} MHz`,
      small: t('mhzPerVcpu', 'real per allocated vCPU'),
    },
    { big: `${n1(c.vcpuPerPcpu)} : 1`, small: t('vcpuPerPcpu', 'vCPU per physical core') },
  ]
  cards.forEach((card, i) => {
    drawKpiCard(s, {
      x: M + i * (cw + gap),
      y: cardY,
      w: cw,
      h: cardH,
      big: card.big,
      small: card.small,
    })
  })

  // ── Row 2: CPU and RAM utilization blocks ──────────────────────────────
  const blockY = cardY + cardH + 0.25
  const blockH = 2.15
  const blockW = (CONTENT_W - 0.4) / 2

  const drawBlock = (
    x: number,
    title: string,
    sub: string,
    mean: number,
    max: number,
    min: number,
  ) => {
    s.addShape('roundRect', {
      x,
      y: blockY,
      w: blockW,
      h: blockH,
      fill: { color: PPTX_COLORS.pageBg },
      line: { color: PPTX_COLORS.hairline, width: 0.75 },
      rectRadius: 0.06,
    })
    s.addText(pptxSafeFormat(title), {
      x: x + 0.3,
      y: blockY + 0.16,
      w: blockW - 0.6,
      h: 0.32,
      fontFace: 'Arial',
      fontSize: 13,
      bold: true,
      color: PPTX_COLORS.ink,
      margin: 0,
    })
    s.addText(pptxSafeFormat(sub), {
      x: x + 0.3,
      y: blockY + 0.48,
      w: blockW - 0.6,
      h: 0.28,
      fontFace: 'Arial',
      fontSize: 10,
      color: PPTX_COLORS.inkMuted,
      margin: 0,
    })
    const barX = x + 0.3
    const barY = blockY + 0.9
    const barW = blockW - 0.6
    drawProgressBar(s, { x: barX, y: barY, w: barW, h: 0.3, ratio: mean, peak: max })
    s.addText('0 %', {
      x: barX,
      y: barY + 0.36,
      w: barW,
      h: 0.18,
      fontFace: 'Arial',
      fontSize: 8,
      color: PPTX_COLORS.inkMuted,
      margin: 0,
    })
    s.addText('100 %', {
      x: barX,
      y: barY + 0.36,
      w: barW,
      h: 0.18,
      fontFace: 'Arial',
      fontSize: 8,
      color: PPTX_COLORS.inkMuted,
      align: 'right',
      margin: 0,
    })
    const sy = blockY + 1.5
    const sw = barW / 3
    const strip = [
      { lab: t('min', 'Min'), val: pctW(min) },
      { lab: t('mean', 'Mean'), val: pct1(mean) },
      { lab: t('max', 'Max'), val: pctW(max) },
    ]
    strip.forEach((st, i) => {
      const sx = barX + sw * i
      s.addText(st.lab, {
        x: sx,
        y: sy,
        w: sw,
        h: 0.22,
        fontFace: 'Arial',
        fontSize: 9,
        color: PPTX_COLORS.inkMuted,
        align: 'center',
        margin: 0,
      })
      s.addText(st.val, {
        x: sx,
        y: sy + 0.2,
        w: sw,
        h: 0.32,
        fontFace: 'Consolas',
        fontSize: 14,
        bold: true,
        color: PPTX_COLORS.ink,
        align: 'center',
        margin: 0,
      })
    })
  }

  drawBlock(
    M,
    t('cpuTitle', 'CPU — mean utilization'),
    `${ghz(c.consumedGhz)} ${t('consumedOf', 'consumed of')} ${ghz(c.physicalGhz)}`,
    Number(c.meanCpuRatio),
    Number(c.maxCpuRatio),
    Number(c.minCpuRatio),
  )
  drawBlock(
    M + blockW + 0.4,
    t('ramTitle', 'RAM — mean utilization'),
    `${gib(c.consumedRamMib)} ${t('consumedOf', 'consumed of')} ${gib(c.physicalRamMib)}`,
    Number(c.meanRamRatio),
    Number(c.maxRamRatio),
    Number(c.minRamRatio),
  )

  // ── Row 3: KEY FIGURES navy banner (gold tiles) ────────────────────────
  const bannerY = blockY + blockH + 0.2
  const bannerH = 1.4
  s.addShape('roundRect', {
    x: M,
    y: bannerY,
    w: CONTENT_W,
    h: bannerH,
    fill: { color: PPTX_COLORS.primary500 },
    line: { type: 'none' },
    rectRadius: 0.06,
  })
  s.addText(pptxSafeFormat(t('keyFigures', 'KEY FIGURES')), {
    x: M + 0.25,
    y: bannerY + 0.14,
    w: CONTENT_W - 0.5,
    h: 0.32,
    fontFace: 'Arial',
    fontSize: 12,
    bold: true,
    color: PPTX_COLORS.accent,
    margin: 0,
  })
  const reservedGhz = Number(c.vcpuAllocated) * ghzPerCore
  const tiles = [
    { lab: t('vcpuAlloc', 'vCPU allocated'), val: n(c.vcpuAllocated) },
    { lab: t('reservedCap', 'Reserved capacity (vCPU × clock)'), val: ghz(reservedGhz) },
    { lab: t('consumedGhz', 'GHz consumed'), val: ghz(c.consumedGhz) },
    { lab: t('availableGhz', 'GHz available'), val: ghz(c.availableGhz) },
  ]
  const tileY = bannerY + 0.56
  const tw = (CONTENT_W - 0.5) / tiles.length
  tiles.forEach((tile, i) => {
    const tx = M + 0.25 + i * tw
    s.addText(pptxSafeFormat(tile.lab), {
      x: tx,
      y: tileY,
      w: tw - 0.1,
      h: 0.3,
      fontFace: 'Arial',
      fontSize: 10,
      color: PPTX_COLORS.primary200,
      margin: 0,
    })
    s.addText(pptxSafeFormat(tile.val), {
      x: tx,
      y: tileY + 0.3,
      w: tw - 0.1,
      h: 0.46,
      fontFace: 'Consolas',
      fontSize: 18,
      bold: true,
      color: PPTX_COLORS.accent,
      margin: 0,
    })
  })

  // ── RAM-available line + provenance footer ─────────────────────────────
  const ramAvail = Number(c.availableRamMib)
  s.addText(pptxSafeFormat(`${t('ramAvailable', 'RAM available')}: ${gib(ramAvail)}`), {
    x: M,
    y: bannerY + bannerH + 0.08,
    w: CONTENT_W,
    h: 0.26,
    fontFace: 'Arial',
    fontSize: 11,
    bold: true,
    color: ramAvail < 0 ? PPTX_COLORS.accent : PPTX_COLORS.ink,
    margin: 0,
  })
  s.addText(
    pptxSafeFormat(
      t(
        'footer',
        'Source: RVTools — vHost (CPU/RAM usage %, Speed × Cores, Memory) + vInfo (vCPUs, Memory)',
      ),
    ),
    {
      x: M,
      y: SLIDE.h - 0.32,
      w: CONTENT_W,
      h: 0.26,
      fontFace: 'Arial',
      fontSize: 9,
      color: PPTX_COLORS.inkMuted,
      margin: 0,
    },
  )
}
