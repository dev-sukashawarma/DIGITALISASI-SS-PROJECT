/* ── Cache per hari untuk Ringkasan Bisnis (Owner & Mitra Dashboard) ──────
 *
 * Angka hari yang sudah lewat hampir tidak pernah berubah, jadi masing-masing
 * hari cukup dihitung sekali lalu disimpan. Rentang apa pun ("7 Hari",
 * "Bulan ini", "30 hari") = gabungan potongan per hari dari cache + hari ini
 * yang selalu dihitung segar. Menggeser filter satu hari tidak lagi memaksa
 * seluruh rentang dihitung ulang dari nol.
 *
 * Kalau ada order hari lampau yang berubah (void/batal belakangan), yang
 * dibuang hanya cache tanggal order itu — lihat `ownerDashboardDayTag`.
 *
 * File ini murni (tanpa Next.js/Supabase) supaya bisa diuji.
 */

/** Rentang lampau sampai sepanjang ini dipecah per hari; lebih panjang → per 7 hari. */
export const DAILY_CHUNK_MAX_DAYS = 62
/** Ukuran potongan untuk rentang panjang (custom range berbulan-bulan). */
export const LONG_RANGE_CHUNK_DAYS = 7
/** Batas pemanggilan RPC serentak ke database saat cache masih kosong. */
export const DAY_FETCH_CONCURRENCY = 6
/** Jeda minimum antar refresh otomatis dari realtime (per tab browser). */
export const REALTIME_REFRESH_MIN_GAP_MS = 20_000

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDateStr(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function addDaysStr(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Semua tanggal YYYY-MM-DD dari `from` sampai `to` (inklusif). Kosong bila from > to. */
export function eachDateInclusive(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDaysStr(d, 1)) out.push(d)
  return out
}

/** Tanggal (YYYY-MM-DD) zona Asia/Jakarta dari sebuah instant. */
export function jakartaDate(instant: Date | string | number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(instant))
}

/** Batas awal & akhir satu rentang tanggal WIB, dalam ISO UTC. */
export function jakartaRangeIso(from: string, to: string) {
  return {
    fromIso: new Date(`${from}T00:00:00.000+07:00`).toISOString(),
    toIso: new Date(`${to}T23:59:59.999+07:00`).toISOString(),
  }
}

export type DayChunk = { from: string; to: string; dates: string[] }

/**
 * Memecah rentang lampau jadi potongan yang bisa di-cache.
 * - ≤ DAILY_CHUNK_MAX_DAYS hari → satu potongan per hari (paling sering dipakai ulang).
 * - lebih panjang → potongan 7 hari yang disejajarkan ke hari Senin, supaya
 *   rentang panjang yang berbeda tetap berbagi potongan yang sama di tengahnya,
 *   dan jumlah panggilan ke database tetap wajar (6 bulan ≈ 27 panggilan).
 */
export function planPastChunks(from: string, to: string): DayChunk[] {
  const dates = eachDateInclusive(from, to)
  if (dates.length === 0) return []
  if (dates.length <= DAILY_CHUNK_MAX_DAYS) {
    return dates.map((d) => ({ from: d, to: d, dates: [d] }))
  }

  const chunks: DayChunk[] = []
  let cur: string[] = []
  for (const d of dates) {
    // getUTCDay: 1 = Senin. Mulai potongan baru setiap Senin.
    const isMonday = new Date(`${d}T00:00:00Z`).getUTCDay() === 1
    if (cur.length > 0 && (isMonday || cur.length >= LONG_RANGE_CHUNK_DAYS)) {
      chunks.push({ from: cur[0], to: cur[cur.length - 1], dates: cur })
      cur = []
    }
    cur.push(d)
  }
  if (cur.length > 0) chunks.push({ from: cur[0], to: cur[cur.length - 1], dates: cur })
  return chunks
}

/**
 * Membagi rentang filter jadi tiga bagian relatif terhadap hari ini (WIB):
 * lampau (boleh di-cache), hari ini (selalu segar), masa depan (tidak ada data).
 */
export function splitRangeByToday(from: string, to: string, today: string) {
  const yesterday = addDaysStr(today, -1)
  const pastTo = to < today ? to : yesterday
  return {
    past: from <= pastTo ? { from, to: pastTo } : null,
    includesToday: from <= today && today <= to,
  }
}

/** Nama tag cache untuk satu tanggal. */
export function ownerDashboardDayTag(date: string): string {
  return `owner-dashboard-day:${date}`
}

/** Menjalankan `fn` untuk tiap item dengan batas paralel; urutan hasil = urutan input. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker)
  await Promise.all(workers)
  return results
}

/**
 * Throttle refresh realtime: berapa ms lagi refresh boleh dijalankan.
 * Refresh pertama langsung (0), berikutnya minimal `minGapMs` setelah refresh terakhir.
 */
export function refreshDelayMs(lastRefreshAt: number | null, now: number, minGapMs = REALTIME_REFRESH_MIN_GAP_MS): number {
  if (lastRefreshAt === null) return 0
  return Math.max(0, lastRefreshAt + minGapMs - now)
}

/**
 * Dari satu event realtime `orders`, tentukan tanggal (WIB) order tersebut —
 * baik versi baru maupun lama (order bisa dipindah tanggal, walau jarang).
 */
export function orderDatesFromRealtime(payload: { new?: any; old?: any } | null | undefined): string[] {
  const out = new Set<string>()
  for (const row of [payload?.new, payload?.old]) {
    const ts = row?.created_at
    if (!ts) continue
    const d = new Date(ts)
    if (!Number.isNaN(d.getTime())) out.add(jakartaDate(d))
  }
  return Array.from(out)
}
