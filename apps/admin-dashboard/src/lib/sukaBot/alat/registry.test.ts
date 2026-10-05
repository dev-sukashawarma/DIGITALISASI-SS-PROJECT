import { describe, it, expect, vi } from 'vitest'
import { DEFINISI_ALAT, jalankanAlat, type DepsAlat } from './registry'

function deps(): DepsAlat {
  return {
    penjualan: {
      hariIni: '2026-10-01', sekarang: new Date('2026-10-01T07:30:00Z'),
      outlets: [{ id: 'o1', name: 'SUKA SHAWARMA BEJI', type: 'outlet', is_active: true }],
      ambilLaporan: vi.fn(async () => ({ omzetKotor: 100, omzetBersih: 90, transaksi: 2, menu: [] })),
    },
    stok: { hariIni: '2026-10-01', outlets: [], daftarBahan: async () => [], barisStok: async () => [] },
    catatGagal: vi.fn(async () => {}),
  }
}

describe('DEFINISI_ALAT', () => {
  it('enam alat dengan nama tetap', () => {
    expect(DEFINISI_ALAT.map((d) => d.function.name)).toEqual(['omzet', 'bandingkan_periode', 'menu_terlaris', 'ranking_outlet', 'stok_bahan', 'catat_pertanyaan_gagal'])
  })
})

describe('jalankanAlat', () => {
  it('meneruskan argumen valid', async () => {
    const r = await jalankanAlat('omzet', JSON.stringify({ periode: 'kemarin' }), deps())
    expect(r.status).toBe('ok')
  })
  it('argumen tidak valid → galat, tidak melempar', async () => {
    const r = await jalankanAlat('omzet', JSON.stringify({ periode: 'tahun_depan' }), deps())
    expect(r).toMatchObject({ status: 'galat' })
  })
  it('JSON rusak → galat', async () => {
    const r = await jalankanAlat('omzet', '{periode:', deps())
    expect(r).toMatchObject({ status: 'galat' })
  })
  it('nama alat tak dikenal → galat', async () => {
    const r = await jalankanAlat('hapus_semua', '{}', deps())
    expect(r).toMatchObject({ status: 'galat', pesan: 'Alat "hapus_semua" tidak ada' })
    expect(await jalankanAlat('constructor', '{}', deps())).toMatchObject({ status: 'galat' })
  })
  it('catat_pertanyaan_gagal memanggil catatGagal', async () => {
    const d = deps()
    const r = await jalankanAlat('catat_pertanyaan_gagal', JSON.stringify({ alasan: 'tanya laba' }), d)
    expect(d.catatGagal).toHaveBeenCalledWith('tanya laba')
    expect(r.status).toBe('ok')
  })
  it('galat dari alat ditangkap', async () => {
    const d = deps()
    d.penjualan.ambilLaporan = vi.fn(async () => { throw new Error('DB mati') })
    const r = await jalankanAlat('omzet', JSON.stringify({ periode: 'kemarin' }), d)
    expect(r).toMatchObject({ status: 'galat', pesan: 'DB mati' })
  })
})
