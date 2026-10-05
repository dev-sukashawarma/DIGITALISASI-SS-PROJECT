export function rupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`
}

export function persenPerubahan(baru: number, lama: number): number | null {
  if (!lama) return null
  return Math.round(((baru - lama) / lama) * 1000) / 10
}

export function teksPersen(p: number | null): string {
  if (p === null) return '—'
  const s = p.toLocaleString('id-ID', { maximumFractionDigits: 1 })
  return p > 0 ? `+${s}%` : `${s}%`
}

const FMT_JAM = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false })

export function jamWib(d: Date): string {
  return FMT_JAM.format(d)
}

export function jamWibAngka(d: Date): number {
  return Number(jamWib(d).slice(0, 2))
}
