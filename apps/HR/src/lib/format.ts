export function rupiah(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return 'Rp 0'
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

export const formatRupiah = rupiah

export function rupiahCompact(n: number): string {
  const absN = Math.abs(n)
  if (absN >= 1_000_000) {
    const val = n / 1_000_000
    const formatted = val % 1 === 0 ? val.toString() : val.toFixed(1).replace('.', ',')
    return `Rp ${formatted} Jt`
  }
  if (absN >= 1_000) {
    const val = n / 1_000
    const formatted = val % 1 === 0 ? val.toString() : val.toFixed(1).replace('.', ',')
    return `Rp ${formatted} Rb`
  }
  return `Rp ${Math.round(n)}`
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '-'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '-'
  const date = typeof d === 'string' ? new Date(d) : d
  return (
    date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + ' WIB'
  )
}

export function formatJamWib(isoStr: string | null | undefined): string {
  if (!isoStr) return '-'
  try {
    const d = new Date(isoStr)
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB'
  } catch {
    return isoStr.slice(0, 5)
  }
}

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export function formatBulanIndonesia(monthNumber: number): string {
  if (monthNumber < 1 || monthNumber > 12) return ''
  return MONTH_NAMES[monthNumber - 1]
}
