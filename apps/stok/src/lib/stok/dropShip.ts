// Fungsi murni drop-ship vendor -> outlet. Spec: docs/superpowers/specs/2026-09-11-drop-ship-sayur-design.md

type FaktorBahan = { faktor_tengah: number | null; faktor_tampilan: number | null }

// Konversi input crew ke SATUAN BESAR (kontrak kolom qty). Pola WasteModal, tapi
// MELEMPAR bila tingkat yang dipilih tak punya faktor -- jangan diam-diam
// menganggap 1 (FOIL pernah salah 48x karena fallback semacam itu).
export function keSatuanBesar(qty: number, tingkat: 'besar' | 'tengah' | 'kecil', b: FaktorBahan): number {
  if (tingkat === 'besar') return qty
  const faktor = tingkat === 'kecil' ? b.faktor_tampilan : b.faktor_tengah
  if (!faktor || faktor <= 0) throw new Error(`Bahan ini tidak punya satuan ${tingkat}`)
  return qty / faktor
}

export const AMBANG_RUPIAH_KONFIRMASI = 2_000_000
export const KELIPATAN_RATA_KONFIRMASI = 5

// Konfirmasi di form, bukan penolakan. Penolakan mutlak (> Rp 10 jt) ada di RPC.
export function perluKonfirmasiJumlah(a: { qtyBesar: number; hargaSnapshot: number; rataPakaiHarian: number | null }): boolean {
  if (!(a.qtyBesar > 0)) return false
  if (a.qtyBesar * a.hargaSnapshot > AMBANG_RUPIAH_KONFIRMASI) return true
  if (a.rataPakaiHarian != null && a.rataPakaiHarian > 0) return a.qtyBesar > KELIPATAN_RATA_KONFIRMASI * a.rataPakaiHarian
  return false
}

// SAMA dengan konstanta di RPC sahkan_nota_vendor (migration 20260911122000).
export const BATAS_SELISIH_PERSEN = 0.5

export function hitungSelisihNota(totalCrew: number, totalNota: number): { selisih: number; persen: number; perluCatatan: boolean } {
  const selisih = Math.round((totalCrew - totalNota) * 1000) / 1000
  const persen = totalNota > 0 ? Math.abs(selisih) / totalNota * 100 : (selisih === 0 ? 0 : 100)
  return { selisih, persen, perluCatatan: persen > BATAS_SELISIH_PERSEN }
}
