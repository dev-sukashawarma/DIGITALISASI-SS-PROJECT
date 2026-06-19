export function rupiah(n: number): string {
  return 'Rp\u00A0' + Math.round(n).toLocaleString('id-ID')
}
export function rupiahCompact(n: number): string {
  const absN = Math.abs(n)
  if (absN >= 1_000_000) {
    const val = n / 1_000_000
    const formatted = val % 1 === 0 ? val.toString() : val.toFixed(1).replace('.', ',')
    return `Rp\u00A0${formatted}\u00A0Jt`
  }
  if (absN >= 1_000) {
    const val = n / 1_000
    const formatted = val % 1 === 0 ? val.toString() : val.toFixed(1).replace('.', ',')
    return `Rp\u00A0${formatted}\u00A0Rb`
  }
  return `Rp\u00A0${Math.round(n)}`
}
export function aov(omzet: number, orders: number): number {
  return orders > 0 ? Math.round(omzet / orders) : 0
}
export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0
}
export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}
export function normalizeMenuName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

