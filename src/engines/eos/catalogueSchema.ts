import { z } from 'zod'

/**
 * Runtime validator for the bundled `endoflife.date` lifecycle snapshot —
 * applied at the one EOS boundary (`catalogue.ts`), exactly like
 * `src/engines/parser/schemas.ts` validates parsed rows. This is the ONLY
 * file under `src/engines/eos/` that imports `zod`: the normalizer, ESXi
 * classifier, and bucketer stay pure and Zod-free and receive the already
 * typed `EosCatalogue` as an argument (D-01, engines-stay-pure invariant).
 *
 * Single standard-support EOL model (D-04): `eolFrom` is the only lifecycle
 * date modelled. Paid extended-support tier fields are intentionally absent
 * from the schema by construction — an OS past `eolFrom` but under paid
 * support still buckets as overdue (standard support ended).
 */

const Release = z.object({
  name: z.string(),
  label: z.string(),
  releaseDate: z.string().nullable(),
  isEol: z.boolean(),
  eolFrom: z.string().nullable(),
  isMaintained: z.boolean(),
})

const Product = z.object({
  name: z.string(),
  releases: z.array(Release),
})

export const EosCatalogueSchema = z.object({
  lastVerified: z.string(),
  products: z.record(z.string(), Product),
})

export type EosCatalogue = z.infer<typeof EosCatalogueSchema>
export type EosProduct = z.infer<typeof Product>
export type EosRelease = z.infer<typeof Release>
