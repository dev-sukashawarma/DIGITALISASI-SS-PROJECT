export function rupiah(n: number): string {
  const sign = n < 0 ? '-' : ''
  return sign + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID')
}

export function rupiahCompact(n: number): string {
  const absN = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (absN >= 1_000_000) {
    const val = absN / 1_000_000
    const f = val % 1 === 0 ? val.toString() : val.toFixed(1).replace('.', ',')
    return `${sign}Rp ${f} Jt`
  }
  if (absN >= 1_000) {
    const val = absN / 1_000
    const f = val % 1 === 0 ? val.toString() : val.toFixed(1).replace('.', ',')
    return `${sign}Rp ${f} Rb`
  }
  return `${sign}Rp ${Math.round(absN)}`
}

export function tanggal(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
