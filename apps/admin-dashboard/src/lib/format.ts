export function rupiah(n: number): string {
  return 'Rp\u00A0' + Math.round(n).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
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

export function formatStok(
  stokBase: number,
  satuanBesar: string,
  satuanTengah?: string | null,
  faktorTengah?: number | null,
  // satuanKecil dan faktorKecil di-ignore sesuai permintaan
  _satuanKecil?: string | null,
  _faktorKecil?: number | null
): string {
  // Jika tidak ada satuan tengah atau faktor tengah tidak valid, kembalikan format desimal
  if (!satuanTengah || !faktorTengah || faktorTengah <= 0) {
    const formatted = Number.isInteger(stokBase) ? stokBase : (Math.round(stokBase * 100) / 100)
    return `${formatted} ${satuanBesar}`
  }

  const besar = Math.floor(stokBase)
  let sisaDesimal = stokBase - besar

  // Hitung jumlah di satuan tengah
  let qtyTengahDecimal = sisaDesimal * faktorTengah
  let tengah = Math.floor(qtyTengahDecimal + 0.0001) // hindari floating point error
  let sisaTengahDecimal = qtyTengahDecimal - tengah

  // Format bersih tanpa memaksakan angka 0 yang numpuk
  let formattedTengah = ''
  if (sisaTengahDecimal > 0.01) {
    formattedTengah = `${qtyTengahDecimal.toFixed(1)} ${satuanTengah}`
  } else if (tengah > 0) {
    formattedTengah = `${tengah} ${satuanTengah}`
  }

  if (besar > 0 && formattedTengah) {
    return `${besar} ${satuanBesar} ${formattedTengah}`
  }
  if (besar > 0) {
    return `${besar} ${satuanBesar}`
  }
  if (formattedTengah) {
    return formattedTengah
  }
  return `0 ${satuanBesar}`
}
