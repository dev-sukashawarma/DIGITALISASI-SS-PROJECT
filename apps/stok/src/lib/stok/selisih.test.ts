import { describe, it, expect } from 'vitest'
import {
  computeSelisih,
  getThresholdPersen,
  computeSelisihPersen,
  isSelisihFlagged,
  getMaterialType,
  nilaiToleransiSelisih,
  getAturanSusutPos,
  hitungBatasLossPos,
  hitungSusutAktualPersen,
} from './selisih'

describe('selisih logic & threshold helpers', () => {
  describe('computeSelisih', () => {
    it('calculates physical minus system stock correctly', () => {
      expect(computeSelisih(100, 80)).toBe(20)
      expect(computeSelisih(80, 100)).toBe(-20)
      expect(computeSelisih(50, 50)).toBe(0)
    })

    it('handles null physical count by treating it as 0', () => {
      expect(computeSelisih(null, 50)).toBe(-50)
    })
  })

  describe('getAturanSusutPos', () => {
    it('mengenali AYAM, SAPI (50%), KENTANG (20%), dan semua varian SAOS* (15%)', () => {
      expect(getAturanSusutPos('AYAM')).toMatchObject({ susutPersen: 50, faktorMaksPos: 2, rasioLossMaksPos: 1 })
      expect(getAturanSusutPos('ayam fillet')).toMatchObject({ susutPersen: 50, faktorMaksPos: 2, rasioLossMaksPos: 1 })
      expect(getAturanSusutPos('SAPI')).toMatchObject({ susutPersen: 50, faktorMaksPos: 2, rasioLossMaksPos: 1 })
      expect(getAturanSusutPos('KENTANG')).toMatchObject({ susutPersen: 20, faktorMaksPos: 1.25, rasioLossMaksPos: 0.25 })

      for (const namaSaos of ['SAOS', 'SAOS CABE', 'SAOS CABE POUCH', 'SAOS TOMAT KOMPAN', 'SAOS TOMAT POUCH', 'SAOS SAMYANG', 'saus cabe']) {
        const aturan = getAturanSusutPos(namaSaos)
        expect(aturan?.susutPersen).toBe(15)
        expect(aturan?.faktorMaksPos).toBeCloseTo(1 / 0.85, 6)
        expect(aturan?.rasioLossMaksPos).toBeCloseTo(0.15 / 0.85, 6)
      }
    })

    it('mengembalikan null untuk bahan non-susut (MAYONAISE, MINYAK, SAYUR, KULIT, KEJU)', () => {
      for (const nama of ['MAYONAISE', 'MAYONES', 'MINYAK', 'SAYUR', 'LETTUCE', 'BAWANG', 'KULIT 25', 'KEJU', 'CUP', '', null, undefined]) {
        expect(getAturanSusutPos(nama)).toBeNull()
      }
    })
  })

  describe('hitungBatasLossPos & hitungSusutAktualPersen', () => {
    it('menghitung batas maksimum loss dari penyusutan berat mentah', () => {
      expect(hitungBatasLossPos(3000, getAturanSusutPos('AYAM')!)).toBeCloseTo(3000, 6)
      expect(hitungBatasLossPos(4000, getAturanSusutPos('KENTANG')!)).toBeCloseTo(1000, 6)
      expect(hitungBatasLossPos(850, getAturanSusutPos('SAOS CABE')!)).toBeCloseTo(150, 6)
      expect(hitungBatasLossPos(0, getAturanSusutPos('SAPI')!)).toBe(0)
    })

    it('menghitung persentase susut aktual yang konsisten dengan threshold susut', () => {
      // POS 3000 + loss 3000 = 6000 mentah -> susut 50.0%
      expect(hitungSusutAktualPersen(-3000, 3000)).toBe(50.0)
      // POS 3000 + loss 2000 = 5000 mentah -> susut 40.0%
      expect(hitungSusutAktualPersen(-2000, 3000)).toBe(40.0)
      // POS 4000 + loss 1000 = 5000 mentah -> susut 20.0%
      expect(hitungSusutAktualPersen(-1000, 4000)).toBe(20.0)
      // POS 850 + loss 150 = 1000 mentah -> susut 15.0%
      expect(hitungSusutAktualPersen(-150, 850)).toBe(15.0)
      // Loss saat POS = 0 -> 100%
      expect(hitungSusutAktualPersen(-100, 0)).toBe(100)
      // Pas atau surplus -> null
      expect(hitungSusutAktualPersen(0, 3000)).toBeNull()
      expect(hitungSusutAktualPersen(200, 3000)).toBeNull()
    })
  })

  describe('getThresholdPersen', () => {
    it('returns 20% for measurable primary units (bulk)', () => {
      expect(getThresholdPersen('kg')).toBe(20)
      expect(getThresholdPersen('gram')).toBe(20)
      expect(getThresholdPersen('liter')).toBe(20)
      expect(getThresholdPersen('ml')).toBe(20)
    })

    it('returns 20% for countable primary unit with measurable secondary unit', () => {
      expect(getThresholdPersen('blok', 'gram')).toBe(20)
      expect(getThresholdPersen('kompan', 'ml')).toBe(20)
    })

    it('returns 0% for countable primary unit with pcs (e.g. gas pcs + gram)', () => {
      expect(getThresholdPersen('pcs', 'gram')).toBe(0)
      expect(getThresholdPersen('pcs')).toBe(0)
      expect(getThresholdPersen('pack')).toBe(0)
      expect(getThresholdPersen('box')).toBe(0)
      expect(getThresholdPersen('ikat')).toBe(0)
    })

    it('returns fallback 15% if satuan is undefined', () => {
      expect(getThresholdPersen(undefined)).toBe(15)
    })

    it('returns persentase susut POS untuk AYAM/SAPI 50%, KENTANG 20%, SAOS* 15%', () => {
      expect(getThresholdPersen('blok', 'gram', 'SAPI')).toBe(50)
      expect(getThresholdPersen('kg', 'gram', 'ayam')).toBe(50)
      expect(getThresholdPersen('dus', 'gram', 'KENTANG')).toBe(20)
      expect(getThresholdPersen('dus', 'gram', 'SAOS CABE')).toBe(15)
      expect(getThresholdPersen('dus', 'gram', 'SAOS SAMYANG')).toBe(15)
      expect(getThresholdPersen('dus', 'gram', 'MAYONAISE')).toBe(20)
    })
  })

  describe('computeSelisihPersen', () => {
    it('calculates loss percentage correctly when selisih is negative', () => {
      const res = computeSelisihPersen(-500, 10000)
      expect(res.persen).toBe(-5.0)
      expect(res.formatted).toBe('-5.0%')
      expect(res.isLoss).toBe(true)
      expect(res.isSurplus).toBe(false)
      expect(res.isZero).toBe(false)
    })

    it('calculates surplus percentage correctly when selisih is positive', () => {
      const res = computeSelisihPersen(300, 10000)
      expect(res.persen).toBe(3.0)
      expect(res.formatted).toBe('+3.0%')
      expect(res.isLoss).toBe(false)
      expect(res.isSurplus).toBe(true)
      expect(res.isZero).toBe(false)
    })

    it('handles exact zero selisih', () => {
      const res = computeSelisihPersen(0, 10000)
      expect(res.persen).toBe(0)
      expect(res.formatted).toBe('0.0%')
      expect(res.isLoss).toBe(false)
      expect(res.isSurplus).toBe(false)
      expect(res.isZero).toBe(true)
    })

    it('handles edge case where qtySystem is zero', () => {
      const zeroSysZeroSel = computeSelisihPersen(0, 0)
      expect(zeroSysZeroSel.persen).toBe(0)
      expect(zeroSysZeroSel.formatted).toBe('0.0%')

      const zeroSysPosSel = computeSelisihPersen(10, 0)
      expect(zeroSysPosSel.persen).toBe(100)
      expect(zeroSysPosSel.formatted).toBe('+100.0%')
      expect(zeroSysPosSel.isSurplus).toBe(true)

      const zeroSysNegSel = computeSelisihPersen(-10, 0)
      expect(zeroSysNegSel.persen).toBe(-100)
      expect(zeroSysNegSel.formatted).toBe('-100.0%')
      expect(zeroSysNegSel.isLoss).toBe(true)
    })
  })

  describe('isSelisihFlagged', () => {
    it('bulk non-susut tetap memakai toleransi 20% dari stok sistem walau pakaiPosQty diberikan', () => {
      // 10,000g system stock -> threshold is 20% = 2000g
      expect(isSelisihFlagged(-2000, 10000, 'kg', 'gram', 'MINYAK', 500)).toBe(false)
      expect(isSelisihFlagged(-2001, 10000, 'kg', 'gram', 'MINYAK', 500)).toBe(true)
      expect(isSelisihFlagged(1900, 10000, 'dus', 'gram', 'MAYONAISE', 500)).toBe(false)
      expect(isSelisihFlagged(2100, 10000, 'dus', 'gram', 'MAYONAISE', 500)).toBe(true)
    })

    it('countable tetap 0% threshold walau pakaiPosQty diberikan', () => {
      expect(isSelisihFlagged(0, 100, 'pcs', null, 'CUP', 50)).toBe(false)
      expect(isSelisihFlagged(1, 100, 'pcs', null, 'CUP', 50)).toBe(true)
      expect(isSelisihFlagged(-1, 100, 'pack', 'lembar', 'KULIT 25', 50)).toBe(true)
    })

    it('AYAM & SAPI (susut 50% = maks 2x POS): loss <= 100% POS aman, > 100% POS flagged, surplus 0% flagged', () => {
      // POS = 3000 gr -> batas loss = 3000 gr (maks aktual 6000 gr), terlepas dari sisa stok sistem
      expect(isSelisihFlagged(0, 7000, 'kg', 'gram', 'AYAM', 3000)).toBe(false)
      expect(isSelisihFlagged(-2000, 7000, 'kg', 'gram', 'AYAM', 3000)).toBe(false)
      expect(isSelisihFlagged(-3000, 7000, 'blok', 'gram', 'SAPI', 3000)).toBe(false) // tepat batas 2x POS
      expect(isSelisihFlagged(-3001, 7000, 'blok', 'gram', 'SAPI', 3000)).toBe(true)  // lewat 2x POS
      // Sisa stok sistem sangat kecil (0 atau 500 gr) tapi POS besar (3000 gr) -> susut 500 gr tetap aman!
      expect(isSelisihFlagged(-500, 0, 'kg', 'gram', 'AYAM', 3000)).toBe(false)
      expect(isSelisihFlagged(-500, 500, 'kg', 'gram', 'AYAM', 3000)).toBe(false)
      // Surplus ketat 0%: sekecil apa pun > 0.01 langsung flagged
      expect(isSelisihFlagged(1, 7000, 'kg', 'gram', 'AYAM', 3000)).toBe(true)
      expect(isSelisihFlagged(50, 7000, 'blok', 'gram', 'SAPI', 3000)).toBe(true)
    })

    it('KENTANG (susut 20% = maks 1,25x POS): loss <= 25% POS aman, > 25% POS flagged, surplus flagged', () => {
      // POS = 4000 gr -> batas loss = 1000 gr (mentah maks 5000 gr)
      expect(isSelisihFlagged(-1000, 6000, 'dus', 'gram', 'KENTANG', 4000)).toBe(false)
      expect(isSelisihFlagged(-1001, 6000, 'dus', 'gram', 'KENTANG', 4000)).toBe(true)
      expect(isSelisihFlagged(1, 6000, 'dus', 'gram', 'KENTANG', 4000)).toBe(true)
    })

    it('SAOS* (susut 15% = maks ~1,18x POS): loss <= 0.15/0.85 POS aman (presisi float), > batas flagged, surplus flagged', () => {
      // POS = 850 gr -> batas loss = 150 gr tepat (uji floating point!)
      expect(isSelisihFlagged(-150, 5000, 'dus', 'gram', 'SAOS CABE', 850)).toBe(false)
      expect(isSelisihFlagged(-150, 5000, 'dus', 'gram', 'SAOS TOMAT POUCH', 850)).toBe(false)
      expect(isSelisihFlagged(-150, 5000, 'dus', 'gram', 'SAOS SAMYANG', 850)).toBe(false)
      expect(isSelisihFlagged(-151, 5000, 'dus', 'gram', 'SAOS CABE', 850)).toBe(true)
      expect(isSelisihFlagged(1, 5000, 'dus', 'gram', 'SAOS CABE POUCH', 850)).toBe(true)
    })

    it('bahan susut dengan Pemakaian POS = 0: setiap selisih non-zero langsung flagged', () => {
      expect(isSelisihFlagged(0, 5000, 'kg', 'gram', 'AYAM', 0)).toBe(false)
      expect(isSelisihFlagged(-1, 5000, 'kg', 'gram', 'AYAM', 0)).toBe(true)
      expect(isSelisihFlagged(1, 5000, 'kg', 'gram', 'AYAM', 0)).toBe(true)
      expect(isSelisihFlagged(-10, 5000, 'dus', 'gram', 'SAOS CABE', 0)).toBe(true)
    })

    it('fallback aman ke stok sistem apabila pakaiPosQty tidak disediakan (undefined)', () => {
      expect(isSelisihFlagged(-4900, 10000, 'kg', 'gram', 'SAPI')).toBe(false)
      expect(isSelisihFlagged(-5100, 10000, 'kg', 'gram', 'SAPI')).toBe(true)
      expect(isSelisihFlagged(-1400, 10000, 'dus', 'gram', 'SAOS CABE')).toBe(false)
      expect(isSelisihFlagged(-1600, 10000, 'dus', 'gram', 'SAOS CABE')).toBe(true)
    })
  })
})

describe('getMaterialType', () => {
  it('count = toleransi 0% (barang hitung)', () => {
    expect(getMaterialType('Pcs', null, 'AQUA')).toBe('count')
    expect(getMaterialType('Pack', 'Lembar', 'KULIT 25')).toBe('count')
  })

  it('bulk = toleransi di atas 0% (timbang/ukur & bahan susut POS)', () => {
    expect(getMaterialType('kg', 'gram', 'TEPUNG')).toBe('bulk')
    expect(getMaterialType('Blok', 'gram', 'SAPI')).toBe('bulk')
    expect(getMaterialType('Kg', 'gram', 'AYAM')).toBe('bulk')
    expect(getMaterialType('Dus', 'gram', 'SAOS CABE')).toBe('bulk')
  })

  it('selalu sepakat dengan getThresholdPersen', () => {
    const kasus: [string, string | null, string][] = [
      ['Pcs', null, 'AQUA'], ['kg', 'gram', 'TEPUNG'], ['Kg', 'gram', 'KENTANG'], ['Dus', 'gram', 'SAOS SAMYANG'],
    ]
    for (const [s, sk, n] of kasus) {
      expect(getMaterialType(s, sk, n) === 'bulk').toBe(getThresholdPersen(s, sk, n) > 0)
    }
  })
})

describe('nilaiToleransiSelisih', () => {
  it('SAPI berbasis POS: minus 2000 dari POS 3000 masih dalam batas susut 50%', () => {
    expect(nilaiToleransiSelisih(-2000, 7000, 'blok', 'gram', 'SAPI', 3000)).toEqual({
      thresholdPersen: 50,
      basis: 'pos',
      faktorMaksPos: 2,
      batasLossQty: 3000,
      lewatKarenaSurplus: false,
      dalamToleransi: true,
      lewatToleransi: false,
    })
  })

  it('AYAM berbasis POS: surplus +100 langsung lewat batas karena surplus 0%', () => {
    expect(nilaiToleransiSelisih(100, 7000, 'kg', 'gram', 'AYAM', 3000)).toEqual({
      thresholdPersen: 50,
      basis: 'pos',
      faktorMaksPos: 2,
      batasLossQty: 3000,
      lewatKarenaSurplus: true,
      dalamToleransi: false,
      lewatToleransi: true,
    })
  })

  it('bahan timbang non-susut minus 25% melewati toleransi 20% berbasis sistem', () => {
    expect(nilaiToleransiSelisih(-2500, 10000, 'kg', 'gram', 'MINYAK', 500)).toEqual({
      thresholdPersen: 20,
      basis: 'sistem',
      faktorMaksPos: null,
      batasLossQty: null,
      lewatKarenaSurplus: false,
      dalamToleransi: false,
      lewatToleransi: true,
    })
  })

  it('bahan hitung: selisih sekecil apa pun melewati toleransi 0%', () => {
    expect(nilaiToleransiSelisih(1, 100, 'pcs').lewatToleransi).toBe(true)
  })

  it('tanpa selisih: tidak dalam maupun lewat toleransi', () => {
    expect(nilaiToleransiSelisih(0, 100, 'kg', 'gram', 'AYAM', 3000)).toEqual({
      thresholdPersen: 50,
      basis: 'pos',
      faktorMaksPos: 2,
      batasLossQty: 3000,
      lewatKarenaSurplus: false,
      dalamToleransi: false,
      lewatToleransi: false,
    })
  })
})
