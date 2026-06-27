import type { EChartsOption } from 'echarts/types/dist/shared'
import type { TopologyNode, TopologyView } from '@/engines/aggregation/topologyTree'

/** Translatable annotations passed in by each render site (the builder is
 *  pure and cannot call i18n). Numbers are interpolated here via `replace`. */
export interface TopologyLabels {
  estate: string
  nodesWord: string
  /** carries `{{count}}` */
  unconfigured: string
  vms: string
  /** carries `{{withVms}}` and `{{total}}` */
  ofNodes: string
}

const MIN_H = 360
const MAX_H = 2400
const PX_PER_LEAF = 46

interface EchartsTreeDatum {
  name: string
  children?: EchartsTreeDatum[]
}

const leafLabel = (n: TopologyNode, l: TopologyLabels): string => {
  if (n.vmCount === undefined) return n.name
  const spread = n.vmNodeSpread
    ? ` · ${l.ofNodes.replace('{{withVms}}', String(n.vmNodeSpread.withVms)).replace('{{total}}', String(n.vmNodeSpread.total))}`
    : ''
  return `${n.name} · ${n.vmCount} ${l.vms}${spread}`
}

const toDatum = (n: TopologyNode, l: TopologyLabels): EchartsTreeDatum => ({
  name: n.children && n.children.length > 0 ? n.name : leafLabel(n, l),
  ...(n.children && n.children.length > 0
    ? { children: n.children.map((c) => toDatum(c, l)) }
    : {}),
})

const countLeaves = (n: TopologyNode): number =>
  !n.children || n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + countLeaves(c), 0)

export function topologyTreeOption(
  view: TopologyView,
  l: TopologyLabels,
): { option: EChartsOption; height: number } {
  const groupData: EchartsTreeDatum[] = view.groups.map((g) => {
    const head =
      g.unconfiguredNicCount > 0
        ? ` · ${l.unconfigured.replace('{{count}}', String(g.unconfiguredNicCount))}`
        : ''
    return {
      name: `${g.nodes.join(', ')}  (× ${g.nodes.length} ${l.nodesWord}${head})`,
      children: g.roots.map((r) => toDatum(r, l)),
    }
  })

  const totalLeaves = view.groups.reduce(
    (s, g) => s + g.roots.reduce((rs, r) => rs + countLeaves(r), 0),
    0,
  )
  const height = Math.min(MAX_H, Math.max(MIN_H, totalLeaves * PX_PER_LEAF))

  const option: EChartsOption = {
    series: [
      {
        type: 'tree',
        layout: 'orthogonal',
        orient: 'LR',
        data: [{ name: l.estate, children: groupData }],
        top: 16,
        bottom: 16,
        left: 24,
        right: 220,
        symbolSize: 8,
        label: { position: 'right', align: 'left', fontSize: 12 },
        leaves: { label: { position: 'right', align: 'left' } },
        expandAndCollapse: false,
        initialTreeDepth: -1,
      },
    ],
  }
  return { option, height }
}
