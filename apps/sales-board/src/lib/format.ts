const intFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

const rupiahFmt = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatInt(n: number): string {
  return intFmt.format(Math.round(n))
}

export function formatRupiah(n: number): string {
  return rupiahFmt.format(Math.round(n))
}
