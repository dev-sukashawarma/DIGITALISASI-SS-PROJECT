// Scope kunci Hermes = daftar app. Sama persis dengan CHECK hermes_api_key_scope_check.
// 'hr_rinci' (gaji & kasbon per orang) hanya untuk Bot HRD — jangan diberikan ke Bot CEO.
export const DOMAIN = ['penjualan', 'stok', 'absensi', 'finance', 'mitra', 'app_retail', 'sistem', 'hr_rinci'] as const
export type Domain = (typeof DOMAIN)[number]

export const LABEL_DOMAIN: Record<Domain, string> = {
  penjualan: 'Penjualan',
  stok: 'Stok & Distribusi',
  absensi: 'Absensi',
  finance: 'Finance',
  mitra: 'Mitra',
  app_retail: 'App Retail',
  sistem: 'Sistem',
  hr_rinci: 'HR rinci (gaji & kasbon per orang)',
}

export function adalahDomain(x: string): x is Domain {
  return (DOMAIN as readonly string[]).includes(x)
}
