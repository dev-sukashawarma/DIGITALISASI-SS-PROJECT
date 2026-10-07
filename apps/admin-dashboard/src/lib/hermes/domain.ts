// Domain data yang bisa dibuka untuk kunci Hermes. Sama dengan CHECK hermes_api_key.scope.
export const DOMAIN = ['penjualan', 'gudang', 'absensi', 'finance'] as const
export type Domain = (typeof DOMAIN)[number]

export function adalahDomain(x: string): x is Domain {
  return (DOMAIN as readonly string[]).includes(x)
}
