/**
 * Phase 10 — the HTML report tree ("the report is the product").
 *
 * The ONLY sanctioned React/DOM boundary in the engine layer (CONTEXT /
 * UI-SPEC): a typed tree rendered with `renderToStaticMarkup` (RESEARCH
 * Pattern 3 — synchronous, DOM-free, no hydration attrs). It is PURE: no
 * Zustand, no i18next (the resolved string bag is passed in), no clock.
 *
 * Security (T-10-09): every user-derived value (vCenter / cluster names)
 * goes through a normal JSX text node — `renderToStaticMarkup` HTML-escapes
 * it. The React raw-markup escape-hatch prop is deliberately NOT used
 * anywhere in this file (grep-gated). Chart SVGs are NOT injected here:
 * each chart is a deterministic `<div data-chart-slot="…">` placeholder;
 * the trusted ECharts-SSR SVG string is spliced into the slot by
 * `assembleHtml` (the single sanctioned string-assembly layer). This keeps
 * the React tree free of any raw-HTML surface.
 *
 * Sections are emitted in the FIXED HTM-04 order via `data-section`
 * markers; the trends section is omitted entirely when `trends` is null
 * (D-09 — a single snapshot has nothing to trend). Light-theme-fixed: no
 * `dark:` twins (the static file has no Tailwind runtime; class names are
 * placeholders mapped to plain CSS by `inlineAssets`).
 */
import { renderToStaticMarkup } from 'react-dom/server'
import type { EstateView, TrendSeries } from '@/types/estate'
import { fmtInt, fmtPercentWhole } from '@/utils/format'
import type { ExportStrings } from '../types'

/** Per-cluster inline depth (RESEARCH Open Q3 / Pitfall 5 size lever):
 *  the top N clusters by VM count render inline WITH a chart; the rest
 *  fold into the chart-less annex table. 16 keeps a typical estate well
 *  under the 5 MB budget while covering the meaningful clusters. */
export const TOP_N_CLUSTERS = 16

type Locale = 'en' | 'fr'
const bcp47 = (l: Locale): string => (l === 'fr' ? 'fr-FR' : 'en-US')

const NA = '—'

/** Deterministic anchor id (Pitfall 6 / T-10-11): index-prefixed +
 *  slugged — never a raw user name, so two same-named clusters cannot
 *  collide into a duplicate `id=`. */
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'x'
const anchorId = (i: number, name: string): string => `c-${i}-${slug(name)}`

function Section(props: {
  id: string
  title: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <section data-section={props.id} className="report-section">
      <h2 className="section-title">{props.title}</h2>
      {props.children}
    </section>
  )
}

function Metric(props: { label: string; value: string; flag?: boolean }): React.ReactElement {
  return (
    <div className={`metric-row${props.flag ? ' flagged' : ''}`}>
      <span className="metric-label">{props.label}</span>
      <span className="metric-value">{props.value}</span>
    </div>
  )
}

export interface RenderReportInput {
  view: EstateView
  trends: TrendSeries | null
  strings: ExportStrings
  locale: Locale
}

function Report({ view, trends, strings, locale }: RenderReportInput): React.ReactElement {
  const loc = bcp47(locale)
  const g = view.globals
  const oi = view.operationalInsights
  const eos = view.eos.cumulative
  const vcenters = view.vcenters.map((v) => v.label).join(' · ')
  const clustersByVm = [...view.clusters].sort((a, b) => b.vmCount - a.vmCount)
  const top = clustersByVm.slice(0, TOP_N_CLUSTERS)
  const rest = clustersByVm.slice(TOP_N_CLUSTERS)

  return (
    <main className="report">
      <Section id="cover" title={strings['cover.title'] ?? 'VMware Estate Report'}>
        <p className="cover-identity">{vcenters}</p>
        <Metric label={strings['cover.vms'] ?? 'VMs'} value={fmtInt(Number(g.vmCount), loc)} />
        <Metric
          label={strings['cover.hosts'] ?? 'Hosts'}
          value={fmtInt(Number(g.hostCount), loc)}
        />
        <Metric
          label={strings['cover.clusters'] ?? 'Clusters'}
          value={fmtInt(Number(g.clusterCount), loc)}
        />
      </Section>

      <Section id="headlines" title={strings['headlines.title'] ?? 'Executive headlines'}>
        <Metric
          label={strings['headlines.vcpuPerPcpu'] ?? 'vCPU : pCPU'}
          value={fmtInt(Number(g.vcpuPerPcpu), loc)}
        />
        <Metric
          label={strings['headlines.cpuPct'] ?? 'Mean CPU %'}
          value={fmtPercentWhole(Number(oi.avgCpuPct) / 100, loc)}
        />
        <Metric
          label={strings['headlines.memPct'] ?? 'Mean memory %'}
          value={fmtPercentWhole(Number(oi.avgMemPct) / 100, loc)}
        />
        <Metric
          label={strings['headlines.poweredOn'] ?? 'Powered-on VMs'}
          value={fmtInt(Number(oi.poweredOnVms), loc)}
        />
      </Section>

      <Section id="per-cluster" title={strings['cluster.title'] ?? 'Per cluster'}>
        {top.map((c, i) => (
          <article key={anchorId(i, c.cluster)} id={anchorId(i, c.cluster)} className="cluster">
            <h3 className="cluster-name">{c.cluster}</h3>
            <Metric
              label={strings['cluster.hosts'] ?? 'Hosts'}
              value={fmtInt(Number(c.hostCount), loc)}
            />
            <Metric
              label={strings['cluster.vms'] ?? 'VMs'}
              value={fmtInt(Number(c.vmCount), loc)}
            />
            <Metric
              label={strings['cluster.vcpuPerPcpu'] ?? 'vCPU : pCPU'}
              value={fmtInt(Number(c.vcpuPerPcpu), loc)}
            />
            <Metric
              label={strings['cluster.datastores'] ?? 'Datastores'}
              value={c.datastoreCount === null ? NA : fmtInt(Number(c.datastoreCount), loc)}
            />
            {/* Chart slot — assembleHtml splices the trusted ECharts SSR
                SVG here; renderReport never holds raw markup. */}
            <div data-chart-slot={anchorId(i, c.cluster)} className="chart-slot" />
          </article>
        ))}
      </Section>

      <Section id="eos" title={strings['eos.title'] ?? 'OS end-of-support forecast'}>
        <Metric label={strings['eos.overdue'] ?? 'Overdue'} value={fmtInt(eos.overdue, loc)} />
        <Metric label={strings['eos.le3'] ?? '≤ 3 months'} value={fmtInt(eos.le3, loc)} />
        <Metric label={strings['eos.le6'] ?? '≤ 6 months'} value={fmtInt(eos.le6, loc)} />
        <Metric label={strings['eos.le9'] ?? '≤ 9 months'} value={fmtInt(eos.le9, loc)} />
        <Metric label={strings['eos.le12'] ?? '≤ 12 months'} value={fmtInt(eos.le12, loc)} />
        <Metric label={strings['eos.unknown'] ?? 'Unknown'} value={fmtInt(eos.unknown, loc)} />
      </Section>

      <Section id="dr" title={strings['dr.title'] ?? 'DR results'}>
        {view.drSim === null ? (
          <p className="factual-note">{strings['dr.none'] ?? 'No DR scenario selected.'}</p>
        ) : (
          <>
            <Metric
              label={strings['dr.cpuRemovedCores'] ?? 'Physical cores removed'}
              value={fmtInt(Number(view.drSim.physicalCpuRemovedCores), loc)}
            />
            <Metric
              label={strings['dr.ramRemovedMib'] ?? 'Physical RAM removed (MiB)'}
              value={fmtInt(Number(view.drSim.physicalRamRemovedMib), loc)}
            />
            <Metric
              label={strings['dr.survivors'] ?? 'Survivor clusters'}
              value={fmtInt(view.drSim.perSurvivor.length, loc)}
            />
          </>
        )}
      </Section>

      {trends !== null ? (
        <Section id="trends" title={strings['trends.title'] ?? 'In-session trends'}>
          <Metric
            label={strings['trends.points'] ?? 'Timeline points'}
            value={fmtInt(trends.points.length, loc)}
          />
          <Metric
            label={strings['trends.deltas'] ?? 'Deltas'}
            value={fmtInt(trends.deltas.length, loc)}
          />
        </Section>
      ) : null}

      <Section id="annex" title={strings['annex.title'] ?? 'Annex'}>
        <table className="annex-table">
          <thead>
            <tr>
              <th>{strings['annex.cluster'] ?? 'Cluster'}</th>
              <th>{strings['annex.hosts'] ?? 'Hosts'}</th>
              <th>{strings['annex.vms'] ?? 'VMs'}</th>
            </tr>
          </thead>
          <tbody>
            {rest.map((c, i) => (
              <tr key={anchorId(TOP_N_CLUSTERS + i, c.cluster)}>
                <td>{c.cluster}</td>
                <td className="num">{fmtInt(Number(c.hostCount), loc)}</td>
                <td className="num">{fmtInt(Number(c.vmCount), loc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Metric
          label={strings['annex.datastores'] ?? 'Datastores'}
          value={fmtInt(view.datastores.length, loc)}
        />
      </Section>

      <footer data-section="methodology" className="methodology">
        <p>{strings['footer.methodology'] ?? ''}</p>
      </footer>
    </main>
  )
}

/**
 * Render the report body to a static HTML string. Pure: no DOM mutation,
 * no Zustand, no i18next. The result still carries `data-chart-slot`
 * placeholders — `assembleHtml` splices the trusted chart SVGs in.
 */
/**
 * The ordered chart slots `<Report>` emits — the SAME sort (vmCount desc) +
 * top-N + `c-{i}-{slug}` id derivation used in the tree. The export worker
 * uses this to build the `assembleHtml` ChartMap (and the PPTX per-cluster
 * raster) with ids that exactly match the placeholders — single source of
 * truth, never re-derived elsewhere.
 */
export function exportChartSlots(view: EstateView): ReadonlyArray<{ id: string; cluster: string }> {
  return [...view.clusters]
    .sort((a, b) => b.vmCount - a.vmCount)
    .slice(0, TOP_N_CLUSTERS)
    .map((c, i) => ({ id: anchorId(i, c.cluster), cluster: c.cluster }))
}

export function renderReport(input: RenderReportInput): string {
  return renderToStaticMarkup(<Report {...input} />)
}
