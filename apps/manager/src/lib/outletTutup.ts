/**
 * Aturan tampil outlet yang sudah tutup di pemilih/pencarian outlet
 * (keputusan owner 2026-11-17).
 *
 * Outlet tutup tetap muncul sampai AKHIR BULAN tanggal tutupnya, karena
 * beres-beres sesudah tutup (setoran, bongkar, OPEX bulan itu) hampir selalu
 * masih di bulan yang sama. Patokannya awal periode yang sedang dipilih:
 * tampil bila awal periode <= akhir bulan tanggal tutup (WIB).
 *
 * Hanya untuk tampilan pemilih. Jangan dipakai untuk menyaring data
 * perhitungan: total "Semua Outlet" tetap memuat outlet tutup.
 *
 * Berkas ini IDENTIK di apps/admin-dashboard, apps/finance, apps/manager.
 */

export interface StatusTutupOutlet {
  is_active?: boolean | null
  status?: string | null
  nonaktif_at?: string | null
}

const WIB_MS = 7 * 60 * 60 * 1000

/** Outlet tutup = nonaktif. Outlet Persiapan (status 'pending') bukan outlet tutup. */
export function outletSudahTutup(o: StatusTutupOutlet): boolean {
  if (o.status === 'pending') return false
  return o.is_active === false || o.status === 'inactive'
}

/** Tanggal terakhir (YYYY-MM-DD, WIB) outlet tutup masih ditampilkan. */
export function batasTampilOutletTutup(nonaktifAt: string): string {
  const wib = new Date(new Date(nonaktifAt).getTime() + WIB_MS)
  const akhirBulan = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() + 1, 0))
  return akhirBulan.toISOString().slice(0, 10)
}

/**
 * Apakah outlet ditampilkan untuk periode yang dimulai `periodeMulai`
 * (YYYY-MM-DD). Tanpa periode, semua tampil. Outlet tutup tanpa tanggal
 * tutup tetap tampil (tak bisa dipastikan).
 */
export function outletTampilDiPeriode(o: StatusTutupOutlet, periodeMulai?: string | null): boolean {
  if (!periodeMulai) return true
  if (!outletSudahTutup(o)) return true
  if (!o.nonaktif_at) return true
  return periodeMulai <= batasTampilOutletTutup(o.nonaktif_at)
}

const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/**
 * Keterangan untuk outlet tutup yang masih tampil di pemilih, mis. "Tutup 8 Nov".
 * Null untuk outlet aktif atau yang tanggal tutupnya tidak tercatat.
 */
export function keteranganTutup(o: StatusTutupOutlet): string | null {
  if (!outletSudahTutup(o) || !o.nonaktif_at) return null
  const wib = new Date(new Date(o.nonaktif_at).getTime() + WIB_MS)
  return `Tutup ${wib.getUTCDate()} ${BULAN_PENDEK[wib.getUTCMonth()]}`
}

/** Nama outlet + keterangan tutup bila ada, mis. "SAWANGAN · Tutup 8 Nov". */
export function namaDenganKeteranganTutup(nama: string, o: StatusTutupOutlet): string {
  const k = keteranganTutup(o)
  return k ? `${nama} · ${k}` : nama
}

export function saringOutletPeriode<T extends StatusTutupOutlet>(outlets: T[], periodeMulai?: string | null): T[] {
  if (!periodeMulai) return outlets
  return outlets.filter((o) => outletTampilDiPeriode(o, periodeMulai))
}
