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
  daily_schedule?: PromoDaySchedule[] | null
}

/** Jendela promo untuk satu tanggal kalender WIB. */
export type PromoDaySchedule = {
  date: string
  start_time: string
  end_time: string
}

export type PromoStatus = 'nonaktif' | 'terjadwal' | 'berjalan' | 'berakhir'

/** Helper untuk mem-parsing 'HH:mm:ss' ke milidetik sejak tengah malam. */
function parseTimeStr(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null
  const parts = timeStr.split(':')
  if (parts.length < 2) return null
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const s = parts.length > 2 ? parseInt(parts[2], 10) : 0
  if (isNaN(h) || isNaN(m) || isNaN(s) || h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null
  return (h * 60 * 60 + m * 60 + s) * 1000
}

const WIB_TIME_ZONE = 'Asia/Jakarta'
const DAY_MS = 24 * 60 * 60 * 1000

function wibDateTime(now: number): { date: string; time: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: WIB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(now))
  const value = (type: string) => parts.find(part => part.type === type)?.value || ''
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: (Number(value('hour')) * 60 * 60 + Number(value('minute')) * 60 + Number(value('second'))) * 1000,
  }
}

function previousDate(date: string): string {
  const parsed = Date.parse(`${date}T00:00:00Z`)
  return isNaN(parsed) ? '' : new Date(parsed - DAY_MS).toISOString().slice(0, 10)
}

function isSpecificScheduleRunning(schedule: PromoDaySchedule[], now: number): boolean {
  const local = wibDateTime(now)
  const currentRows = schedule.filter(row => row.date === local.date)
  const previousRows = schedule.filter(row => row.date === previousDate(local.date))

  // Pada tanggal yang sama, jendela normal berlaku di antara start dan end.
  // Jendela lintas tengah malam hanya dimulai dari jam start pada tanggalnya.
  const startsToday = currentRows.some(row => {
    const start = parseTimeStr(row.start_time)
    const end = parseTimeStr(row.end_time)
    if (start === null || end === null || start === end) return false
    return start < end
      ? local.time >= start && local.time < end
      : local.time >= start
  })

  // Jika jendela kemarin melewati tengah malam, sisa jendelanya berlaku
  // sampai jam selesai di awal hari ini.
  const carriesFromYesterday = previousRows.some(row => {
    const start = parseTimeStr(row.start_time)
    const end = parseTimeStr(row.end_time)
    return start !== null && end !== null && start > end && local.time < end
  })

  return startsToday || carriesFromYesterday
}

/**
 * Memeriksa jendela jadwal tanpa memeriksa is_active atau kuota.
 * Jadwal per tanggal mengalahkan daily_start_time/daily_end_time lama.
 */
export function isPromoScheduleRunning(promo: PromoScheduleInput, now: number = Date.now()): boolean {
  if (promo.start_date) {
    const start = new Date(promo.start_date).getTime()
    if (isNaN(start) || start > now) return false
  }
  if (promo.end_date) {
    const end = new Date(promo.end_date).getTime()
    if (isNaN(end) || end <= now) return false
  }

  const specificSchedule = Array.isArray(promo.daily_schedule) ? promo.daily_schedule : []
  if (specificSchedule.length > 0) {
    return isSpecificScheduleRunning(specificSchedule, now)
  }

  const dailyStart = parseTimeStr(promo.daily_start_time)
  const dailyEnd = parseTimeStr(promo.daily_end_time)
  if (dailyStart === null || dailyEnd === null) return true
  if (dailyStart === dailyEnd) return false

  const local = wibDateTime(now)
  return dailyStart < dailyEnd
    ? local.time >= dailyStart && local.time < dailyEnd
    : local.time >= dailyStart || local.time < dailyEnd
}

export function getPromoStatus(promo: PromoScheduleInput, now: number = Date.now()): PromoStatus {
  if (!promo.is_active) return 'nonaktif'

  const start = promo.start_date ? new Date(promo.start_date).getTime() : null
  const end = promo.end_date ? new Date(promo.end_date).getTime() : null

  if (end !== null && !isNaN(end) && end <= now) return 'berakhir'
  if (start !== null && !isNaN(start) && start > now) return 'terjadwal'

  if (!isPromoScheduleRunning(promo, now)) return 'terjadwal'

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

  if (promo.daily_schedule !== undefined && promo.daily_schedule !== null) {
    if (!Array.isArray(promo.daily_schedule)) return 'Jadwal per tanggal tidak valid.'

    const dates = new Set<string>()
    for (const [index, row] of promo.daily_schedule.entries()) {
      if (!row || typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
          isNaN(Date.parse(`${row.date}T00:00:00Z`))) {
        return `Jadwal per tanggal baris ${index + 1}: tanggal tidak valid.`
      }
      if (dates.has(row.date)) return `Jadwal per tanggal: ${row.date} ditulis lebih dari sekali.`
      dates.add(row.date)

      const dailyStart = parseTimeStr(row.start_time)
      const dailyEnd = parseTimeStr(row.end_time)
      if (dailyStart === null || dailyEnd === null || dailyStart === dailyEnd) {
        return `Jadwal per tanggal ${row.date}: jam mulai dan selesai harus valid serta tidak boleh sama.`
      }
    }
  }
  return null
}

export const STATUS_LABEL: Record<PromoStatus, string> = {
  nonaktif: 'Nonaktif',
  terjadwal: 'Terjadwal',
  berjalan: 'Sedang berjalan',
  berakhir: 'Sudah berakhir',
}
