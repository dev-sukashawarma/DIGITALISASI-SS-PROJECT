// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  MITRA_CLOSING_DATA_AUGUST_2026,
  MITRA_CLOSING_DATA_SEPTEMBER_2026,
  getMitraAugustClosing,
  getMitraClosing,
  getMitraClosingMonth,
  isAugust2026Period,
  isClosingBerlaku,
  rencanaPeriodeClosing,
} from '@/app/actions/mitraPnlClosingData'

const CISEENG = '550e8400-e29b-41d4-a716-446655440017'
const CIBINONG = '550e8400-e29b-41d4-a716-446655440014'

describe('getMitraClosingMonth', () => {
  it('hanya cocok untuk rentang satu bulan penuh', () => {
    expect(getMitraClosingMonth('2026-09-01', '2026-09-30')?.label).toBe('September 2026')
    expect(getMitraClosingMonth('2026-08-01', '2026-08-31')?.label).toBe('Agustus 2026')
    expect(getMitraClosingMonth('2026-09-01', '2026-09-15')).toBeUndefined()
    expect(getMitraClosingMonth('2026-09-02', '2026-09-30')).toBeUndefined()
    expect(getMitraClosingMonth('2026-08-01', '2026-09-30')).toBeUndefined()
    expect(getMitraClosingMonth('2026-10-01', '2026-10-31')).toBeUndefined()
  })

  it('Agustus tetap berperilaku lama, September menggantikan penuh', () => {
    expect(getMitraClosingMonth('2026-08-01', '2026-08-31')?.terapkanPenuh).toBe(false)
    expect(getMitraClosingMonth('2026-09-01', '2026-09-30')?.terapkanPenuh).toBe(true)
  })
})

describe('getMitraClosing', () => {
  it('mengembalikan closing sesuai bulan, tidak tertukar antar bulan', () => {
    expect(getMitraClosing(CISEENG, '2026-09-01', '2026-09-30')?.totals.netProfit).toBe(2010408)
    expect(getMitraClosing(CISEENG, '2026-08-01', '2026-08-31')?.totals.netProfit).toBe(5328172.1)
    expect(getMitraClosing(CISEENG, '2026-09-01', '2026-09-29')).toBeUndefined()
    expect(getMitraClosing('outlet-tak-dikenal', '2026-09-01', '2026-09-30')).toBeUndefined()
  })
})

describe('data Agustus 2026 tidak berubah', () => {
  it('helper lama tetap sama', () => {
    expect(isAugust2026Period('2026-08-01', '2026-08-31')).toBe(true)
    expect(isAugust2026Period('2026-09-01', '2026-09-30')).toBe(false)
    expect(getMitraAugustClosing(CIBINONG)?.totals.netProfit).toBe(30084685.1)
    expect(getMitraAugustClosing(CIBINONG)?.totals.mitraShare).toBe(15042342.55)
    expect(Object.keys(MITRA_CLOSING_DATA_AUGUST_2026)).toHaveLength(9)
  })
})

describe('isClosingBerlaku', () => {
  const sep = getMitraClosingMonth('2026-09-01', '2026-09-30')!
  const agu = getMitraClosingMonth('2026-08-01', '2026-08-31')!

  it('September: berlaku bila semua outlet tercakup', () => {
    expect(isClosingBerlaku(sep, [CISEENG], () => true)).toBe(true)
  })
  it('September: TIDAK berlaku bila ada outlet berpenjualan yang belum punya closing', () => {
    expect(isClosingBerlaku(sep, [CISEENG, 'belum-ada'], () => true)).toBe(false)
  })
  it('September: outlet tanpa penjualan tidak menghalangi', () => {
    expect(isClosingBerlaku(sep, [CISEENG, 'kosong'], oid => oid !== 'kosong')).toBe(true)
  })
  it('September: tidak berlaku bila tak satu pun outlet punya closing', () => {
    expect(isClosingBerlaku(sep, ['kosong'], () => false)).toBe(false)
  })
  it('Agustus: cukup satu outlet punya closing (perilaku lama)', () => {
    expect(isClosingBerlaku(agu, [CIBINONG, 'belum-ada'], () => true)).toBe(true)
    expect(isClosingBerlaku(agu, ['belum-ada'], () => true)).toBe(false)
  })
  it('tanpa bulan closing: tidak berlaku', () => {
    expect(isClosingBerlaku(undefined, [CISEENG], () => true)).toBe(false)
  })
})

describe('data September 2026 konsisten secara internal', () => {
  for (const [oid, c] of Object.entries(MITRA_CLOSING_DATA_SEPTEMBER_2026)) {
    it(`${c.name} (${oid})`, () => {
      const t = c.totals
      expect(c.pos.revenue + c.foodApps.revenue + c.tiktok.revenue).toBeCloseTo(t.grossRevenue, 2)
      expect(c.pos.deductions + c.foodApps.deductions + c.tiktok.deductions).toBeCloseTo(t.totalDeductions, 2)
      expect(c.pos.cogs + c.foodApps.cogs + c.tiktok.cogs).toBeCloseTo(t.totalCogs, 2)
      expect(t.grossRevenue - t.totalDeductions).toBeCloseTo(t.netRevenue, 2)
      expect(t.netRevenue - t.totalCogs).toBeCloseTo(t.grossProfit, 2)
      expect(t.grossProfit - t.totalWaste - t.totalOpex - t.managementFeeAmount).toBeCloseTo(t.netProfit, 2)
      expect((t.netProfit * (t.profitSharingPct ?? 0)) / 100).toBeCloseTo(t.mitraShare, 2)
      const jumlahBaris = (c.opexLines ?? []).reduce((s, l) => s + l.amount, 0)
      expect(jumlahBaris).toBeCloseTo(t.totalOpex, 2)
      expect((c.opexLines ?? []).every(l => l.amount !== 0)).toBe(true)
    })
  }
})

describe('Ciseeng September 2026 = sheet MITRA SEPTEMBER 2026 kolom C', () => {
  const c = MITRA_CLOSING_DATA_SEPTEMBER_2026[CISEENG]
  it('angka kunci', () => {
    expect(c.pos).toEqual({ revenue: 13706378 + 29174, cogs: 8665489 + 20141, deductions: 0 })
    expect(c.foodApps).toEqual({ revenue: 26486000, cogs: 13006085, deductions: 6510274 })
    expect(c.tiktok).toEqual({ revenue: 8638000, cogs: 6344925, deductions: 796440 })
    expect(c.totals.totalCogs).toBe(28036640)
    expect(c.totals.totalWaste).toBe(243945)
    expect(c.totals.totalOpex).toBe(11261845)
    expect(c.totals.managementFeeAmount).toBe(0)
    expect(c.totals.netProfit).toBe(2010408)
    expect(c.totals.mitraShare).toBe(2010408)
  })
})

describe('rencanaPeriodeClosing — September selalu disajikan sebulan penuh', () => {
  const ringkas = (from: string, to: string) => {
    const r = rencanaPeriodeClosing(from, to)
    return r && { from: r.from, to: r.to, segmen: r.segmen.map(s => `${s.from}..${s.to}${s.closing ? '*' : ''}`) }
  }

  it('rentang yang tidak menyentuh September: tidak ada rencana', () => {
    expect(ringkas('2026-10-01', '2026-10-12')).toBeUndefined()
    expect(ringkas('2026-08-01', '2026-08-31')).toBeUndefined()
    expect(ringkas('2026-07-01', '2026-08-31')).toBeUndefined()
  })
  it('tepat sebulan penuh: satu segmen closing', () => {
    expect(ringkas('2026-09-01', '2026-09-30')).toEqual({ from: '2026-09-01', to: '2026-09-30', segmen: ['2026-09-01..2026-09-30*'] })
  })
  it('sebagian September: dilebarkan jadi sebulan penuh', () => {
    const penuh = { from: '2026-09-01', to: '2026-09-30', segmen: ['2026-09-01..2026-09-30*'] }
    expect(ringkas('2026-09-10', '2026-09-16')).toEqual(penuh)
    expect(ringkas('2026-09-01', '2026-09-29')).toEqual(penuh)
    expect(ringkas('2026-09-30', '2026-09-30')).toEqual(penuh)
  })
  it('lintas September–Oktober: September penuh + hari Oktober apa adanya', () => {
    expect(ringkas('2026-09-13', '2026-10-12')).toEqual({
      from: '2026-09-01', to: '2026-10-12', segmen: ['2026-09-01..2026-09-30*', '2026-10-01..2026-10-12'],
    })
  })
  it('lintas Agustus–September: hari Agustus apa adanya + September penuh', () => {
    expect(ringkas('2026-08-20', '2026-09-05')).toEqual({
      from: '2026-08-20', to: '2026-09-30', segmen: ['2026-08-20..2026-08-31', '2026-09-01..2026-09-30*'],
    })
  })
  it('melingkupi September: tiga segmen, batas luar tidak berubah', () => {
    expect(ringkas('2026-08-01', '2026-10-31')).toEqual({
      from: '2026-08-01', to: '2026-10-31',
      segmen: ['2026-08-01..2026-08-31', '2026-09-01..2026-09-30*', '2026-10-01..2026-10-31'],
    })
  })
  it('masukan kosong atau terbalik: tidak ada rencana', () => {
    expect(ringkas('', '')).toBeUndefined()
    expect(ringkas('2026-09-20', '2026-09-10')).toBeUndefined()
  })
})
