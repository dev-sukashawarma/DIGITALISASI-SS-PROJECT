/**
 * Status jadwal promo — dipakai badge di dashboard dan validasi sebelum simpan.
 *
 * Semua perbandingan memakai instant (epoch ms) dari kolom timestamptz, jadi
 * hasilnya sama di zona waktu perangkat mana pun.
 */

export type PromoScheduleInput = {
  is_active?: boolean
  start_date?: string | null
  end_date?: string | null
}

export type PromoStatus = 'nonaktif' | 'terjadwal' | 'berjalan' | 'berakhir'

export function getPromoStatus(promo: PromoScheduleInput, now: number = Date.now()): PromoStatus {
  if (!promo.is_active) return 'nonaktif'

  const start = promo.start_date ? new Date(promo.start_date).getTime() : null
  const end = promo.end_date ? new Date(promo.end_date).getTime() : null

  if (end !== null && !isNaN(end) && end <= now) return 'berakhir'
  if (start !== null && !isNaN(start) && start > now) return 'terjadwal'
  return 'berjalan'
}

/** Alasan jadwal tidak valid, atau null kalau valid. */
export function validateSchedule(promo: PromoScheduleInput): string | null {
  const start = promo.start_date ? new Date(promo.start_date).getTime() : null
  const end = promo.end_date ? new Date(promo.end_date).getTime() : null

  // Periksa setiap sisi secara independen. Sebelumnya tanggal rusak lolos jika
  // sisi lainnya kosong, sehingga konsumen POS dapat menerima jadwal ambigu.
  if ((start !== null && isNaN(start)) || (end !== null && isNaN(end))) {
    return 'Format tanggal jadwal tidak valid.'
  }
  if (start !== null && end !== null && end <= start) {
    return 'Jadwal selesai harus lebih akhir dari jadwal mulai.'
  }
  return null
}

export const STATUS_LABEL: Record<PromoStatus, string> = {
  nonaktif: 'Nonaktif',
  terjadwal: 'Terjadwal',
  berjalan: 'Sedang berjalan',
  berakhir: 'Sudah berakhir',
}
