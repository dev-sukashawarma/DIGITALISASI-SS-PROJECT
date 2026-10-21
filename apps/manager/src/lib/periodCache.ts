/**
 * Kebijakan cache untuk laporan berbasis periode.
 */
import type { PeriodFilterValue } from '@/lib/types'

export function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

export function yesterdayJakarta(): string {
  const today = todayJakarta()
  const d = new Date(`${today}T00:00:00+07:00`)
  d.setDate(d.getDate() - 1)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d)
}

/**
 * Periode tertutup = tanggal akhirnya sebelum kemarin menurut kalender Jakarta.
 * Tanggal "kemarin" dan "hari ini" BELUM tertutup mutlak karena sinkronisasi POS offline
 * dan closing kasir sering baru tersinkronisasi pada hari berikutnya.
 */
export function isClosedPeriod(filter: Pick<PeriodFilterValue, 'to'>): boolean {
  return Boolean(filter.to) && filter.to < yesterdayJakarta()
}

const OPEN_STALE = 2 * 60_000
const CLOSED_GC = 24 * 60 * 60_000

export function periodCacheOptions(filter: Pick<PeriodFilterValue, 'to'>) {
  return isClosedPeriod(filter)
    ? { staleTime: Infinity, gcTime: CLOSED_GC }
    : { staleTime: OPEN_STALE, gcTime: 5 * 60_000 }
}

const VERSION = 'v14'
const PREFIX = `rq-period:${VERSION}:`
const MAX_BYTES = 1_500_000 // jauh di bawah kuota localStorage ~5 MB

function storageKey(key: readonly unknown[]): string {
  return PREFIX + JSON.stringify(key)
}

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
      if (k && (k.startsWith('rq-period:') || k.includes('sales-daily') || k.includes('hpp-client-calculated') || k.includes('waste'))) {
        doomed.push(k)
      }
    }
    doomed.forEach((k) => window.localStorage.removeItem(k))
  } catch {
    /* storage diblokir — tak ada yang perlu dibersihkan */
  }
}
