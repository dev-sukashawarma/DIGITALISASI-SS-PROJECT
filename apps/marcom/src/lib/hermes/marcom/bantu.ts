// Pembantu kecil yang dipakai bersama alat-alat Marcom.

export function cocok(teks: string | null | undefined, cari?: string): boolean {
  if (!cari) return true
  return (teks || '').toLowerCase().includes(cari.toLowerCase())
}

export function batasi(limit: unknown, bawaan: number, maks = 100): number {
  const n = Number(limit)
  if (!Number.isFinite(n) || n <= 0) return bawaan
  return Math.min(Math.floor(n), maks)
}

export function kelompokkan<T>(
  daftar: T[],
  kunci: (x: T) => string,
  nilai: (x: T) => number
): { nama: string; jumlah: number; total: number }[] {
  const peta = new Map<string, { jumlah: number; total: number }>()
  for (const x of daftar) {
    const k = kunci(x) || '(kosong)'
    const v = peta.get(k) || { jumlah: 0, total: 0 }
    v.jumlah += 1
    v.total += nilai(x)
    peta.set(k, v)
  }
  return Array.from(peta.entries())
    .map(([nama, v]) => ({ nama, ...v }))
    .sort((a, b) => b.total - a.total || b.jumlah - a.jumlah)
}

export function metaDasar<T extends Record<string, unknown> = {}>(sekarang: Date, tambahan: T = {} as T) {
  return {
    sumber: 'apps/marcom (database marcom_db)',
    ...tambahan,
    dihitung_pada: sekarang.toISOString(),
  }
}
