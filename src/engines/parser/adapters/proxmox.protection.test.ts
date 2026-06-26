import { describe, expect, it } from 'vitest'
import type { ParsedSheet } from '../parseXlsx'
import { adaptProxmoxDisks, adaptProxmoxPartitions, adaptProxmoxTasks } from './proxmox'

const sheet = (headers: string[], rows: Record<string, unknown>[]): ParsedSheet => ({
  name: 'x',
  headers,
  rows,
  cells: [],
})

// ─── Partitions ────────────────────────────────────────────────────────────

const PARTITION_HEADERS = [
  'Node',
  'Vm Id',
  'Vm Name',
  'Vm Type',
  'Vm Status',
  'Mount Point',
  'Type',
  'Total Gb',
  'Used Gb',
  'Used %',
  'Error',
  'Name',
  'Disks',
]

const prow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  Node: 'pve1',
  'Vm Id': '101',
  'Vm Name': 'myvm',
  'Vm Type': 'qemu',
  'Vm Status': 'running',
  'Mount Point': '/',
  Type: 'ext4',
  'Total Gb': 80,
  'Used Gb': 72,
  'Used %': 0.9,
  Error: '',
  Name: 'root',
  Disks: 'scsi0',
  ...over,
})

describe('adaptProxmoxPartitions', () => {
  it('returns [] when sheet is absent', () => {
    expect(adaptProxmoxPartitions(undefined)).toEqual([])
  })

  it('parses a basic partition row with fractional Used %', () => {
    const rows = adaptProxmoxPartitions(sheet(PARTITION_HEADERS, [prow()]))
    expect(rows).toHaveLength(1)
    const r = rows[0]
    if (r === undefined) throw new Error('expected a parsed row')
    expect(r.node).toBe('pve1')
    expect(r.vmId).toBe('101')
    expect(r.vmName).toBe('myvm')
    expect(r.mountPoint).toBe('/')
    expect(r.totalGb).toBe(80)
    expect(r.usedGb).toBe(72)
    expect(r.usedFraction).toBeCloseTo(0.9)
  })

  it('sets usedFraction to null when Used % is blank', () => {
    const rows = adaptProxmoxPartitions(
      sheet(PARTITION_HEADERS, [prow({ 'Used %': '', 'Mount Point': '/data' })]),
    )
    expect(rows[0]?.usedFraction).toBeNull()
  })

  it('filters out rows with no node', () => {
    const rows = adaptProxmoxPartitions(
      sheet(PARTITION_HEADERS, [prow({ Node: '', 'Mount Point': '/tmp' })]),
    )
    expect(rows).toHaveLength(0)
  })

  it('filters out rows with no mount point', () => {
    const rows = adaptProxmoxPartitions(sheet(PARTITION_HEADERS, [prow({ 'Mount Point': '' })]))
    expect(rows).toHaveLength(0)
  })
})

// ─── Disks ────────────────────────────────────────────────────────────────

const DISK_HEADERS = [
  'Node',
  'Vm Id',
  'Vm Name',
  'Vm Type',
  'Vm Status',
  'Kind',
  'Id',
  'Storage',
  'Storage Type',
  'Storage Shared',
  'File Name',
  'Size Gb',
  'Storage Usage %',
  'Cache',
  'Backup',
  'Is Unused',
  'Device',
  'Mount Point',
]

const drow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  Node: 'pve1',
  'Vm Id': '101',
  'Vm Name': 'myvm',
  'Vm Type': 'qemu',
  'Vm Status': 'running',
  Kind: 'Disk',
  Id: 'scsi0',
  Storage: 'local-lvm',
  'Storage Type': 'lvmthin',
  'Storage Shared': '',
  'File Name': 'vm-101-disk-0.qcow2',
  'Size Gb': 50,
  'Storage Usage %': 0.4,
  Cache: 'none',
  Backup: 'X',
  'Is Unused': '',
  Device: '',
  'Mount Point': '',
  ...over,
})

describe('adaptProxmoxDisks', () => {
  it('returns [] when sheet is absent', () => {
    expect(adaptProxmoxDisks(undefined)).toEqual([])
  })

  it('parses a normal disk row', () => {
    const rows = adaptProxmoxDisks(sheet(DISK_HEADERS, [drow()]))
    expect(rows).toHaveLength(1)
    const r = rows[0]
    if (r === undefined) throw new Error('expected a parsed row')
    expect(r.kind).toBe('Disk')
    expect(r.id).toBe('scsi0')
    expect(r.sizeGb).toBe(50)
    expect(r.backup).toBe('X')
    expect(r.isUnused).toBe(false)
    expect(r.cache).toBe('none')
  })

  it('detects unused disks (Is Unused = X)', () => {
    const rows = adaptProxmoxDisks(
      sheet(DISK_HEADERS, [drow({ 'Is Unused': 'X', Backup: '', Id: 'unused0' })]),
    )
    expect(rows[0]?.isUnused).toBe(true)
  })

  it('parses a Cdrom row', () => {
    const rows = adaptProxmoxDisks(
      sheet(DISK_HEADERS, [drow({ Kind: 'Cdrom', Id: 'ide2', 'File Name': 'ubuntu-22.04.iso' })]),
    )
    expect(rows[0]?.kind).toBe('Cdrom')
    expect(rows[0]?.fileName).toBe('ubuntu-22.04.iso')
  })

  it('filters out rows with no node', () => {
    const rows = adaptProxmoxDisks(sheet(DISK_HEADERS, [drow({ Node: '' })]))
    expect(rows).toHaveLength(0)
  })

  it('sets storageUsageFraction to null when blank', () => {
    const rows = adaptProxmoxDisks(sheet(DISK_HEADERS, [drow({ 'Storage Usage %': null })]))
    expect(rows[0]?.storageUsageFraction).toBeNull()
  })
})

// ─── Tasks ────────────────────────────────────────────────────────────────

const TASK_HEADERS = [
  'Node',
  'Unique Task Id',
  'Type',
  'User',
  'Status',
  'Status Ok',
  'Start Time',
  'End Time',
  'Duration',
]

const trow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  Node: 'pve1',
  'Unique Task Id': 'UPID:pve1:00001234:00001234:67A00000:vzdump:100:root@pam:',
  Type: 'vzdump',
  User: 'root@pam',
  Status: 'OK',
  'Status Ok': 'X',
  'Start Time': 45678,
  'End Time': 45679,
  Duration: 0.01,
  ...over,
})

describe('adaptProxmoxTasks', () => {
  it('returns [] when sheet is absent', () => {
    expect(adaptProxmoxTasks(undefined)).toEqual([])
  })

  it('parses a vzdump task', () => {
    const rows = adaptProxmoxTasks(sheet(TASK_HEADERS, [trow()]))
    expect(rows).toHaveLength(1)
    const r = rows[0]
    if (r === undefined) throw new Error('expected a parsed row')
    expect(r.node).toBe('pve1')
    expect(r.type).toBe('vzdump')
    expect(r.statusOk).toBe(true)
    expect(r.startSerial).toBe(45678)
  })

  it('sets statusOk false when Status Ok is not X', () => {
    const rows = adaptProxmoxTasks(
      sheet(TASK_HEADERS, [trow({ 'Status Ok': '', Status: 'Failed' })]),
    )
    expect(rows[0]?.statusOk).toBe(false)
  })

  it('sets startSerial to null when blank', () => {
    const rows = adaptProxmoxTasks(
      sheet(TASK_HEADERS, [trow({ 'Start Time': '', 'End Time': '', Duration: '' })]),
    )
    expect(rows[0]?.startSerial).toBeNull()
  })

  it('filters out rows with no node', () => {
    const rows = adaptProxmoxTasks(sheet(TASK_HEADERS, [trow({ Node: '' })]))
    expect(rows).toHaveLength(0)
  })

  it('filters out rows with no type', () => {
    const rows = adaptProxmoxTasks(sheet(TASK_HEADERS, [trow({ Type: '' })]))
    expect(rows).toHaveLength(0)
  })
})
