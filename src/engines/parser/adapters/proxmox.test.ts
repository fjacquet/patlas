import type { ParsedSheet } from '../parseXlsx'
import { extractClusterName } from './proxmox'

const sheet = (headers: string[], rows: Record<string, unknown>[]): ParsedSheet => ({
  name: 'Cluster',
  headers,
  rows,
})

it('extracts the cluster name from row 0', () => {
  expect(extractClusterName(sheet(['Id', 'Name', 'Type'], [{ Name: 'pve-prod' }]))).toBe('pve-prod')
})

it('returns empty string when absent', () => {
  expect(extractClusterName(undefined)).toBe('')
  expect(extractClusterName(sheet(['Id'], [{}]))).toBe('')
})
