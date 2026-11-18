import { describe, expect, it } from 'vitest'
import { biayaProses, estimasiBiayaXendit, jenisChannel, mdrSeharusnya, tanggalWibDari } from './tarif'

const OKT = '2026-10-25T08:33:57Z'

describe('tarif Xendit', () => {
  it('tanggal WIB', () => {
    expect(tanggalWibDari('2026-09-30T16:59:59Z')).toBe('2026-09-30')
    expect(tanggalWibDari('2026-09-30T17:00:00Z')).toBe('2026-10-01')
  })

  it('Processing Fee Rp 4.440 mulai 1 Okt 2026 WIB', () => {
    expect(biayaProses('2026-09-30T16:59:59Z')).toBe(0)
    expect(biayaProses('2026-09-30T17:00:00Z')).toBe(4440)
  })

  it('jenis channel', () => {
    expect(jenisChannel('QRIS')).toBe('qris')
    expect(jenisChannel(null)).toBe('qris')
    expect(jenisChannel('')).toBe('qris')
    expect(jenisChannel('BNI')).toBe('va')
    expect(jenisChannel('MANDIRI')).toBe('va')
  })

  it('MDR sesuai potongan di file Xendit', () => {
    expect(mdrSeharusnya(262566, 'QRIS', '2026-10-26T07:50:39Z')).toBe(1835)
    expect(mdrSeharusnya(127762, 'QRIS', OKT)).toBe(892)
    expect(mdrSeharusnya(99999, 'QRIS', OKT)).toBe(0)
    expect(mdrSeharusnya(50000, 'QRIS', '2026-09-29T05:00:00Z')).toBe(349)
    expect(mdrSeharusnya(36216, 'BNI', OKT)).toBe(9990)
    expect(mdrSeharusnya(36216, null, OKT)).toBe(0)
  })

  it('estimasi = MDR + Processing Fee', () => {
    expect(estimasiBiayaXendit(262566, 'QRIS', '2026-10-26T07:50:39Z')).toBe(6275)
  })
})
