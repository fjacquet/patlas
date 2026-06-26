import { z } from 'zod'
import type { Cores, MHz, MiB, Sockets } from '@/engines/units'
import type {
  GuestRow,
  NodeInterfaceRow,
  NodeRow,
  ProxmoxDiskRow,
  ProxmoxPartitionRow,
  ProxmoxTaskRow,
  StorageRow,
  VMetaDataRow,
  VmNicRow,
  VmUsageRow,
  VPartitionRow,
} from '@/types'

/**
 * Runtime validators for the canonical row shapes — applied at the parser
 * boundary (the one place vatlas runs Zod; engines stay Zod-free, 01-RESEARCH
 * A8). A row that fails validation is dropped and reported as an
 * `invalid-row` ParseError; engines downstream never re-validate.
 *
 * Branded outputs use a hand-rolled `.transform((n) => n as MiB)` (NOT Zod's
 * `.brand<'MiB'>()`, per RESEARCH.md A8) so the brand matches the units
 * module exactly. The `z.ZodType<T>` annotations keep the schemas in
 * lock-step with the TS types — drift stops this file compiling.
 */

const MibSchema = z
  .number()
  .nonnegative()
  .transform((n) => n as MiB)
const CoresSchema = z
  .number()
  .int()
  .nonnegative()
  .transform((n) => n as Cores)
// Nullable branded metrics for the vMemory/vCPU usage row — `null` means the
// cell was absent/blank ("not derivable"; ADR-0012), NEVER coerced to 0.
const NullableMibSchema = z
  .number()
  .nonnegative()
  .nullable()
  .transform((n) => (n === null ? null : (n as MiB)))
const NullableMhzSchema = z
  .number()
  .nonnegative()
  .nullable()
  .transform((n) => (n === null ? null : (n as MHz)))
// vHost cores/speed must be strictly positive (a host with 0 cores or 0 MHz
// is a corrupt row, not inventory) — distinct base schemas, NOT a `.pipe()`
// over the already-branded schema (a pipe re-declares the input as the brand
// type, breaking the `z.ZodType<T>` annotation under `tsc -b`).
const PositiveCoresSchema = z
  .number()
  .int()
  .positive()
  .transform((n) => n as Cores)
const PositiveMhzSchema = z
  .number()
  .positive()
  .transform((n) => n as MHz)
const SocketsSchema = z
  .number()
  .int()
  .positive()
  .transform((n) => n as Sockets)

export const GuestRowSchema: z.ZodType<GuestRow> = z.object({
  vmName: z.string().trim().min(1),
  cluster: z.string().trim().min(1),
  host: z.string().trim(),
  vcpu: CoresSchema,
  vramMib: MibSchema,
  cpuReadinessPercent: z.number().min(0).max(200).nullable(),
  powerState: z.enum(['poweredOn', 'poweredOff', 'suspended']),
  template: z.boolean(),
  poweredOn: z.boolean(),
  osConfig: z.string().trim(),
  osTools: z.string().trim(),
  vmBiosUuid: z.string().trim(),
  vmInstanceUuid: z.string().trim(),
  viSdkUuid: z.string().trim(),
  viSdkServer: z.string().trim(),
  provisionedMib: MibSchema,
  inUseMib: MibSchema,
  // Empty allowed — the `[datastore] vm/vm.vmx` token is absent in some
  // exports. Do NOT `.min(1)`: that would drop legitimate path-less rows
  // (the P5 Powerstate/Template precedent).
  path: z.string().trim(),
  // Proxmox guest kind — required; the adapter sets it on every row.
  guestType: z.enum(['qemu', 'lxc']),
})

export const NodeRowSchema: z.ZodType<NodeRow> = z.object({
  hostName: z.string().trim().min(1),
  cluster: z.string().trim(),
  sockets: SocketsSchema,
  cores: PositiveCoresSchema,
  speedMhz: PositiveMhzSchema,
  memoryMib: MibSchema,
  cpuRatio: z.number().min(0).max(1.5),
  ramRatio: z.number().min(0).max(1.5),
  // Empty string allowed — most hosts carry no vSAN fault-domain tag.
  faultDomain: z.string().trim(),
  model: z.string().trim(),
  vendor: z.string().trim(),
  serialNumber: z.string().trim(),
  esxVersion: z.string().trim(),
})

export const StorageRowSchema: z.ZodType<StorageRow> = z.object({
  name: z.string().trim().min(1),
  capacityMib: MibSchema,
  freeMib: MibSchema,
  provisionedMib: MibSchema,
  naa: z.string().trim().min(1).nullable(),
  type: z.string().trim(),
  // Empty string allowed — not every datastore lists its host set.
  hosts: z.string().trim(),
  // Empty string allowed — a host-local datastore has no cluster. Do NOT
  // .min(1)/require: that would drop legitimately cluster-less rows.
  clusterName: z.string().trim(),
})

export const VPartitionRowSchema: z.ZodType<VPartitionRow> = z.object({
  vmName: z.string().trim().min(1),
  disk: z.string().trim(),
  capacityMib: MibSchema,
  consumedMib: MibSchema,
  freeMib: MibSchema,
})

export const NodeInterfaceRowSchema: z.ZodType<NodeInterfaceRow> = z.object({
  node: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: z.string().trim(),
  active: z.boolean(),
  autostart: z.boolean(),
  method: z.string().trim(),
  cidr: z.string().trim(),
  address: z.string().trim(),
  gateway: z.string().trim(),
  mtu: z.number().int().nonnegative().nullable(),
  bondMode: z.string().trim(),
  slaves: z.array(z.string()),
  bridgePorts: z.string().trim(),
  bridgeVlanAware: z.boolean(),
  vlanId: z.number().int().nonnegative().nullable(),
  vlanRawDevice: z.string().trim(),
  comments: z.string().trim(),
})

export const VmNicRowSchema: z.ZodType<VmNicRow> = z.object({
  node: z.string().trim().min(1),
  vmId: z.string().trim(),
  vmName: z.string().trim(),
  vmType: z.string().trim(),
  macAddress: z.string().trim(),
  bridge: z.string().trim(),
  tag: z.number().int().nonnegative().nullable(),
  model: z.string().trim(),
})

export const VMetaDataRowSchema: z.ZodType<VMetaDataRow> = z.object({
  entries: z.array(
    z.object({
      server: z.string(),
      rvtoolsVersion: z.string().nullable(),
      exportedTimestamp: z.string().nullable(),
    }),
  ),
})

/**
 * Minimal validated shape for one "RRD Nodes" time-series sample. Used at the
 * parser boundary by `adaptProxmoxRrdNodes` to build a per-node cpuRatio map;
 * engines downstream never see raw RRD rows.
 *
 * cpuUsagePct is a 0-1 fraction in the Proxmox report (real values ~0.01–0.32);
 * max 1.5 to absorb transient spikes without rejecting the row.
 */
export const RrdNodeSampleSchema = z.object({
  node: z.string().trim().min(1),
  timeDate: z.string(),
  cpuUsagePct: z.number().min(0).max(1.5),
})
export type RrdNodeSample = z.infer<typeof RrdNodeSampleSchema>

export const ProxmoxPartitionRowSchema: z.ZodType<ProxmoxPartitionRow> = z.object({
  node: z.string().trim().min(1),
  vmId: z.string().trim(),
  vmName: z.string().trim(),
  vmType: z.string().trim(),
  vmStatus: z.string().trim(),
  mountPoint: z.string().trim().min(1),
  fsType: z.string().trim(),
  totalGb: z.number().nonnegative(),
  usedGb: z.number().nonnegative(),
  usedFraction: z.number().min(0).max(2).nullable(),
  error: z.string().trim(),
  name: z.string().trim(),
  disks: z.string().trim(),
})

export const ProxmoxDiskRowSchema: z.ZodType<ProxmoxDiskRow> = z.object({
  node: z.string().trim().min(1),
  vmId: z.string().trim(),
  vmName: z.string().trim(),
  vmType: z.string().trim(),
  vmStatus: z.string().trim(),
  kind: z.string().trim(),
  id: z.string().trim(),
  storage: z.string().trim(),
  storageType: z.string().trim(),
  storageShared: z.boolean(),
  fileName: z.string().trim(),
  sizeGb: z.number().nonnegative(),
  storageUsageFraction: z.number().min(0).max(2).nullable(),
  cache: z.string().trim(),
  backup: z.string().trim(),
  isUnused: z.boolean(),
  device: z.string().trim(),
  mountPoint: z.string().trim(),
})

export const ProxmoxTaskRowSchema: z.ZodType<ProxmoxTaskRow> = z.object({
  node: z.string().trim().min(1),
  taskId: z.string().trim(),
  type: z.string().trim().min(1),
  user: z.string().trim(),
  status: z.string().trim(),
  statusOk: z.boolean(),
  startSerial: z.number().nullable(),
  endSerial: z.number().nullable(),
  durationDays: z.number().nonnegative().nullable(),
})

/**
 * Per-VM runtime metrics from `vMemory`+`vCPU`. Branded MiB/MHz; every metric
 * is nullable ("not derivable" when the cell is absent/blank — never 0).
 * `cluster`/uuid columns are allowed empty (vMemory/vCPU may omit them).
 */
export const VmUsageRowSchema: z.ZodType<VmUsageRow> = z.object({
  vmName: z.string().trim().min(1),
  cluster: z.string().trim(),
  vmBiosUuid: z.string().trim(),
  vmInstanceUuid: z.string().trim(),
  activeMib: NullableMibSchema,
  consumedMib: NullableMibSchema,
  balloonedMib: NullableMibSchema,
  swappedMib: NullableMibSchema,
  cpuUsageMhz: NullableMhzSchema,
})
