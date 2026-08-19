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
  daily_start_time?: string | null
  daily_end_time?: string | null
}

export type PromoStatus = 'nonaktif' | 'terjadwal' | 'berjalan' | 'berakhir'

/** Helper untuk mem-parsing 'HH:mm:ss' ke milidetik sejak tengah malam */
function parseTimeStr(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null
  const parts = timeStr.split(':')
  if (parts.length < 2) return null
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const s = parts.length > 2 ? parseInt(parts[2], 10) : 0
  if (isNaN(h) || isNaN(m)) return null
  return (h * 60 * 60 + m * 60 + s) * 1000
}

export function getPromoStatus(promo: PromoScheduleInput, now: number = Date.now()): PromoStatus {
  if (!promo.is_active) return 'nonaktif'

  const start = promo.start_date ? new Date(promo.start_date).getTime() : null
  const end = promo.end_date ? new Date(promo.end_date).getTime() : null

  if (end !== null && !isNaN(end) && end <= now) return 'berakhir'
  if (start !== null && !isNaN(start) && start > now) return 'terjadwal'

  // Periksa batas jam harian (Happy Hour)
  const dailyStart = parseTimeStr(promo.daily_start_time)
  const dailyEnd = parseTimeStr(promo.daily_end_time)

  if (dailyStart !== null && dailyEnd !== null) {
    const WIB_OFFSET = 7 * 60 * 60 * 1000;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const nowTimeInDay = (now + WIB_OFFSET) % DAY_MS;

    if (dailyStart <= dailyEnd) {
      if (nowTimeInDay < dailyStart || nowTimeInDay >= dailyEnd) {
        return 'terjadwal'
      }
    } else {
      if (nowTimeInDay < dailyStart && nowTimeInDay >= dailyEnd) {
        return 'terjadwal'
      }
    }
  }

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
