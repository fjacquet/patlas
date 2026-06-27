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
 *  P8 (Pack A) consumes the full series for node-headroom analytics.
 *  "%" columns are 0-1 fractions in the Proxmox report. */
export const RRD_NODE_COLS = {
  node: ['node'],
  timeDate: ['time date'],
  cpuUsagePct: ['cpu usage %'],
  memUsagePct: ['memory usage %'],
  ioWaitPct: ['io wait %'],
  loadavg: ['loadavg'],
  netInMb: ['net in mb'],
  netOutMb: ['net out mb'],
  psiMemSomePct: ['psi mem some %'],
} as const

/** Column map for the "RRD Storage" time-series sheet (P8 Pack A). One row
 *  per node+storage+timestamp. `Usage %` is a 0-1 fraction; `Size GB`/`Used
 *  GB` are reinterpreted as GiB (ADR-0010). The capacity-growth engine reads
 *  only these six columns in a single pass (the sheet has ~36k rows). */
export const RRD_STORAGE_COLS = {
  node: ['node'],
  storage: ['storage'],
  timeDate: ['time date'],
  sizeGib: ['size gb'],
  usedGib: ['used gb'],
  usagePct: ['usage %'],
} as const

/** Column map for the OPTIONAL "RRD Guests" time-series sheet (P8 Pack A,
 *  defensive). Empty in current exports but supported; parsed when present,
 *  degrades to `[]` otherwise. Aliases cover the likely guest-RRD headers. */
export const RRD_GUEST_COLS = {
  vmId: ['vm id'],
  node: ['node'],
  timeDate: ['time date'],
  cpuUsagePct: ['cpu usage %'],
  memUsagePct: ['memory usage %'],
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

/** Column map for the flat `Issues` sheet (Pack C). */
export const ISSUE_COLS = {
  severity: ['severity'],
  section: ['section'],
  message: ['message'],
  timestamp: ['timestamp'],
  linkKey: ['link key'],
} as const

/** Column map for the "Users" sub-table in the stacked `Cluster Access` sheet. */
export const ACCESS_USER_COLS = {
  id: ['id'],
  enable: ['enable'],
  firstname: ['firstname'],
  lastname: ['lastname'],
  email: ['email'],
  groups: ['groups'],
  keys: ['keys'],
  totpLocked: ['totp locked'],
  expire: ['expire'],
  comment: ['comment'],
} as const

/** Column map for the "API Tokens" sub-table in the stacked `Cluster Access` sheet. */
export const ACCESS_TOKEN_COLS = {
  user: ['user'],
  tokenId: ['token id'],
  expire: ['expire'],
  privSeparated: ['priv separated'],
  comment: ['comment'],
} as const

/** Column map for the "Roles" sub-table in the stacked `Cluster Access` sheet. */
export const ACCESS_ROLE_COLS = {
  id: ['id'],
  privileges: ['privileges'],
  special: ['special'],
} as const

/** Column map for the "ACL" sub-table in the stacked `Cluster Access` sheet. */
export const ACCESS_ACL_COLS = {
  path: ['path'],
  usersOrGroup: ['users or group'],
  type: ['type'],
  roleId: ['id'],
  propagate: ['propagate'],
} as const

/**
 * Column map for the "Pools" data rows in the `Cluster Pools` sheet.
 * This sheet cannot be parsed with `extractStackedSection` due to a TOC
 * row that appears before the actual section header — a custom scanner is
 * used instead (see `adaptProxmoxPoolMembers` in proxmox.ts).
 */
export const POOL_MEMBER_COLS = {
  pool: ['pool'],
  type: ['type'],
  node: ['node'],
  vmId: ['vm id'],
  storage: ['storage'],
  status: ['status'],
  description: ['description'],
  comment: ['comment'],
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

/** Column map for the "Partitions" sheet. "Used %" is a 0–1 fraction. */
export const PARTITION_COLS = {
  node: ['node'],
  vmId: ['vm id'],
  vmName: ['vm name'],
  vmType: ['vm type'],
  vmStatus: ['vm status'],
  mountPoint: ['mount point'],
  fsType: ['type'],
  totalGb: ['total gb'],
  usedGb: ['used gb'],
  usedPct: ['used %'],
  error: ['error'],
  name: ['name'],
  disks: ['disks'],
} as const

/** Column map for the "Disks" sheet. "Storage Usage %" is a 0–1 fraction. */
export const DISK_COLS = {
  node: ['node'],
  vmId: ['vm id'],
  vmName: ['vm name'],
  vmType: ['vm type'],
  vmStatus: ['vm status'],
  kind: ['kind'],
  id: ['id'],
  storage: ['storage'],
  storageType: ['storage type'],
  storageShared: ['storage shared'],
  fileName: ['file name'],
  sizeGb: ['size gb'],
  storageUsagePct: ['storage usage %'],
  cache: ['cache'],
  backup: ['backup'],
  isUnused: ['is unused'],
  device: ['device'],
  mountPoint: ['mount point'],
} as const

/** Column map for the "Cluster Tasks" sheet. */
export const TASK_COLS = {
  node: ['node'],
  taskId: ['unique task id'],
  type: ['type'],
  user: ['user'],
  status: ['status'],
  statusOk: ['status ok'],
  startTime: ['start time'],
  endTime: ['end time'],
  duration: ['duration'],
} as const
