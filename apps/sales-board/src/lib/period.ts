/** Lantai data papan: sebelum tanggal ini penjualan masih lewat Pawoon. */
export const DATA_FLOOR = '2026-08-01'

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** Menggeser instant ke WIB lalu membacanya sebagai komponen UTC. */
function toWib(d: Date): Date {
  return new Date(d.getTime() + WIB_OFFSET_MS)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function isoOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Tanggal (YYYY-MM-DD) dan jam (0-23) menurut WIB. */
export function wibDateHour(now: Date): { date: string; hour: number } {
  const w = toWib(now)
  return { date: isoOf(w), hour: w.getUTCHours() }
}

/** Mengambil tanggal kemarin (H-1) dalam format YYYY-MM-DD. */
export function prevWibDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1, d - 1))
  return isoOf(target)
}

/** Format tanggal ramah manusia dalam bahasa Indonesia, misal "Jumat, 4 September 2026". */
export function formatWibDateHuman(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const hari = HARI[dt.getUTCDay()]
  const bulan = BULAN[dt.getUTCMonth()]
  return `${hari}, ${d} ${bulan} ${y}`
}

/**
 * Semua kemunculan kalender hari-yang-sama di bulan SEBELUM dateISO,
 * membuang yang jatuh di bawah lantai data.
 *
 * Ini adalah pembagi rata-rata baseline: hari outlet tutup TETAP dihitung,
 * karena itu bagian nyata dari kebiasaan bulan lalu.
 */
export function sameWeekdayOccurrences(
  dateISO: string,
  floorISO: string = DATA_FLOOR,
): string[] {
  const [y, m, d] = dateISO.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1, d))
  const dow = target.getUTCDay()

  // Bulan sebelumnya: dari tanggal 1 sampai hari terakhir.
  const prevStart = new Date(Date.UTC(y, m - 2, 1))
  const prevEnd = new Date(Date.UTC(y, m - 1, 0)) // hari 0 = hari terakhir bulan lalu

  const out: string[] = []
  for (
    let cur = new Date(prevStart);
    cur.getTime() <= prevEnd.getTime();
    cur.setUTCDate(cur.getUTCDate() + 1)
  ) {
    if (cur.getUTCDay() !== dow) continue
    const iso = isoOf(cur)
    if (iso < floorISO) continue
    out.push(iso)
  }
  return out
}

/** Label pembanding untuk UI, mis. "rata-rata Kamis Agustus". */
export function baseLabel(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1, d))
  const prevMonth = new Date(Date.UTC(y, m - 2, 1))
  return `rata-rata ${HARI[target.getUTCDay()]} ${BULAN[prevMonth.getUTCMonth()]}`
}
