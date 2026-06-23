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
  const vcenters = ''
  const clustersByVm = [...view.clusters].sort((a, b) => b.vmCount - a.vmCount)
  const top = clustersByVm.slice(0, TOP_N_CLUSTERS)
  const rest = clustersByVm.slice(TOP_N_CLUSTERS)
  // P9 size levers: top-N by provisioned, remainder folded into a count.
  const gib = (m: number): string => fmtInt(Math.round(Number(m) / 1024), loc)
  const stoByCluster = [...view.storage.byCluster].sort(
    (a, b) => Number(b.provisionedMib) - Number(a.provisionedMib),
  )
  const stoByDs = [...view.storage.byDatastore].sort(
    (a, b) => Number(b.provisionedMib) - Number(a.provisionedMib),
  )
  const stoClusterTop = stoByCluster.slice(0, TOP_N_CLUSTERS)
  const stoDsTop = stoByDs.slice(0, TOP_N_CLUSTERS)
  const vsanShared = [...view.vsan.shared.entries()]
  const flaggedDs = view.flags.counts.ds + view.flags.counts.lu
  const planned = view.plannedView
  const plannedRows =
    planned === null
      ? []
      : planned.clusters
          .map((pc) => ({
            cluster: pc.cluster,
            planned: pc.vcpuPerPcpu,
            measured: view.clusters.find((c) => c.cluster === pc.cluster)?.vcpuPerPcpu ?? null,
          }))
          .slice(0, TOP_N_CLUSTERS)

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

      <Section id="storage" title={strings['storage.title'] ?? 'Storage'}>
        <Metric
          label={strings['storage.provisioned'] ?? 'Provisioned (GiB)'}
          value={gib(Number(view.storage.estate.provisionedMib))}
        />
        <Metric
          label={strings['storage.usedStorage'] ?? 'Used storage (GiB)'}
          value={gib(Number(view.operationalInsights.usedStorageMib))}
        />
        <Metric
          label={strings['storage.inUse'] ?? 'Committed (GiB)'}
          value={gib(Number(view.storage.estate.inUseMib))}
        />
        <Metric
          label={strings['storage.capacity'] ?? 'Capacity (GiB)'}
          value={gib(Number(view.storage.estate.capacityMib))}
        />
        <Metric
          label={strings['storage.flagged'] ?? 'Flagged datastores'}
          value={fmtInt(flaggedDs, loc)}
          flag={flaggedDs > 0}
        />
        <div data-chart-slot="storage-treemap" className="chart-slot" />
        <table className="annex-table">
          <thead>
            <tr>
              <th>{strings['storage.colCluster'] ?? 'Cluster'}</th>
              <th>{strings['storage.colProvisioned'] ?? 'Provisioned'}</th>
              <th>{strings['storage.colInUse'] ?? 'In use'}</th>
            </tr>
          </thead>
          <tbody>
            {stoClusterTop.map((s) => (
              <tr key={`sto-c-${slug(s.key)}`}>
                <td>{s.key}</td>
                <td className="num">{gib(Number(s.provisionedMib))}</td>
                <td className="num">{gib(Number(s.inUseMib))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="annex-table">
          <thead>
            <tr>
              <th>{strings['storage.colCluster'] ?? 'Cluster'}</th>
              <th>{strings['storage.colProvisioned'] ?? 'Provisioned'}</th>
              <th>{strings['storage.colInUse'] ?? 'In use'}</th>
            </tr>
          </thead>
          <tbody>
            {stoDsTop.map((s) => (
              <tr key={`sto-d-${slug(s.key)}`}>
                <td>{s.key}</td>
                <td className="num">{gib(Number(s.provisionedMib))}</td>
                <td className="num">{gib(Number(s.inUseMib))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {vsanShared.map(([k, n]) => (
          <p key={`vsan-${slug(k)}`} className="factual-note">
            {k} —{' '}
            {(strings['storage.vsanShared'] ?? 'Shared across {{n}} clusters').replace(
              '{{n}}',
              fmtInt(n, loc),
            )}
          </p>
        ))}
      </Section>

      <Section id="network" title={strings['network.title'] ?? 'Network'}>
        <Metric
          label={strings['network.vswitches'] ?? 'vSwitches'}
          value={fmtInt(view.network.vswitches.length, loc)}
        />
        <Metric
          label={strings['network.dvswitches'] ?? 'dvSwitches'}
          value={fmtInt(view.network.dvswitches.length, loc)}
        />
        <Metric
          label={strings['network.portgroups'] ?? 'Portgroups'}
          value={fmtInt(view.network.portgroups.length, loc)}
        />
        <Metric
          label={strings['network.vnetwork'] ?? 'VM adjacencies'}
          value={fmtInt(view.network.vmPortgroupCount, loc)}
        />
      </Section>

      <Section id="eos" title={strings['eos.title'] ?? 'OS end-of-support forecast'}>
        <Metric label={strings['eos.overdue'] ?? 'Overdue'} value={fmtInt(eos.overdue, loc)} />
        <Metric label={strings['eos.le3'] ?? '≤ 3 months'} value={fmtInt(eos.le3, loc)} />
        <Metric label={strings['eos.le6'] ?? '≤ 6 months'} value={fmtInt(eos.le6, loc)} />
        <Metric label={strings['eos.le9'] ?? '≤ 9 months'} value={fmtInt(eos.le9, loc)} />
        <Metric label={strings['eos.le12'] ?? '≤ 12 months'} value={fmtInt(eos.le12, loc)} />
        <Metric label={strings['eos.unknown'] ?? 'Unknown'} value={fmtInt(eos.unknown, loc)} />
      </Section>

      <Section id="planned" title={strings['planned.title'] ?? 'Planned vs measured estate'}>
        {planned === null ? (
          <p className="factual-note">{strings['planned.none'] ?? '—'}</p>
        ) : (
          <>
            <Metric
              label={strings['planned.vcpuMeasured'] ?? 'vCPU:pCPU measured'}
              value={fmtInt(Number(g.vcpuPerPcpu), loc)}
            />
            <Metric
              label={strings['planned.vcpuPlanned'] ?? 'vCPU:pCPU planned'}
              value={fmtInt(Number(planned.globals.vcpuPerPcpu), loc)}
            />
            <Metric
              label={strings['planned.vmMeasured'] ?? 'VMs measured'}
              value={fmtInt(Number(g.vmCount), loc)}
            />
            <Metric
              label={strings['planned.vmPlanned'] ?? 'VMs planned'}
              value={fmtInt(Number(planned.globals.vmCount), loc)}
            />
            <table className="annex-table">
              <thead>
                <tr>
                  <th>{strings['planned.colCluster'] ?? 'Cluster'}</th>
                  <th>{strings['planned.colMeasured'] ?? 'Measured'}</th>
                  <th>{strings['planned.colPlanned'] ?? 'Planned'}</th>
                </tr>
              </thead>
              <tbody>
                {plannedRows.map((r) => (
                  <tr key={`pln-${slug(r.cluster)}`}>
                    <td>{r.cluster}</td>
                    <td className="num">
                      {r.measured === null ? NA : fmtInt(Number(r.measured), loc)}
                    </td>
                    <td className="num">{fmtInt(Number(r.planned), loc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
