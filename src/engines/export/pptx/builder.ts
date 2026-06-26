/**
 * Phase 10 — PPTX deck composition root. Shaped like the pure
 * `estateView.ts` assembler (typed params, single pass, no React/Zustand/
 * Zod). Emits slides in the FIXED PPT-03 order:
 *
 *   title → overview → one clusterSlide PER cluster (D-01, ALWAYS, no cap)
 *   → contention annex (only if readiness rows present, conditional)
 *   → eos → trends (only if trends non-null — D-09) → inventory
 *
 * Returns a valid OOXML `ArrayBuffer`. Pure: the worker pre-rasterizes the
 * app's real charts into `opts.charts` (a `PngBundle`) and injects them;
 * omitted ⇒ chart panels show a factual "—" (still valid; the golden
 * structural test stays wasm-free).
 */
import PptxGenJS from 'pptxgenjs'
import type { EstateView, TrendSeries } from '@/types/estate'
import type { PngBundle } from '../chartBundle'
import type { ExportStrings } from '../types'
import type { ExportLocale } from './format'
import { addBackupCoverageSlide } from './slides/backupCoverageSlide'
import { addClusterHealthSlide } from './slides/clusterHealthSlide'
import { addClusterSlide } from './slides/clusterSlide'
import { addContentionAnnex, type ContentionRow } from './slides/contentionAnnex'
import { addDiskHygieneSlide } from './slides/diskHygieneSlide'
import { addEosSlide } from './slides/eosSlide'
import { addFsFillSlide } from './slides/fsFillSlide'
import { addInventorySlide } from './slides/inventorySlide'
import { addMonsterSlide } from './slides/monsterSlide'
import { addNetworkSlide } from './slides/networkSlide'
import { addOverviewSlide } from './slides/overviewSlide'
import { addPhysicalInventorySlide } from './slides/physicalInventorySlide'
import { addPlannedSlide } from './slides/plannedSlide'
import { addRightSizingSlide } from './slides/rightSizingSlide'
import { addSnapshotSprawlSlide } from './slides/snapshotSprawlSlide'
import { addStorageContentSlide } from './slides/storageContentSlide'
import { addStorageSlide } from './slides/storageSlide'
import { addTitleSlide } from './slides/titleSlide'
import { addTrendsSlide } from './slides/trendsSlide'

export interface BuildPptxOpts {
  /** Worker-rasterized real app charts (osDonut/cpuGauge/ramGauge/eosBar/
   *  drBar/trendLine + per-cluster). Omitted ⇒ "—" chart panels. */
  charts?: PngBundle
  /** CPU-Ready rows; when present & non-empty the conditional annex emits. */
  contentionRows?: ReadonlyArray<ContentionRow>
  /** The active snapshot's capture date (ISO `YYYY-MM-DD`), used verbatim
   *  on the D-03 title slide — NOT the vCenter label. */
  capturedAt?: string
  /** Rasterized network diagram PNG (the worker resvg-rasterizes
   *  `Snapshot.networkSvg` with a bundled font). When present it is embedded
   *  as a PowerPoint-safe image on the Network slide (PowerPoint cannot render
   *  embedded SVG — Pitfall 1). When null/undefined the slide shows a factual
   *  Proxmox-correct note. */
  networkPng?: Uint8Array | null
  /** True when the SVG was extreme-portrait (e.g. 1762×14092); the worker
   *  capped the raster height to avoid a 12 000-px PNG, and the slide should
   *  reserve space for a "see HTML report" note. */
  networkOversized?: boolean
}

export async function buildPptx(
  view: EstateView,
  trends: TrendSeries | null,
  strings: ExportStrings,
  locale: ExportLocale,
  opts: BuildPptxOpts = {},
): Promise<ArrayBuffer> {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 })
  pptx.layout = 'WIDE'
  const shared = opts.charts?.shared
  const png = (k: string): Uint8Array | undefined => shared?.get(k)

  addTitleSlide(
    pptx,
    {
      vcenters: view.clusters[0]?.cluster ?? '',
      clusterCount: view.globals.clusterCount,
      hostCount: view.globals.hostCount,
      vmCount: view.globals.vmCount,
      capturedAt: opts.capturedAt ?? '',
      physicalGhz: Number(view.globals.physicalGhz),
      physicalRamMib: Number(view.globals.physicalRamMib),
      meanCpuRatio: Number(view.globals.meanCpuRatio),
    },
    strings,
    locale,
  )
  addOverviewSlide(
    pptx,
    {
      globals: view.globals,
      insights: view.operationalInsights,
      osBreakdown: view.osBreakdown,
    },
    strings,
    locale,
  )

  // D-01: exactly one slide per cluster, ALWAYS — no top-N cap.
  for (const cluster of view.clusters) {
    addClusterSlide(
      pptx,
      { cluster, chartPng: opts.charts?.perCluster.get(cluster.cluster) },
      strings,
      locale,
    )
  }

  // F-2 (D-05): Storage + Network after the per-cluster narrative,
  // before the conditional annex. Network has no chart (D-08).
  addStorageSlide(pptx, view, strings, locale)
  addNetworkSlide(
    pptx,
    opts.networkPng ?? null,
    strings,
    locale,
    opts.networkOversized ?? false,
    view.network,
  )

  // Conditional CPU-Ready annex.
  if (opts.contentionRows && opts.contentionRows.length > 0) {
    addContentionAnnex(pptx, opts.contentionRows, strings, locale)
  }

  // P-RS right-sizing/stress — conditional: only when usage data (vMemory/
  // vCPU) was derivable; otherwise the slide is omitted (no empty page).
  if (view.sizing.hasUsageData) {
    addRightSizingSlide(pptx, view.sizing, strings, locale)
  }

  // P-RS monster VMs — conditional: only when the estate has VMs above the
  // configured-size lines; otherwise omitted (no empty page).
  if (view.monsters.count > 0) {
    addMonsterSlide(pptx, view.monsters, strings, locale)
  }

  if (view.snapshotSprawl.count > 0) {
    addSnapshotSprawlSlide(pptx, view.snapshotSprawl, strings, locale)
  }
  if (view.storageContent.fileCount > 0) {
    addStorageContentSlide(pptx, view.storageContent, strings, locale)
  }
  if (
    view.clusterHealth.ha.services.length > 0 ||
    view.clusterHealth.ha.managedCount > 0 ||
    view.clusterHealth.backups.jobCount > 0
  ) {
    addClusterHealthSlide(pptx, view.clusterHealth, strings, locale)
  }

  // Pack B — protection & risk (conditional: only when data is present)
  if (view.fsFillRisk.overThresholdCount > 0 || view.fsFillRisk.totalMounts > 0) {
    addFsFillSlide(pptx, view.fsFillRisk, strings, locale)
  }
  if (
    view.diskHygiene.unusedCount > 0 ||
    view.diskHygiene.strayIsoCount > 0 ||
    view.diskHygiene.noBackupCount > 0 ||
    view.diskHygiene.riskyCacheCount > 0
  ) {
    addDiskHygieneSlide(pptx, view.diskHygiene, strings, locale)
  }
  if (view.backupCoverage.vzdump.totalCount > 0) {
    addBackupCoverageSlide(pptx, view.backupCoverage, strings, locale)
  }

  addEosSlide(pptx, view.eos, png('eosBar'), strings, locale)
  // F-1 (deck side): planned-vs-measured with the other re-aggregation.
  addPlannedSlide(pptx, view, strings, locale)

  // D-09: trends slide only when trends is non-null (<2 snapshots ⇒ omit).
  if (trends !== null) addTrendsSlide(pptx, trends, png('trendLine'), strings, locale)

  addInventorySlide(pptx, view, png('osDonut'), strings, locale)

  // P-HWID: physical inventory (serial / service tag) — conditional: only
  // when at least one host reports a serial; otherwise omitted (no empty
  // page). Auto-paginates across slides for large estates.
  if (view.hosts.some((h) => h.serialNumber !== '')) {
    addPhysicalInventorySlide(pptx, view.hosts, strings, locale)
  }

  return pptx.write({ outputType: 'arraybuffer' }) as Promise<ArrayBuffer>
}
