import { kartuClosingUntuk, targetKartuClosing, viewKartuDariTarget } from './targetKartuClosing'

const BNR = '550e8400-e29b-41d4-a716-446655440001'
const GUDANG = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91'

describe('targetKartuClosing', () => {
  it('pemetaan target Buku Kas', () => {
    expect(viewKartuDariTarget('PUSAT')).toEqual({ jenis: 'pusat' })
    expect(viewKartuDariTarget('INTERNAL_OUTLETS')).toEqual({ jenis: 'internal' })
    expect(viewKartuDariTarget('INTERNAL_PUSAT')).toEqual({ jenis: 'internal_pusat' })
    expect(viewKartuDariTarget('ALL_OUTLETS')).toBeNull()
    expect(viewKartuDariTarget('MITRA_OUTLETS')).toBeNull()
    expect(viewKartuDariTarget(BNR)).toEqual({ jenis: 'outlet', outletId: BNR })
    expect(viewKartuDariTarget(GUDANG)).toEqual({ jenis: 'outlet', outletId: 'ss-online' })
    expect(viewKartuDariTarget('550e8400-e29b-41d4-a716-446655440014')).toBeNull()
  })

  it('satu outlet (BNR)', () => {
    expect(targetKartuClosing({ jenis: 'outlet', outletId: BNR })).toEqual({
      gajiRutin: 11202714, bonusKru: 148801, bonusManajer: 128224, lembur: 0, nonGaji: 7900, total: 11487639,
    })
  })

  it('outlet internal (12 kolom)', () => {
    expect(targetKartuClosing({ jenis: 'internal' })).toEqual({
      gajiRutin: 78894292, bonusKru: 2338838, bonusManajer: 2486568, lembur: 0, nonGaji: 85714125, total: 169433823,
    })
  })

  it('kantor pusat', () => {
    expect(targetKartuClosing({ jenis: 'pusat' })).toEqual({
      gajiRutin: 80400404, bonusKru: 0, bonusManajer: 0, lembur: 0, nonGaji: 142439866, total: 222840270,
    })
  })

  it('internal + pusat = jumlah keduanya', () => {
    const k = targetKartuClosing({ jenis: 'internal_pusat' })
    expect(k.total).toBe(169433823 + 222840270)
    expect(k.gajiRutin).toBe(78894292 + 80400404)
  })

  it('hanya untuk rentang tepat September; pilihan tak didukung memberi catatan', () => {
    expect(kartuClosingUntuk(BNR, '2026-09-01', '2026-09-30').kartu?.total).toBe(11487639)
    expect(kartuClosingUntuk(BNR, '2026-09-01', '2026-09-15')).toEqual({ kartu: null, catatan: expect.stringMatching(/1–30 September/) })
    expect(kartuClosingUntuk(BNR, '2026-08-01', '2026-08-31')).toEqual({ kartu: null, catatan: null })
    expect(kartuClosingUntuk('ALL_OUTLETS', '2026-09-01', '2026-09-30')).toEqual({ kartu: null, catatan: expect.stringMatching(/Outlet Internal/) })
  })
})
