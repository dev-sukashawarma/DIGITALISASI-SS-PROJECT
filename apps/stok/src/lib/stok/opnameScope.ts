/**
 * Barang yang BUKAN bagian opname bahan baku harian (keputusan owner):
 * aset hardware & atribut perlengkapan (PRINTER THERMAL, ID CARD).
 *
 * Satu sumber aturan untuk form, halaman detail, DAN server action
 * `upsertOpnameItems` -- 21 Sep 2026 build lama yang tak punya filter form
 * sempat menyimpan PRINTER THERMAL di 6 outlet, jadi penyaring di form saja
 * tidak cukup.
 */
const KATEGORI_NON_OPNAME = ['ASET', 'PERLENGKAPAN']
const NAMA_NON_OPNAME = ['PRINTER THERMAL', 'ID CARD']

export function isBahanOpname(b: { nama?: string | null; kategori?: string | null }): boolean {
  const kat = b.kategori?.trim().toUpperCase() ?? ''
  const nama = b.nama?.trim().toUpperCase() ?? ''
  if (KATEGORI_NON_OPNAME.includes(kat)) return false
  if (NAMA_NON_OPNAME.includes(nama)) return false
  return true
}
