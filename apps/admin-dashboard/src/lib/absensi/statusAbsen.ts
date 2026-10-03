/**
 * Cermin aturan status absensi untuk PRATINJAU di modal Edit Rekap Absensi.
 *
 * Sumber kebenaran ada di database: `hitung_status_absen` (migration
 * 20261003110000), yang identik dengan `submit_attendance`. RPC `koreksi_absensi`
 * selalu menghitung ulang sendiri — fungsi ini hanya supaya admin melihat label
 * yang akan tersimpan sebelum menekan Simpan. Ubah keduanya bersamaan.
 */

export type StatusMasuk = 'tepat' | 'telat_toleransi' | 'telat'
export type StatusPulang = 'tepat' | 'lebih_awal' | 'pulang_telat'

export interface AturanJam {
  /** HH:MM — jam shift tercatat di baris absen, atau jam config outlet. */
  jamMasuk: string
  jamKeluar: string
  toleransiMenit: number
}

const keMenit = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Menit acuan, dengan penyesuaian shift yang lewat tengah malam (sama dengan SQL). */
function acuan(jam: string, aturan: AturanJam) {
  const masuk = keMenit(aturan.jamMasuk)
  let keluar = keMenit(aturan.jamKeluar)
  let j = keMenit(jam)
  if (keluar < masuk) {
    keluar += 1440
    if (j < masuk - 180) j += 1440
  }
  return { masuk, keluar, j }
}

export function hitungStatusMasuk(jam: string, aturan: AturanJam): { status: StatusMasuk; menit: number } {
  const { masuk, j } = acuan(jam, aturan)
  const selisih = j - masuk
  if (selisih <= 0) return { status: 'tepat', menit: 0 }
  if (selisih <= Math.max(0, aturan.toleransiMenit || 0)) return { status: 'telat_toleransi', menit: selisih }
  return { status: 'telat', menit: selisih }
}

export function hitungStatusPulang(jam: string, aturan: AturanJam): { status: StatusPulang; menit: number } {
  const { keluar, j } = acuan(jam, aturan)
  const selisih = j - keluar
  if (selisih < 0) return { status: 'lebih_awal', menit: -selisih }
  if (selisih >= 1) return { status: 'pulang_telat', menit: selisih }
  return { status: 'tepat', menit: 0 }
}
