/**
 * Kebijakan cache untuk laporan berbasis periode.
 *
 * Periode yang seluruhnya sudah lewat bersifat *immutable*: order, pengeluaran,
 * dan waste bulan lalu tidak akan berubah lagi. Sebelumnya semua query laporan
 * memakai `staleTime` 2 menit tanpa memandang periodenya, jadi preset "Bulan
 * Lalu" — yang jawabannya sudah pasti — tetap ditarik ulang dari nol tiap dua
 * menit, tiap ganti halaman, dan tiap refresh.
 *
 * Untuk periode tertutup kita tahan di memori selamanya (selama tab hidup) dan
 * simpan ke localStorage supaya refresh tidak membayar ulang. Periode yang
 * masih berjalan (mencakup hari ini atau tanggal depan) tetap 2 menit seperti
 * semula.
 */
import type { PeriodFilterValue } from '@/lib/types'

export function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

/** Periode tertutup = tanggal akhirnya sudah lewat menurut kalender Jakarta. */
export function isClosedPeriod(filter: Pick<PeriodFilterValue, 'to'>): boolean {
  return Boolean(filter.to) && filter.to < todayJakarta()
}

const OPEN_STALE = 2 * 60_000
const CLOSED_GC = 24 * 60 * 60_000

export function periodCacheOptions(filter: Pick<PeriodFilterValue, 'to'>) {
  return isClosedPeriod(filter)
    ? { staleTime: Infinity, gcTime: CLOSED_GC }
    : { staleTime: OPEN_STALE, gcTime: 5 * 60_000 }
}

// ── Persistensi lintas-refresh ────────────────────────────────────────────
// Sengaja tidak memakai @tanstack/react-query-persist-client: menambah paket
// ke root monorepo ini menyeret drift `yarn.lock` dari workspace lain (lihat
// CLAUDE.md), dan yang kita butuhkan cuma read-through cache untuk periode
// tertutup. Naikkan VERSION bila bentuk data yang disimpan berubah, agar entri
// lama tidak dibaca dengan skema baru.
const VERSION = 'v1'
const PREFIX = `rq-period:${VERSION}:`
const MAX_BYTES = 1_500_000 // jauh di bawah kuota localStorage ~5 MB

function storageKey(key: readonly unknown[]): string {
  return PREFIX + JSON.stringify(key)
}

/**
 * Bungkus `queryFn` dengan cache localStorage yang hanya aktif untuk periode
 * tertutup. Semua akses localStorage dibungkus try/catch: mode privat, kuota
 * penuh, dan browser yang memblokir site-data melempar di sini, dan laporan
 * harus tetap tampil (sekadar tanpa cache) kalau itu terjadi.
 */
export function withPeriodCache<T>(
  key: readonly unknown[],
  filter: Pick<PeriodFilterValue, 'to'>,
  queryFn: () => Promise<T>,
): () => Promise<T> {
  return async () => {
    if (typeof window === 'undefined' || !isClosedPeriod(filter)) return queryFn()

    const sk = storageKey(key)
    try {
      const hit = window.localStorage.getItem(sk)
      if (hit) return JSON.parse(hit) as T
    } catch {
      /* cache tak terbaca — lanjut ambil dari jaringan */
    }

    const fresh = await queryFn()
    try {
      const payload = JSON.stringify(fresh)
      if (payload.length <= MAX_BYTES) window.localStorage.setItem(sk, payload)
    } catch {
      /* kuota penuh atau storage diblokir — abaikan, data tetap dipakai */
    }
    return fresh
  }
}

/** Buang seluruh entri cache periode (dipakai tombol refresh manual). */
export function clearPeriodCache(): void {
  if (typeof window === 'undefined') return
  try {
    const doomed: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k?.startsWith(PREFIX)) doomed.push(k)
    }
    doomed.forEach((k) => window.localStorage.removeItem(k))
  } catch {
    /* storage diblokir — tak ada yang perlu dibersihkan */
  }
}
