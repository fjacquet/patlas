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
