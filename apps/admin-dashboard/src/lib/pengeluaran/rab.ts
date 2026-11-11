/**
 * Kategori OPEX "RAB": pengeluaran yang sudah ditanggung dana investasi
 * (RAB pembukaan outlet). HANYA INFORMASI: tidak pernah mengurangi OPEX,
 * laba outlet/perusahaan/mitra, ROI/BEP, maupun saldo rekening.
 *
 * Disimpan di `expenses` dengan category = 'rab' DAN type = 'rab'. Semua laporan
 * laba memfilter type = 'expense', jadi baris RAB tidak ikut terhitung.
 * Aturan yang sama ditegakkan DB (migration 20261111150000_kategori_opex_rab).
 *
 * File ini WAJIB identik di apps/admin-dashboard dan apps/finance (test paritas).
 */

export const KATEGORI_RAB = 'rab'
export const TIPE_RAB = 'rab'

/**
 * Tanggal terakhir bulan yang sudah closing. Naikkan setiap closing bulan baru,
 * bersama fungsi DB `batas_closing_opex()`.
 */
export const BATAS_CLOSING_RAB = '2026-10-31'

export function adalahKategoriRab(category: string | null | undefined): boolean {
  return category === KATEGORI_RAB
}

export function adalahBarisRab(row: { type?: string | null; category?: string | null } | null | undefined): boolean {
  return !!row && (row.type === TIPE_RAB || row.category === KATEGORI_RAB)
}

/**
 * Cek aturan simpan/ubah satu pengeluaran terhadap kategori RAB.
 * Mengembalikan pesan galat, atau null bila boleh.
 */
export function cekAturanRab(input: {
  kategoriBaru: string
  outletId: string | null
  cashLocationId?: string | null
  tanggalBaru: string
  /** Hanya untuk ubah data: tipe & tanggal yang tersimpan sekarang. */
  tipeLama?: string | null
  tanggalLama?: string | null
}): string | null {
  const rabBaru = adalahKategoriRab(input.kategoriBaru)
  const sedangUbah = input.tipeLama !== undefined
  const rabLama = sedangUbah && input.tipeLama === TIPE_RAB

  if (rabBaru) {
    if (!input.outletId || input.outletId === 'PUSAT') {
      return 'Pengeluaran RAB wajib dialokasikan ke satu outlet, bukan Head Office.'
    }
    if (input.cashLocationId) {
      return 'Pengeluaran RAB tidak memotong rekening pusat. Kosongkan pilihan "Dibayar dari".'
    }
    if (sedangUbah && !rabLama && input.tipeLama !== 'expense') {
      return 'Hanya pengeluaran biasa yang bisa diubah menjadi RAB.'
    }
  }

  if (sedangUbah && rabBaru !== rabLama) {
    const tanggal = [input.tanggalLama, input.tanggalBaru].filter(Boolean) as string[]
    const terlama = tanggal.sort()[0]
    if (terlama && terlama.slice(0, 10) <= BATAS_CLOSING_RAB) {
      return `Kategori RAB tidak bisa diubah untuk bulan yang sudah closing (s.d. ${BATAS_CLOSING_RAB}).`
    }
  }

  return null
}
