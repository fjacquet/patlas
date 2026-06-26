/** Proxmox report column aliases. Headers are normalised (lower-cased,
 *  trimmed) by `mapColumns` before comparison; first match wins. */
export const NODE_COLS = {
  node: ['node'],
  sockets: ['cpu sockets'],
  cores: ['cpu cores'],
  speedMhz: ['cpu mhz'],
  memoryGib: ['memory size gb'],
  memUsagePct: ['memory usage %'],
  model: ['cpu model'],
  pveVersion: ['pve version'],
} as const

export const GUEST_COLS = {
  vmName: ['name'],
  node: ['node'],
  vmId: ['vm id'],
  pool: ['pool'],
  cores: ['cores'],
  sockets: ['sockets'],
  vramGib: ['memory size gb'],
  status: ['status'],
  template: ['is template'],
  osName: ['os name'],
  osVersion: ['os version'],
  diskSizeGib: ['disk size gb'],
  diskUsageGib: ['disk usage gb'],
  cpuUsagePct: ['cpu usage %'],
  hostCpuPct: ['host cpu usage %'],
  memUsageGib: ['memory usage gb'],
  memUsagePct: ['memory usage %'],
  hostMemPct: ['host memory usage %'],
} as const

export const STORAGE_COLS = {
  node: ['node'],
  name: ['storage'],
  pluginType: ['plugin type'],
  content: ['content'],
  shared: ['shared'],
  capacityGib: ['disk size gb'],
  usageGib: ['disk usage gb'],
} as const

export const CLUSTER_COLS = {
  name: ['name'],
} as const

export const SNAPSHOT_COLS = {
  node: ['node'],
  guestId: ['vm id'],
  guestName: ['vm name'],
  guestType: ['vm type'],
  name: ['snapshot'],
  parent: ['parent'],
  date: ['date'],
  includeRam: ['include ram'],
  sizeGib: ['size gb'],
} as const

export const STORAGE_CONTENT_COLS = {
  node: ['node'],
  storage: ['storage'],
  content: ['content'],
  fileName: ['file name'],
  format: ['format'],
  sizeGib: ['size gb'],
  usagePercent: ['storage usage %'],
  guestId: ['vm id'],
  guestName: ['guest name'],
  creationDate: ['creation date'],
} as const

export const HA_RESOURCE_COLS = {
  sid: ['sid'],
  type: ['type'],
  state: ['state'],
  group: ['group'],
  failback: ['failback'],
  maxRestart: ['max restart'],
  maxRelocate: ['max relocate'],
  comment: ['comment'],
} as const

export const HA_STATUS_COLS = {
  id: ['id'],
  type: ['type'],
  status: ['status'],
  node: ['node'],
  sid: ['sid'],
  state: ['state'],
  crmState: ['crm state'],
  requestState: ['request state'],
  quorate: ['quorate'],
} as const

export const BACKUP_JOB_COLS = {
  id: ['id'],
  enabled: ['enabled'],
  all: ['all'],
  vmId: ['vm id'],
  mode: ['mode'],
  storage: ['storage'],
  startTime: ['start time'],
  schedule: ['schedule'],
  dayOfWeek: ['day of week'],
  compress: ['compress'],
  type: ['type'],
  node: ['node'],
} as const

/** Column map for the "RRD Nodes" time-series sheet. Each row is one sample
 *  for one node. P3 uses node/timeDate/cpuUsagePct to derive cpuRatio;
 *  the remaining columns are mapped now so P8 can reuse without touching
 *  this file again. */
export const RRD_NODE_COLS = {
  node: ['node'],
  timeDate: ['time date'],
  cpuUsagePct: ['cpu usage %'],
  memUsagePct: ['memory usage %'],
  ioWaitPct: ['io wait %'],
  loadavg: ['loadavg'],
} as const

/**
 * Column map for the "Nodes Networks" stacked sub-table inside the "Network"
 * sheet. Headers normalised to lower-case by `mapColumns`.
 * The `type` column is the Proxmox primitive: eth | bond | bridge | vlan |
 * ovs_* | vxlan. (P5.)
 */
export const NETWORK_NODES_COLS = {
  node: ['node'],
  active: ['active'],
  autostart: ['auto start'],
  type: ['type'],
  name: ['interface'],
  method: ['method'],
  cidr: ['cidr'],
  address: ['address'],
  gateway: ['gateway'],
  mtu: ['mtu'],
  bondMode: ['bond mode'],
  slaves: ['slaves'],
  bridgePorts: ['bridge ports'],
  bridgeVlanAware: ['bridge vlan aware'],
  vlanId: ['vlan id'],
  vlanRawDevice: ['vlan raw device'],
  comments: ['comments'],
} as const

/**
 * Column map for the "VM Networks" stacked sub-table inside the "Network"
 * sheet. One row per guest NIC. (P5.)
 */
export const NETWORK_VMS_COLS = {
  node: ['node'],
  vmId: ['vm id'],
  vmName: ['name'],
  vmType: ['type'],
  macAddress: ['mac address'],
  bridge: ['bridge'],
  tag: ['tag'],
  model: ['model'],
} as const
