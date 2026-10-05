export function rupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`
}

const FMT_JAM = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false })

export function jamWib(d: Date): string {
  return FMT_JAM.format(d)
}

export function jamWibAngka(d: Date): number {
  return Number(jamWib(d).slice(0, 2))
}
