import { BATAS, validasiPesan, judulDari, idUntukDipangkas, GALAT_STANDAR } from './batas'

describe('batas', () => {
  it('validasiPesan: trim, 1–2000 karakter', () => {
    expect(validasiPesan('  omzet kemarin  ')).toEqual({ ok: true, pesan: 'omzet kemarin' })
    expect(validasiPesan('   ').ok).toBe(false)
    expect(validasiPesan(123).ok).toBe(false)
    expect(validasiPesan('a'.repeat(2001)).ok).toBe(false)
    expect(validasiPesan('a'.repeat(2000)).ok).toBe(true)
  })
  it('judulDari: 60 karakter pertama, satu baris', () => {
    expect(judulDari('omzet\nkemarin')).toBe('omzet kemarin')
    expect(judulDari('x'.repeat(100))).toHaveLength(60)
  })
  it('idUntukDipangkas: semua setelah 50 terbaru', () => {
    const ids = Array.from({ length: 53 }, (_, i) => `id${i}`)
    expect(idUntukDipangkas(ids)).toEqual(['id50', 'id51', 'id52'])
    expect(idUntukDipangkas(ids.slice(0, 50))).toEqual([])
  })
  it('konstanta', () => {
    expect(BATAS).toEqual({ panjangPesan: 2000, pesanPerJam: 60, percakapanMaks: 50, timeoutMs: 120_000 })
    expect(GALAT_STANDAR).toBe('Bot sedang tidak bisa dihubungi. Coba lagi sebentar lagi.')
  })
})
