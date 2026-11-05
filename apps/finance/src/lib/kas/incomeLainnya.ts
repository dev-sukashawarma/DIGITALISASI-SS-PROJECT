/** Kategori Income Lainnya — kunci & label sama dengan RPC `record_income_lainnya`. */
export const INCOME_KATEGORI = [
  { key: 'minyak_jelantah', label: 'Minyak Jelantah' },
  { key: 'kardus_bekas', label: 'Kardus Bekas' },
  { key: 'kompan_bekas', label: 'Kompan/Jerigen Bekas' },
  { key: 'equipment_bekas', label: 'Equipment Bekas' },
  { key: 'lainnya', label: 'Lainnya' },
] as const

export type IncomeKategori = (typeof INCOME_KATEGORI)[number]['key']

export function labelKategoriIncome(k: string): string {
  return INCOME_KATEGORI.find((x) => x.key === k)?.label ?? k
}

/** Validasi sisi layar; pesan identik dengan RPC. */
export function validasiIncome(i: {
  kategori: IncomeKategori
  keterangan: string
  pembeli: string
  amount: number
  adaBukti: boolean
}): string | null {
  if (i.kategori === 'lainnya' && !i.keterangan.trim()) return 'Keterangan wajib diisi untuk kategori Lainnya'
  if (!(i.amount > 0)) return 'Nominal harus lebih dari 0'
  if (!i.pembeli.trim()) return 'Nama pembeli wajib diisi'
  if (!i.adaBukti) return 'Bukti wajib dilampirkan'
  return null
}
