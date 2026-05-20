// Type surface for the bare-Node supply-chain gate (scripts/check-supply-chain.mjs).
// Keeps the script dependency-free while letting the Vitest spec import it typed.

export const REQUIRED_XLSX_PIN: string
export const GUARD_IMPORT: string

export interface SupplyChainInput {
  /** Parsed package.json. */
  pkg: {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  /** Contents of src/sw.ts, or null when the file does not exist. */
  swSource: string | null
}

export interface SupplyChainResult {
  ok: boolean
  errors: string[]
}

export function evaluateSupplyChain(input: SupplyChainInput): SupplyChainResult
