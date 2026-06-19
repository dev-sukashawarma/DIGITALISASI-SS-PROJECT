export function rupiah(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
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
