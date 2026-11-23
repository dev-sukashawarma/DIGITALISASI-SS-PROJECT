// Bentuk respons estimasi keranjang Permintaan Bahan (Server Action
// `estimateCartValue`, app/actions/budget.ts), dipisah ke modul murni supaya
// aturannya bisa diuji tanpa Supabase.
//
// Keputusan owner (22 Sep 2026, opsi A): harga beli bahan baku tidak boleh
// terlihat oleh role yang bukan pembaca harga (`canViewVendorPrices`, mis. crew
// & leader). Dulu action ini mengembalikan total rupiah ke semua staf aktif,
// sehingga crew cukup mengirim keranjang berisi 1 bahan qty 1 untuk membaca
// harga master bahan itu. Kini:
//   - pembaca harga  -> mode 'rupiah' (total, total per kategori) seperti dulu;
//   - role lain      -> mode 'status': hanya status budget + persen pemakaian
//                       budget setelah keranjang (dibulatkan), plus daftar bahan
//                       yang belum punya harga (tanpa angka).
// Pemilihan bentuk dilakukan DI SERVER berdasarkan role dari sesi, bukan di UI.

import type { BudgetStatus } from './budget'

/** Mulai persen berapa status menjadi "Mendekati batas". Sama dengan ambang oranye budgetBadgeVariant. */
export const AMBANG_MENDEKATI_BATAS_PERSEN = 80

/**
 * Persen pemakaian dibulatkan ke kelipatan ini sebelum keluar dari server.
 *
 * Alasannya: plafon budget outlet berada di kisaran jutaan rupiah, sedangkan
 * satu bahan qty 1 biasanya hanya puluhan ribu. Kalau persen dikirim presisi
 * (mis. 42,35% -> 43,10%), crew bisa menambah/menghapus satu bahan lalu
 * mengalikan selisih persennya dengan plafon untuk mendapat harga bahan itu.
 * Dengan langkah 5%, satu bahan murah praktis tidak menggeser angka, dan
 * status pun diturunkan dari persen yang SUDAH dibulatkan sehingga seluruh
 * respons hanya bergantung pada angka kasar ini. (Lihat keterbatasan di
 * laporan: penebakan lewat banyak percobaan qty tetap mungkin, hanya jauh
 * lebih mahal.)
 */
export const LANGKAH_PEMBULATAN_PERSEN = 5

/**
 * Persen yang dikirim tidak pernah melebihi angka ini; di atasnya cukup status
 * "melebihi". Tanpa batas atas, crew bisa memperbesar qty satu bahan (mis.
 * 10.000) sampai pembulatan 5% kehilangan arti — tiap lompatan 5% plafon
 * dibagi qty yang besar memberi harga satuan yang sangat presisi. Dengan batas
 * 100%, nilai keranjang yang bisa "diukur" tak pernah lebih dari sisa budget.
 */
export const PERSEN_TAMPIL_MAKS = 100

export type StatusBudgetKeranjang = 'belum_diatur' | 'cukup' | 'mendekati' | 'melebihi'

export interface NilaiKeranjang {
  totalNilai: number
  itemTanpaHarga: string[]
  kategoriNilai: Record<string, number>
}

export interface EstimasiKeranjangRupiah extends NilaiKeranjang {
  mode: 'rupiah'
}

export interface EstimasiKeranjangStatus {
  mode: 'status'
  status: StatusBudgetKeranjang
  /**
   * Persen budget terpakai SETELAH keranjang ini, kelipatan 5, maksimal 100
   * (status 'melebihi' = di atasnya). null bila tak bisa dihitung.
   */
  persenSetelah: number | null
  itemTanpaHarga: string[]
}

export type HasilEstimasiKeranjang = EstimasiKeranjangRupiah | EstimasiKeranjangStatus

export function bulatkanPersenBudget(persen: number): number {
  if (!Number.isFinite(persen) || persen <= 0) return 0
  return Math.round(persen / LANGKAH_PEMBULATAN_PERSEN) * LANGKAH_PEMBULATAN_PERSEN
}

export function ringkasBudgetKeranjang(
  budget: Pick<BudgetStatus, 'hasConfig' | 'nominal' | 'terpakai'>,
  totalKeranjang: number
): { status: StatusBudgetKeranjang; persenSetelah: number | null } {
  if (!budget.hasConfig) return { status: 'belum_diatur', persenSetelah: null }
  // Plafon 0 = salah konfigurasi; sama dengan budgetBadgeVariant (merah).
  if (!(budget.nominal > 0)) return { status: 'melebihi', persenSetelah: null }

  const persen = bulatkanPersenBudget(((budget.terpakai + totalKeranjang) / budget.nominal) * 100)
  const status: StatusBudgetKeranjang =
    persen > 100 ? 'melebihi' : persen >= AMBANG_MENDEKATI_BATAS_PERSEN ? 'mendekati' : 'cukup'
  return { status, persenSetelah: Math.min(persen, PERSEN_TAMPIL_MAKS) }
}

export function susunHasilEstimasi(input: {
  bolehLihatHarga: boolean
  nilai: NilaiKeranjang
  /** Wajib diisi untuk role non-pembaca harga; null = outlet tanpa konfigurasi budget. */
  budget: Pick<BudgetStatus, 'hasConfig' | 'nominal' | 'terpakai'> | null
}): HasilEstimasiKeranjang {
  const { bolehLihatHarga, nilai, budget } = input
  if (bolehLihatHarga) {
    return {
      mode: 'rupiah',
      totalNilai: nilai.totalNilai,
      itemTanpaHarga: [...nilai.itemTanpaHarga],
      kategoriNilai: { ...nilai.kategoriNilai },
    }
  }
  // Disusun ulang dari nol (bukan spread `nilai`) supaya kunci rupiah tak
  // mungkin ikut terbawa bila NilaiKeranjang kelak ditambah field.
  const ringkas = budget
    ? ringkasBudgetKeranjang(budget, nilai.totalNilai)
    : { status: 'belum_diatur' as const, persenSetelah: null }
  return {
    mode: 'status',
    status: ringkas.status,
    persenSetelah: ringkas.persenSetelah,
    itemTanpaHarga: [...nilai.itemTanpaHarga],
  }
}

/** Total rupiah keranjang untuk UI; 0 bila respons tidak membawa rupiah (role non-pembaca harga). */
export function totalRupiahEstimasi(hasil: HasilEstimasiKeranjang | null | undefined): number {
  return hasil?.mode === 'rupiah' ? hasil.totalNilai : 0
}
