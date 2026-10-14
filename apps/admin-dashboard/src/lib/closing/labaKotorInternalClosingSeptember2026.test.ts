import { LABA_KOTOR_INTERNAL_CLOSING_SEPT_2026 as L, penyesuaianLabaKotorClosing } from './labaKotorInternalClosingSeptember2026'

// Nilai layar (rincian Laba Bersih Internal, 14 Okt) sebagai contoh data live.
const LIVE = { omzet: 1013752774, potongan: 292116926, hpp: 494609232, waste: 6308199 }

describe('laba kotor internal — closing September 2026 (sheet FIXED kolom B–M)', () => {
  it('12 kolom internal; target sama dengan baris Excel', () => {
    expect(Object.keys(L.outlets)).toHaveLength(12)
    expect(Math.round(L.total.omzet)).toBe(1013526733)
    expect(Math.round(L.total.potongan)).toBe(292219452)
    expect(Math.round(L.total.komisiTiktokKedua)).toBe(5654680)
    expect(Math.round(L.total.hpp)).toBe(494596465)
    expect(Math.round(L.total.waste)).toBe(6297346)
  })

  it('target laba kotor − waste = Σ TOTAL GROSS PROFIT kolom B–M (214.758.790)', () => {
    const t = L.total
    expect(Math.round(t.omzet - t.potongan - t.komisiTiktokKedua - t.hpp - t.waste)).toBe(214758790)
  })

  it('penyesuaian = target − live, sehingga hasil akhir tepat target', () => {
    const p = penyesuaianLabaKotorClosing('2026-09-01', '2026-09-30', LIVE)!
    expect(Math.round(p.omzet)).toBe(1013526733 - 1013752774)
    expect(Math.round(p.potongan)).toBe(292219452 - 292116926)
    expect(Math.round(p.komisiTiktokKedua)).toBe(5654680)
    expect(Math.round(p.hpp)).toBe(494596465 - 494609232)
    expect(Math.round(p.waste)).toBe(6297346 - 6308199)
    const laba = (LIVE.omzet + p.omzet) - (LIVE.potongan + p.potongan + p.komisiTiktokKedua) - (LIVE.hpp + p.hpp) - (LIVE.waste + p.waste)
    expect(Math.round(laba)).toBe(214758790)
  })

  it('hanya untuk rentang tepat 1–30 September', () => {
    expect(penyesuaianLabaKotorClosing('2026-09-01', '2026-09-15', LIVE)).toBeNull()
    expect(penyesuaianLabaKotorClosing('2026-10-01', '2026-10-31', LIVE)).toBeNull()
  })
})
