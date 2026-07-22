import { describe, it, expect } from 'vitest'

function breakdownSaldoToUnits(
  qty: number,
  b?: {
    satuan: string
    satuan_tengah?: string | null
    faktor_tengah?: number | null
    satuan_kecil?: string | null
    faktor_tampilan?: number | null
  }
) {
  if (!b) return { besar: 0, tengah: 0, kecil: 0 }

  const isNegative = qty < 0
  const absQty = Math.abs(qty)

  const hasTengah = Boolean(b.satuan_tengah && b.faktor_tengah && b.faktor_tengah > 0)
  const hasKecil = Boolean(b.satuan_kecil && b.faktor_tampilan && b.faktor_tampilan > 0)

  if (hasTengah && hasKecil) {
    const fTengah = b.faktor_tengah!
    const fKecil = b.faktor_tampilan!
    const fKecilPerTengah = fKecil / fTengah

    let besar = Math.trunc(absQty)
    let sisaTengahRaw = Math.round((absQty - besar) * fTengah * 1e6) / 1e6
    let tengah = Math.trunc(sisaTengahRaw)
    let sisaKecilRaw = Math.round((sisaTengahRaw - tengah) * fKecilPerTengah * 1e6) / 1e6
    let kecil = Math.round(sisaKecilRaw * 100) / 100

    if (Math.abs(kecil) >= fKecilPerTengah) {
      tengah += Math.sign(kecil || 1) * Math.floor(Math.abs(kecil) / fKecilPerTengah)
      kecil = Math.round((kecil % fKecilPerTengah) * 100) / 100
    }
    if (Math.abs(tengah) >= fTengah) {
      besar += Math.sign(tengah || 1) * Math.floor(Math.abs(tengah) / fTengah)
      tengah = tengah % fTengah
    }

    return {
      besar: isNegative ? -besar : besar,
      tengah: isNegative ? -tengah : tengah,
      kecil: isNegative ? -kecil : kecil,
    }
  }

  if (hasTengah) {
    const fTengah = b.faktor_tengah!
    let besar = Math.trunc(absQty)
    let tengah = Math.round((absQty - besar) * fTengah * 100) / 100

    if (Math.abs(tengah) >= fTengah) {
      besar += Math.sign(tengah || 1) * Math.floor(Math.abs(tengah) / fTengah)
      tengah = Math.round((tengah % fTengah) * 100) / 100
    }

    return {
      besar: isNegative ? -besar : besar,
      tengah: isNegative ? -tengah : tengah,
      kecil: 0,
    }
  }

  if (hasKecil) {
    const fKecil = b.faktor_tampilan!
    let besar = Math.trunc(absQty)
    let kecil = Math.round((absQty - besar) * fKecil * 100) / 100

    if (Math.abs(kecil) >= fKecil) {
      besar += Math.sign(kecil || 1) * Math.floor(Math.abs(kecil) / fKecil)
      kecil = Math.round((kecil % fKecil) * 100) / 100
    }

    return {
      besar: isNegative ? -besar : besar,
      tengah: 0,
      kecil: isNegative ? -kecil : kecil,
    }
  }

  return {
    besar: qty,
    tengah: 0,
    kecil: 0,
  }
}

function computeTargetSaldo(
  adjBesar: string,
  adjTengah: string,
  adjKecil: string,
  b?: {
    satuan: string
    satuan_tengah?: string | null
    faktor_tengah?: number | null
    satuan_kecil?: string | null
    faktor_tampilan?: number | null
  }
): number {
  if (!b) return 0
  const vBesar = Number(adjBesar) || 0
  const vTengah = Number(adjTengah) || 0
  const vKecil = Number(adjKecil) || 0

  const hasTengah = Boolean(b.satuan_tengah && b.faktor_tengah && b.faktor_tengah > 0)
  const hasKecil = Boolean(b.satuan_kecil && b.faktor_tampilan && b.faktor_tampilan > 0)

  let total = vBesar
  if (hasTengah) {
    total += vTengah / b.faktor_tengah!
  }
  if (hasKecil) {
    total += vKecil / b.faktor_tampilan!
  }

  return Math.round(total * 1e6) / 1e6
}

describe('ManualEntryForm Multi-Unit Adjustment logic', () => {
  it('correctly breaks down 3-level units (Kompan -> Liter -> ml)', () => {
    const minyaksayur = {
      satuan: 'kompan',
      satuan_tengah: 'liter',
      faktor_tengah: 18,
      satuan_kecil: 'ml',
      faktor_tampilan: 18000,
    }

    const res = breakdownSaldoToUnits(2.5, minyaksayur)
    expect(res).toEqual({ besar: 2, tengah: 9, kecil: 0 })

    const target = computeTargetSaldo('2', '9', '0', minyaksayur)
    expect(target).toBe(2.5)
  })

  it('correctly breaks down 2-level units (kg -> gram)', () => {
    const ayam = {
      satuan: 'kg',
      satuan_kecil: 'gram',
      faktor_tampilan: 1000,
    }

    const res = breakdownSaldoToUnits(5.25, ayam)
    expect(res).toEqual({ besar: 5, tengah: 0, kecil: 250 })

    const target = computeTargetSaldo('4', '0', '500', ayam)
    expect(target).toBe(4.5)
  })

  it('computes delta correctly when user edits unit inputs', () => {
    const minyaksayur = {
      satuan: 'kompan',
      satuan_tengah: 'liter',
      faktor_tengah: 18,
      satuan_kecil: 'ml',
      faktor_tampilan: 18000,
    }

    const existing = 2.5 // 2 kompan + 9 liter
    const target = computeTargetSaldo('3', '0', '0', minyaksayur) // user edited to 3 kompan
    const delta = Math.round((target - existing) * 1e6) / 1e6

    expect(target).toBe(3)
    expect(delta).toBe(0.5)
  })
})
