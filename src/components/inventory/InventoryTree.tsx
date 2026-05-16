import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EsxAggregate, VmDisplayRow } from '@/types/estate'

/**
 * Virtualised inventory tree (INV-01). Implements the 03-RESEARCH §Pattern 2
 * "flatten-tree-to-rows + lazy children" recipe — the 10k memory budget
 * (Critical-5, T-03-10): the visible flat array is derived on demand from
 * `expanded`, children are materialised ONLY when their parent id is in the
 * expanded set, and the TanStack expanded-row-model API is deliberately NOT
 * used (it would materialise the full 36k-leaf subtree). No parallel
 * tree-of-objects is ever held.
 *
 * Hierarchy: synthetic vCenter root (`rootLabel`) → Cluster → ESX → VM. NO
 * Datacenter level (03-RESEARCH A1). Selecting a node scopes the active table
 * (root selected / null = unscoped). All node/count text is rendered as React
 * text children (auto-escaped — T-03-13). State is component `useState` only —
 * never browser-persisted (privacy invariant, T-03-11).
 *
 * `buildVisibleRows` is render-derived presentation state, not aggregation —
 * a plain call (03-RESEARCH line 199: the one-useMemo rule is about
 * *aggregation*, not render shaping; window cost here is bounded so no memo
 * is needed).
 */

const ROW_HEIGHT = 36
const INDENT_PX = 16

/** A selection scope handed up to `InventoryView` to filter the active table. */
export interface TreeSelection {
  kind: 'root' | 'cluster' | 'host'
  /** Cluster name when kind is `cluster` or `host`; undefined for root. */
  cluster?: string
  /** Host name when kind is `host`; undefined otherwise. */
  host?: string
}

export interface InventoryTreeProps {
  rootLabel: string
  clustersOrdered: string[]
  hostsByCluster: Map<string, EsxAggregate[]>
  vmsByHost: Map<string, VmDisplayRow[]>
  selectedId: string | null
  onSelect: (id: string, selection: TreeSelection) => void
}

type NodeKind = 'root' | 'cluster' | 'host' | 'vm'

interface FlatNode {
  id: string
  kind: NodeKind
  label: string
  depth: number
  /** Child count badge (always known — 0 shows `0`, never em-dash). */
  count: number
  expandable: boolean
  expanded: boolean
  selection: TreeSelection
}

const ROOT_ID = 'root'
const clusterId = (c: string) => `cl:${c}`
const hostId = (h: string) => `esx:${h}`

/**
 * Walk the pre-indexed maps producing only the rows currently visible: the
 * root, every cluster, and — only when the parent id is in `expanded` — that
 * parent's children. Length ≈ only-opened (lazy children).
 */
function buildVisibleRows(
  rootLabel: string,
  clustersOrdered: string[],
  hostsByCluster: Map<string, EsxAggregate[]>,
  vmsByHost: Map<string, VmDisplayRow[]>,
  expanded: Set<string>,
): FlatNode[] {
  const rootExpanded = expanded.has(ROOT_ID)
  const out: FlatNode[] = [
    {
      id: ROOT_ID,
      kind: 'root',
      label: rootLabel,
      depth: 0,
      count: clustersOrdered.length,
      expandable: clustersOrdered.length > 0,
      expanded: rootExpanded,
      selection: { kind: 'root' },
    },
  ]
  if (!rootExpanded) return out

  for (const cluster of clustersOrdered) {
    const hosts = hostsByCluster.get(cluster) ?? []
    const cId = clusterId(cluster)
    const cExpanded = expanded.has(cId)
    out.push({
      id: cId,
      kind: 'cluster',
      label: cluster,
      depth: 1,
      count: hosts.length,
      expandable: hosts.length > 0,
      expanded: cExpanded,
      selection: { kind: 'cluster', cluster },
    })
    if (!cExpanded) continue

    for (const host of hosts) {
      const vms = vmsByHost.get(host.hostName) ?? []
      const hId = hostId(host.hostName)
      const hExpanded = expanded.has(hId)
      out.push({
        id: hId,
        kind: 'host',
        label: host.hostName,
        depth: 2,
        count: vms.length,
        expandable: vms.length > 0,
        expanded: hExpanded,
        selection: { kind: 'host', cluster, host: host.hostName },
      })
      if (!hExpanded) continue

      for (const vm of vms) {
        out.push({
          id: `vm:${host.hostName}/${vm.vmName}`,
          kind: 'vm',
          label: vm.vmName,
          depth: 3,
          count: 0,
          expandable: false,
          expanded: false,
          selection: { kind: 'host', cluster, host: host.hostName },
        })
      }
    }
  }
  return out
}

export function InventoryTree({
  rootLabel,
  clustersOrdered,
  hostsByCluster,
  vmsByHost,
  selectedId,
  onSelect,
}: InventoryTreeProps) {
  const { t } = useTranslation('inventory')
  // Root opens by default so the estate is browsable on first paint.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([ROOT_ID]))

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const flat = buildVisibleRows(rootLabel, clustersOrdered, hostsByCluster, vmsByHost, expanded)

  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    // jsdom never lays out / measures the scroll element (getBoundingClientRect
    // returns 0×0), so the virtualiser would otherwise emit an empty window in
    // tests. A deterministic initial viewport keeps a bounded window in jsdom;
    // the real ResizeObserver measurement supersedes it in the browser.
    initialRect: { width: 320, height: 600 },
  })
  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div
      ref={scrollRef}
      role="tree"
      aria-label={t('tree.label')}
      className="max-h-[70vh] min-h-[12rem] overflow-auto"
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualItems.map((vi) => {
          const node = flat[vi.index]
          if (!node) return null
          const selected = node.id === selectedId
          return (
            <div
              key={node.id}
              role="treeitem"
              tabIndex={selected ? 0 : -1}
              aria-level={node.depth + 1}
              aria-selected={selected}
              aria-expanded={node.expandable ? node.expanded : undefined}
              data-index={vi.index}
              className={`absolute flex w-full items-center gap-1 pr-2 ${
                selected
                  ? 'bg-accent-500/15 text-slate-900 ring-1 ring-inset ring-accent-500 dark:text-slate-100'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-800'
              }`}
              style={{
                height: `${ROW_HEIGHT}px`,
                transform: `translateY(${vi.start}px)`,
                paddingLeft: `${node.depth * INDENT_PX + 8}px`,
              }}
            >
              {node.expandable ? (
                <button
                  type="button"
                  aria-label={node.label}
                  aria-expanded={node.expanded}
                  onClick={() => toggle(node.id)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block transition-transform ${
                      node.expanded ? 'rotate-90' : ''
                    }`}
                  >
                    ▶
                  </span>
                </button>
              ) : (
                <span aria-hidden="true" className="h-5 w-5 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => onSelect(node.id, node.selection)}
                className="flex min-w-0 flex-1 items-center gap-2 truncate text-left font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <span className="truncate">{node.label}</span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 text-xs font-normal text-slate-500 dark:bg-surface-800 dark:text-slate-400">
                  {node.count}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
