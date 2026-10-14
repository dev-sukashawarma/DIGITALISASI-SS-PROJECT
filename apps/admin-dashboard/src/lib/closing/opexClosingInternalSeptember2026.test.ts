import {
  BARIS_OPEX_OUTLET,
  BARIS_OPEX_PUSAT,
  CLOSING_OPEX_INTERNAL_SEPT_2026 as C,
} from './opexClosingInternalSeptember2026'

const jumlah = (o: Record<string, number>) => Object.values(o).reduce((s, v) => s + v, 0)

describe('data closing OPEX internal September 2026', () => {
  it('meliputi tepat 12 kolom internal (SS Online + 11 outlet)', () => {
    expect(Object.keys(C.outlets).sort()).toEqual([
      '550e8400-e29b-41d4-a716-446655440001',
      '550e8400-e29b-41d4-a716-446655440002',
      '550e8400-e29b-41d4-a716-446655440004',
      '550e8400-e29b-41d4-a716-446655440005',
      '550e8400-e29b-41d4-a716-446655440006',
      '550e8400-e29b-41d4-a716-446655440007',
      '550e8400-e29b-41d4-a716-446655440008',
      '550e8400-e29b-41d4-a716-446655440009',
      '550e8400-e29b-41d4-a716-446655440010',
      '550e8400-e29b-41d4-a716-446655440011',
      '550e8400-e29b-41d4-a716-446655440013',
      'ss-online',
    ])
    expect(C.from).toBe('2026-09-01')
    expect(C.to).toBe('2026-09-30')
  })

  it('jumlah 13 baris tiap outlet = Total OPEX baris 50 Excel', () => {
    for (const o of Object.values(C.outlets)) {
      expect(Object.keys(o.target).sort()).toEqual([...BARIS_OPEX_OUTLET].sort())
      expect(Math.abs(jumlah(o.target) - o.totalExcel)).toBeLessThan(1)
    }
  })

  it('jumlah 9 baris HQ = Total OPEX HQ 222.840.270', () => {
    expect(Object.keys(C.pusat.target).sort()).toEqual([...BARIS_OPEX_PUSAT].sort())
    expect(jumlah(C.pusat.target)).toBe(222840270)
    expect(C.pusat.totalExcel).toBe(222840270)
  })

  it('titik uji sama dengan sel Excel', () => {
    expect(C.outlets['550e8400-e29b-41d4-a716-446655440001'].target.gaji_crew_outlet).toBe(11202714)
    expect(C.outlets['550e8400-e29b-41d4-a716-446655440005'].target.pengeluaran_outlet).toBe(3884000)
    expect(C.outlets['550e8400-e29b-41d4-a716-446655440005'].target.pdam).toBe(0)
    expect(C.outlets['ss-online'].target.gaji_crew_outlet).toBe(6630000)
    expect(C.outlets['ss-online'].target.internet).toBe(260850)
    expect(C.outlets['550e8400-e29b-41d4-a716-446655440008'].totalExcel).toBe(10114336)
    expect(C.pusat.target.pengeluaran_global).toBe(126079883)
    expect(C.pusat.target.crew_backup).toBe(8694636)
    expect(C.pusat.target.bahan_baku).toBe(1504609)
  })

  it('alasan baris non-lembur tidak memuat kata yang dibaca sebagai lembur', () => {
    const terlarang = /\b(lembur(an)?|overtime)\b/i
    for (const o of Object.values(C.outlets)) {
      for (const [baris, teks] of Object.entries(o.alasan)) {
        if (baris !== 'lembur') expect(teks).not.toMatch(terlarang)
      }
    }
    for (const teks of Object.values(C.pusat.alasan)) expect(teks).not.toMatch(terlarang)
  })
})
