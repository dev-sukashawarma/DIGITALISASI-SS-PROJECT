import { describe, it, expect } from 'vitest'
import { buatPromptSistem } from './prompt'
import type { OutletInfo } from './alat/penjualan'

const OUTLETS: OutletInfo[] = [
  { id: '1', name: 'SUKA SHAWARMA BEJI', type: 'internal', is_active: true, slug: 'beji-depok' },
  { id: '2', name: 'MITRA CIBUBUR', type: 'mitra', is_active: true, slug: 'suka-shawarma-cibubur' },
  { id: '3', name: 'SUKA SHAWARMA JATIASIH', type: 'internal', is_active: false, slug: 'jatiasih-bekasi' },
  { id: '4', name: 'SS BACKUP', type: 'internal', is_active: true, slug: 'ss-backup' },
  { id: '5', name: 'Shopee', type: 'marketplace', is_active: true, slug: 'shopee' },
]

const dasar = { hariIni: '2026-10-05', sekarang: new Date('2026-10-05T07:00:00Z'), namaPengguna: 'Owner', outlets: OUTLETS }

describe('buatPromptSistem', () => {
  it('memuat daftar outlet aktif dengan jenis milik/mitra, tanpa outlet non-operasional', () => {
    const p = buatPromptSistem({ ...dasar, tanggalRekap: '2026-10-04' })
    expect(p).toContain('- SUKA SHAWARMA BEJI (milik)')
    expect(p).toContain('- MITRA CIBUBUR (mitra)')
    expect(p).not.toContain('JATIASIH')
    expect(p).not.toContain('SS BACKUP')
    expect(p).not.toContain('Shopee')
  })
  it('periode default = tanggal rekap bila Bos tidak menyebut waktu', () => {
    const p = buatPromptSistem({ ...dasar, tanggalRekap: '2026-10-04' })
    expect(p).toContain('Rekap yang tampil di atas percakapan adalah untuk Min 4 Okt 2026')
    expect(p).toContain('pakai periode rentang dari=2026-10-04 sampai=2026-10-04')
  })
  it('tanpa rekap: default kemarin', () => {
    const p = buatPromptSistem({ ...dasar, tanggalRekap: null })
    expect(p).toContain('pakai periode "kemarin"')
  })
  it('jam & tanggal sekarang dalam WIB', () => {
    expect(buatPromptSistem({ ...dasar, tanggalRekap: null })).toContain('Hari ini Sen 5 Okt 2026, pukul 14:00 WIB.')
  })
})
