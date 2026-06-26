import { z } from 'zod'
import type { Cores, MHz, MiB, Sockets } from '@/engines/units'
import type {
  GuestRow,
  NodeRow,
  StorageRow,
  VDvPortRow,
  VDvSwitchRow,
  VMetaDataRow,
  VmUsageRow,
  VNetworkRow,
  VPartitionRow,
  VSwitchRow,
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

const NonNegIntSchema = z.number().int().nonnegative()

export const VNetworkRowSchema: z.ZodType<VNetworkRow> = z.object({
  vm: z.string().trim().min(1),
  network: z.string().trim(),
  switch: z.string().trim(),
  adapter: z.string().trim(),
  connected: z.string().trim(),
  cluster: z.string().trim(),
  host: z.string().trim(),
})

export const VSwitchRowSchema: z.ZodType<VSwitchRow> = z.object({
  host: z.string().trim().min(1),
  cluster: z.string().trim(),
  switch: z.string().trim().min(1),
  ports: NonNegIntSchema,
  freePorts: NonNegIntSchema,
  mtu: NonNegIntSchema,
})

export const VDvSwitchRowSchema: z.ZodType<VDvSwitchRow> = z.object({
  switch: z.string().trim().min(1),
  name: z.string().trim(),
  version: z.string().trim(),
  hostMembers: z.string().trim(),
  ports: NonNegIntSchema,
  vms: NonNegIntSchema,
  maxMtu: NonNegIntSchema,
})

export const VDvPortRowSchema: z.ZodType<VDvPortRow> = z.object({
  port: z.string().trim().min(1),
  switch: z.string().trim(),
  vlan: z.string().trim(),
  activeUplink: z.string().trim(),
  standbyUplink: z.string().trim(),
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
