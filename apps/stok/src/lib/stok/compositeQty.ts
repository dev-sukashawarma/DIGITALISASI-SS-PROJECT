/**
 * Satuan basis stok (ledger_stok.qty, stok_balance.saldo, transfer, BOM) adalah
 * SATUAN BESAR. Input opname bertingkat harus dikonversi turun ke satuan besar,
 * bukan dinaikkan ke satuan terkecil.
 */

export type CompositeUnit = {
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  faktor_tampilan: number | null
  faktor_konversi: number
}

export type CompositeInput = {
  besar?: string
  tengah?: string
  kecil?: string
}

const PRECISION = 6

function round(value: number, digits = PRECISION): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

/** Jumlah satuan kecil dalam 1 satuan besar. */
export function kecilPerBesar(b: CompositeUnit): number {
  if (b.faktor_tampilan && b.faktor_tampilan > 0) return b.faktor_tampilan
  const tengah = b.satuan_tengah ? b.faktor_tengah || 1 : 1
  return tengah * (b.faktor_konversi || 1)
}

/** Jumlah satuan kecil dalam 1 satuan tengah. */
export function kecilPerTengah(b: CompositeUnit): number {
  return b.faktor_konversi || 1
}

export function toSatuanBesar(b: CompositeUnit, input: CompositeInput): number {
  const besar = Number(input.besar || 0)
  const tengah = Number(input.tengah || 0)
  const kecil = Number(input.kecil || 0)

  let total = besar
  if (b.satuan_tengah) total += tengah / (b.faktor_tengah || 1)
  if (b.satuan_kecil) total += kecil / kecilPerBesar(b)

  return round(total)
}

export function formatSatuanBesar(b: CompositeUnit, qtyBesar: number): string {
  const sign = qtyBesar < 0 ? '-' : ''
  const abs = Math.abs(qtyBesar)

  const parts: string[] = []
  const whole = Math.trunc(abs)
  if (whole > 0) parts.push(`${whole} ${b.satuan}`)

  if (b.satuan_kecil) {
    let sisaKecil = Math.round((abs - whole) * kecilPerBesar(b))

    if (b.satuan_tengah) {
      const perTengah = kecilPerTengah(b)
      const tengah = Math.trunc(sisaKecil / perTengah)
      sisaKecil -= tengah * perTengah
      if (tengah > 0) parts.push(`${tengah} ${b.satuan_tengah}`)
    }

    if (sisaKecil > 0) parts.push(`${sisaKecil} ${b.satuan_kecil}`)
  } else if (abs !== whole) {
    return `${sign}${round(abs, 2)} ${b.satuan}`
  }

  if (parts.length === 0) return `0 ${b.satuan}`
  return `${sign}${parts.join(' + ')}`
}

export function formatCompositeInput(b: CompositeUnit, input: CompositeInput): string {
  const parts: string[] = []
  if (Number(input.besar || 0) > 0) parts.push(`${Number(input.besar)} ${b.satuan}`)
  if (b.satuan_tengah && Number(input.tengah || 0) > 0) parts.push(`${Number(input.tengah)} ${b.satuan_tengah}`)
  if (b.satuan_kecil && Number(input.kecil || 0) > 0) parts.push(`${Number(input.kecil)} ${b.satuan_kecil}`)
  return parts.length > 0 ? parts.join(' + ') : `0 ${b.satuan}`
}
