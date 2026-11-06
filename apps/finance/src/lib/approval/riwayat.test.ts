import { describe, it, expect } from 'vitest'
import { labelRiwayat, teksWaktuRiwayat, type RiwayatApproval } from './riwayat'

function baris(over: Partial<RiwayatApproval> = {}): RiwayatApproval {
  return {
    id: 'r1',
    jenis: 'petty_cash',
    keputusan: 'setuju',
    sumber_id: 's1',
    judul: 'Mitra Cibinong',
    keterangan: 'beli gas',
    nominal: 500000,
    alasan: null,
    waktu: '2026-11-06T03:00:00Z',
    waktu_urut: '2026-11-06T03:00:00Z',
    dari_data_lama: false,
    pelaku_nama: 'Hesti',
    ...over,
  }
}

describe('labelRiwayat', () => {
  it('petty cash diserahkan ke AM berlabel khusus', () => {
    expect(labelRiwayat(baris({ keputusan: 'serah_am' }))).toEqual({ jenis: 'Petty cash', keputusan: 'Diserahkan ke AM' })
  })
  it('dana kantor yang disetujui berlabel Diverifikasi', () => {
    expect(labelRiwayat(baris({ jenis: 'dana_kantor', keputusan: 'setuju' }))).toEqual({ jenis: 'Dana kantor', keputusan: 'Diverifikasi' })
  })
  it('tolak berlabel Ditolak di semua jenis', () => {
    expect(labelRiwayat(baris({ jenis: 'po', keputusan: 'tolak' })).keputusan).toBe('Ditolak')
  })
})

describe('teksWaktuRiwayat', () => {
  it('data lama tanpa jam ditandai, bukan dikarang', () => {
    expect(teksWaktuRiwayat(null)).toBe('Jam tidak tercatat')
  })
  it('jam tercatat ditampilkan dalam WIB', () => {
    expect(teksWaktuRiwayat('2026-11-06T03:00:00Z')).toContain('10.00')
  })
})
