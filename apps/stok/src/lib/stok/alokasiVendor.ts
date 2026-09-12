// Alokasi vendor per bahan saat menyiapkan surat jalan.
// Spec: docs/superpowers/specs/2026-09-11-saldo-vendor-gudang-design.md §4.3-4.4.
// SALINAN IDENTIK di apps/distribusi/src/lib/alokasiVendor.ts — ubah keduanya.
// Penjaga sebenarnya ada di DB (sj_vendor_on_dikirim); ini hanya untuk UI.
export type SaldoVendor = { vendor_id: string; vendor_nama: string; sisa: number; aktif: boolean }
export type Alokasi = { vendor_id: string; qty: number }

const EPS = 1e-6

export function alokasiAwal(qty: number, vendors: SaldoVendor[]): Alokasi[] {
  if (vendors.length === 1) return [{ vendor_id: vendors[0].vendor_id, qty }]
  const cukup = vendors
    .filter((v) => v.aktif && v.sisa + EPS >= qty)
    .sort((a, b) => b.sisa - a.sisa)
  return cukup.length ? [{ vendor_id: cukup[0].vendor_id, qty }] : []
}

export function validasiAlokasi(qty: number, alokasi: Alokasi[], vendors: SaldoVendor[]): string | null {
  if (vendors.length <= 1) return null
  if (alokasi.length === 0) return 'Pilih vendor dulu'
  const dipakai = new Set<string>()
  let total = 0
  for (const a of alokasi) {
    const v = vendors.find((x) => x.vendor_id === a.vendor_id)
    if (!v) return 'Vendor tidak dikenal'
    if (dipakai.has(a.vendor_id)) return `${v.vendor_nama} dipilih dua kali`
    dipakai.add(a.vendor_id)
    if (!(a.qty > 0)) return `Jumlah ${v.vendor_nama} harus lebih dari 0`
    if (v.aktif && a.qty > v.sisa + EPS) return `Sisa ${v.vendor_nama} tinggal ${v.sisa}`
    total += a.qty
  }
  if (Math.abs(total - qty) > EPS) return `Jumlah per vendor (${total}) belum sama dengan ${qty}`
  return null
}
