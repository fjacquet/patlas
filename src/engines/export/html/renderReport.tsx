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
import { svgToDataUri } from '@/engines/export/svgDataUri'
import type { EstateView, TrendSeries } from '@/types/estate'
import { fmtInt, fmtMemMb, fmtPercentWhole } from '@/utils/format'
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
  /** Optional Proxmox network diagram SVG (Task pC-01). When present, rendered
   *  as an `<img>` data-URI in the network section. Omitted when null/absent. */
  networkSvg?: string | null
}

function Report({
  view,
  trends,
  strings,
  locale,
  networkSvg,
}: RenderReportInput): React.ReactElement {
  const loc = bcp47(locale)
  const g = view.globals
  const oi = view.operationalInsights
  const eos = view.eos.cumulative
  const vcenters = view.clusters[0]?.cluster ?? ''
  const clustersByVm = [...view.clusters].sort((a, b) => b.vmCount - a.vmCount)
  const top = clustersByVm.slice(0, TOP_N_CLUSTERS)
  const rest = clustersByVm.slice(TOP_N_CLUSTERS)
  // P9 size levers: top-N by provisioned, remainder folded into a count.
  // TiB/GiB-tiered storage figures (cv4pve backup repos reach hundreds of
  // TiB — raw GiB integers are unreadable; ADR-0010 base-2 suffixes).
  const mem = (m: number): string => fmtMemMb(Number(m), loc)
  // Storage grouped by cv4pve role — VM data leads; backup + node-local
  // boot shown as separate groups so a few PBS repos don't drown VM storage.
  // Real datastore `used` (never the always-zero per-VM `Disk Usage GB`).
  const roleGroups = view.storage.byRole
  const vmRole = roleGroups.find((g) => g.role === 'vmdata')
  const roleLabel = (role: string): string => strings[`storage.role.${role}`] ?? role
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
      <Section id="cover" title={strings['cover.title'] ?? 'Proxmox Estate Report'}>
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
        {/* VM data leads — real used / capacity (cv4pve leaves per-VM
            "Disk Usage GB" empty, so usage comes from the Storages sheet). */}
        <Metric
          label={strings['storage.vmUsedCapacity'] ?? 'VM storage (used / capacity)'}
          value={`${mem(Number(vmRole?.usedMib ?? 0))} / ${mem(Number(vmRole?.capacityMib ?? 0))}`}
        />
        <Metric
          label={strings['storage.vmAllocated'] ?? 'VM allocated'}
          value={mem(Number(view.storage.estate.provisionedMib))}
        />
        <Metric
          label={strings['storage.flagged'] ?? 'Flagged storages'}
          value={fmtInt(flaggedDs, loc)}
          flag={flaggedDs > 0}
        />
        <div data-chart-slot="storage-treemap" className="chart-slot" />
        {/* Per-role breakdown — used before capacity. Backup + local
            shown separately so PBS repos don't distort the VM-storage view. */}
        <table className="annex-table">
          <thead>
            <tr>
              <th>{strings['storage.colRole'] ?? 'Role'}</th>
              <th>{strings['storage.colUsed'] ?? 'Used'}</th>
              <th>{strings['storage.colCapacity'] ?? 'Capacity'}</th>
              <th>{strings['storage.colFree'] ?? 'Free'}</th>
              <th>{strings['storage.colDatastores'] ?? 'Datastores'}</th>
            </tr>
          </thead>
          <tbody>
            {roleGroups.map((g) => (
              <tr key={`sto-role-${g.role}`}>
                <td>{roleLabel(g.role)}</td>
                <td className="num">{mem(Number(g.usedMib))}</td>
                <td className="num">{mem(Number(g.capacityMib))}</td>
                <td className="num">{mem(Number(g.freeMib))}</td>
                <td className="num">{fmtInt(g.count, loc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="network" title={strings['network.title'] ?? 'Network'}>
        <Metric
          label={strings['network.nics'] ?? 'Physical NICs'}
          value={fmtInt(view.network.totalNics, loc)}
        />
        <Metric
          label={strings['network.bonds'] ?? 'Bonds'}
          value={fmtInt(view.network.totalBonds, loc)}
        />
        <Metric
          label={strings['network.bridges'] ?? 'Bridges'}
          value={fmtInt(view.network.totalBridges, loc)}
        />
        <Metric
          label={strings['network.vlans'] ?? 'VLANs'}
          value={fmtInt(view.network.totalVlans, loc)}
        />
        <Metric
          label={strings['network.vmNics'] ?? 'Guest NIC attachments'}
          value={fmtInt(view.network.vmNicCount, loc)}
        />
        {networkSvg ? (
          <img
            src={svgToDataUri(networkSvg)}
            alt={strings['network.diagramAlt'] ?? 'Network topology diagram'}
            className="network-diagram"
          />
        ) : null}
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
      ) : view.rrdHeadroom.timeline.length > 0 ? (
        // P8 Pack A — single-file trends: one export's RRD time-series still
        // yields an intra-file estate-utilization trend (no second snapshot).
        <Section
          id="trends-single"
          title={strings['trends.singleTitle'] ?? 'Single-file trends — RRD time-series'}
        >
          <p className="factual-note">
            {strings['trends.singleNote'] ?? 'Derived from the RRD time-series in this export.'}
          </p>
          <Metric
            label={strings['trends.singleSamples'] ?? 'Timeline samples'}
            value={fmtInt(view.rrdHeadroom.timeline.length, loc)}
          />
          <Metric
            label={strings['trends.singleCpu'] ?? 'Mean CPU %'}
            value={fmtPercentWhole(view.rrdHeadroom.estate.cpuAvg, loc)}
          />
          <Metric
            label={strings['trends.singleMem'] ?? 'Mean memory %'}
            value={fmtPercentWhole(view.rrdHeadroom.estate.memAvg, loc)}
          />
        </Section>
      ) : null}

      {view.rrdHeadroom.hasData ? (
        <Section
          id="rrd-headroom"
          title={strings['rrdHeadroom.title'] ?? 'Node headroom — RRD utilization'}
        >
          <Metric
            label={strings['rrdHeadroom.kpi.cpuPeak'] ?? 'Peak CPU'}
            value={fmtPercentWhole(view.rrdHeadroom.estate.cpuPeak, loc)}
          />
          <Metric
            label={strings['rrdHeadroom.kpi.cpuAvg'] ?? 'Mean CPU'}
            value={fmtPercentWhole(view.rrdHeadroom.estate.cpuAvg, loc)}
          />
          <Metric
            label={strings['rrdHeadroom.kpi.memPeak'] ?? 'Peak memory'}
            value={fmtPercentWhole(view.rrdHeadroom.estate.memPeak, loc)}
          />
          <Metric
            label={strings['rrdHeadroom.kpi.memAvg'] ?? 'Mean memory'}
            value={fmtPercentWhole(view.rrdHeadroom.estate.memAvg, loc)}
          />
          <table className="annex-table">
            <thead>
              <tr>
                <th>{strings['rrdHeadroom.col.node'] ?? 'Node'}</th>
                <th>{strings['rrdHeadroom.col.cpuPeak'] ?? 'CPU peak'}</th>
                <th>{strings['rrdHeadroom.col.cpuAvg'] ?? 'CPU mean'}</th>
                <th>{strings['rrdHeadroom.col.memPeak'] ?? 'Mem peak'}</th>
                <th>{strings['rrdHeadroom.col.memAvg'] ?? 'Mem mean'}</th>
              </tr>
            </thead>
            <tbody>
              {view.rrdHeadroom.perNode.slice(0, TOP_N_CLUSTERS).map((n) => (
                <tr key={`rrdn-${slug(n.node)}`}>
                  <td>{n.node}</td>
                  <td className="num">{fmtPercentWhole(n.cpuPeak, loc)}</td>
                  <td className="num">{fmtPercentWhole(n.cpuAvg, loc)}</td>
                  <td className="num">{fmtPercentWhole(n.memPeak, loc)}</td>
                  <td className="num">{fmtPercentWhole(n.memAvg, loc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {view.rrdStorageGrowth.hasData ? (
        <Section
          id="rrd-storage-growth"
          title={strings['storageGrowth.title'] ?? 'Storage time-to-full — RRD growth'}
        >
          <Metric
            label={strings['storageGrowth.kpi.storages'] ?? 'Storages'}
            value={fmtInt(view.rrdStorageGrowth.rows.length, loc)}
          />
          <Metric
            label={strings['storageGrowth.kpi.soonest'] ?? 'Soonest full (days)'}
            value={
              view.rrdStorageGrowth.soonestDaysToFull === null
                ? NA
                : fmtInt(Math.round(view.rrdStorageGrowth.soonestDaysToFull), loc)
            }
          />
          <Metric
            label={strings['storageGrowth.kpi.window'] ?? 'Window (days)'}
            value={fmtInt(Math.round(view.rrdStorageGrowth.windowDays), loc)}
          />
          <table className="annex-table">
            <thead>
              <tr>
                <th>{strings['storageGrowth.col.storage'] ?? 'Storage'}</th>
                <th>{strings['storageGrowth.col.node'] ?? 'Node'}</th>
                <th>{strings['storageGrowth.col.used'] ?? 'Used (GiB)'}</th>
                <th>{strings['storageGrowth.col.size'] ?? 'Size (GiB)'}</th>
                <th>{strings['storageGrowth.col.growth'] ?? 'Growth (GiB/day)'}</th>
                <th>{strings['storageGrowth.col.daysToFull'] ?? 'Days to full'}</th>
              </tr>
            </thead>
            <tbody>
              {view.rrdStorageGrowth.rows.slice(0, TOP_N_CLUSTERS).map((r) => (
                <tr key={`rrds-${slug(r.key)}`}>
                  <td>{r.storage}</td>
                  <td>{r.node}</td>
                  <td className="num">{fmtInt(Math.round(r.usedGib), loc)}</td>
                  <td className="num">{fmtInt(Math.round(r.sizeGib), loc)}</td>
                  <td className="num">{fmtInt(Math.round(r.growthGibPerDay * 10) / 10, loc)}</td>
                  <td className="num">
                    {r.daysToFull === null ? NA : fmtInt(Math.round(r.daysToFull), loc)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {view.fsFillRisk.overThresholdCount > 0 ||
      view.diskHygiene.unusedCount > 0 ||
      view.backupCoverage.vzdump.totalCount > 0 ? (
        <Section id="protection" title={strings['protection.heading'] ?? 'Protection & Risk'}>
          <Metric
            label={strings['protection.fsFill.kpi.overThreshold'] ?? 'Mounts over threshold'}
            value={fmtInt(view.fsFillRisk.overThresholdCount, loc)}
            flag={view.fsFillRisk.overThresholdCount > 0}
          />
          <Metric
            label={strings['protection.diskHygiene.kpi.unusedCount'] ?? 'Orphaned disks'}
            value={fmtInt(view.diskHygiene.unusedCount, loc)}
            flag={view.diskHygiene.unusedCount > 0}
          />
          <Metric
            label={strings['protection.diskHygiene.kpi.reclaimableGb'] ?? 'Reclaimable (GB)'}
            value={fmtInt(Math.round(view.diskHygiene.reclaimableGb), loc)}
          />
          <Metric
            label={strings['protection.diskHygiene.kpi.strayIsoCount'] ?? 'Stray ISOs'}
            value={fmtInt(view.diskHygiene.strayIsoCount, loc)}
            flag={view.diskHygiene.strayIsoCount > 0}
          />
          <Metric
            label={strings['protection.backupCoverage.kpi.uncoveredCount'] ?? 'VMs without backup'}
            value={fmtInt(view.backupCoverage.vzdump.uncoveredCount, loc)}
            flag={view.backupCoverage.vzdump.uncoveredCount > 0}
          />
          <Metric
            label={strings['protection.backupCoverage.kpi.total'] ?? 'vzdump tasks'}
            value={fmtInt(view.backupCoverage.vzdump.totalCount, loc)}
          />
          {view.fsFillRisk.overThreshold.length > 0 ? (
            <table className="annex-table">
              <thead>
                <tr>
                  <th>{strings['protection.fsFill.col.node'] ?? 'Node'}</th>
                  <th>{strings['protection.fsFill.col.vmName'] ?? 'VM'}</th>
                  <th>{strings['protection.fsFill.col.mountPoint'] ?? 'Mount point'}</th>
                  <th>{strings['protection.fsFill.col.usedPct'] ?? 'Used %'}</th>
                </tr>
              </thead>
              <tbody>
                {view.fsFillRisk.overThreshold.slice(0, 20).map((r) => (
                  <tr key={`fs-${slug(r.node)}-${slug(r.vmId)}-${slug(r.mountPoint)}`}>
                    <td>{r.node}</td>
                    <td>{r.vmName || r.vmId}</td>
                    <td>{r.mountPoint}</td>
                    <td className="num">
                      {r.usedPct !== null ? `${fmtInt(Math.round(r.usedPct), loc)} %` : NA}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Section>
      ) : null}

      {(view.governance.issues.totalCount > 0 ||
        view.governance.access.userCount > 0 ||
        view.governance.pools.poolCount > 0) && (
        <Section id="governance" title={strings['governance.title'] ?? 'Governance & Operations'}>
          {view.governance.issues.totalCount > 0 && (
            <>
              <Metric
                label={strings['governance.issues.total'] ?? 'Issues total'}
                value={fmtInt(view.governance.issues.totalCount, loc)}
              />
              <Metric
                label={strings['governance.issues.errors'] ?? 'Errors'}
                value={fmtInt(view.governance.issues.errorCount, loc)}
              />
              <Metric
                label={strings['governance.issues.warnings'] ?? 'Warnings'}
                value={fmtInt(view.governance.issues.warningCount, loc)}
              />
            </>
          )}
          {view.governance.access.userCount > 0 && (
            <>
              <Metric
                label={strings['governance.access.users'] ?? 'Users'}
                value={fmtInt(view.governance.access.userCount, loc)}
              />
              <Metric
                label={strings['governance.access.tokens'] ?? 'API tokens'}
                value={fmtInt(view.governance.access.tokenCount, loc)}
              />
              <Metric
                label={strings['governance.access.acls'] ?? 'ACL entries'}
                value={fmtInt(view.governance.access.aclCount, loc)}
              />
            </>
          )}
          {view.governance.pools.poolCount > 0 && (
            <>
              <Metric
                label={strings['governance.pools.count'] ?? 'Resource pools'}
                value={fmtInt(view.governance.pools.poolCount, loc)}
              />
              <Metric
                label={strings['governance.pools.members'] ?? 'Pool members'}
                value={fmtInt(view.governance.pools.totalMembers, loc)}
              />
            </>
          )}
        </Section>
      )}

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
