import { PENDAPATAN_MITRA_CLOSING_SEPT_2026 as P, pendapatanMitraClosingUntuk } from './pendapatanMitraClosingSeptember2026'

describe('pendapatan pusat dari mitra — closing September 2026 (sheet FIXED baris 53–54)', () => {
  it('11 mitra kolom N–X, total = N55:X55 = 90.469.975', () => {
    expect(Object.keys(P.outlets)).toHaveLength(11)
    const tot = Object.values(P.outlets).reduce((s, o) => s + o.bagiHasilSs + o.marginHpp, 0)
    expect(Math.round(tot)).toBe(90469975)
  })

  it('angka per mitra sesuai sel Excel', () => {
    expect(P.outlets['550e8400-e29b-41d4-a716-446655440014']).toMatchObject({ kolomExcel: 'N', bagiHasilSs: 9504785.5 })
    expect(Math.round(P.outlets['550e8400-e29b-41d4-a716-446655440014'].marginHpp)).toBe(7181463)
    expect(P.outlets['3f38c41d-11e3-49ce-a189-d7303e45f9ad'].kolomExcel).toBe('T') // KOTWIS = Cibubur
    expect(Math.round(P.outlets['62a56103-2085-4dd5-9d25-a3c0cffc88ff'].marginHpp)).toBe(20632135)
    expect(P.outlets['550e8400-e29b-41d4-a716-446655440017'].bagiHasilSs).toBe(0)
  })

  it('hanya untuk rentang tepat 1–30 September', () => {
    const r = pendapatanMitraClosingUntuk('2026-09-01', '2026-09-30')!
    expect(r.feeManajemen).toBeCloseTo(25922967.46, 2)
    expect(r.marginHpp).toBeCloseTo(64547007.7, 2)
    expect(pendapatanMitraClosingUntuk('2026-09-01', '2026-09-15')).toBeNull()
    expect(pendapatanMitraClosingUntuk('2026-08-01', '2026-08-31')).toBeNull()
  })
})
