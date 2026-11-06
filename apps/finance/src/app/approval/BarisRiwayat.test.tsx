import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BarisRiwayat } from './BarisRiwayat'
import type { RiwayatApproval } from '@/lib/approval/riwayat'

const dasar: RiwayatApproval = {
  id: 'r1',
  jenis: 'po',
  keputusan: 'tolak',
  sumber_id: 'po1',
  judul: 'PT Agro Boga Utama',
  keterangan: 'SPB/PO/XI/2026/010',
  nominal: 5000000,
  alasan: 'harga terlalu tinggi',
  waktu: '2026-11-06T03:00:00Z',
  waktu_urut: '2026-11-06T03:00:00Z',
  dari_data_lama: false,
  pelaku_nama: 'Hesti Qodriani',
}

describe('BarisRiwayat', () => {
  it('menampilkan keputusan, pelaku, dan alasan tolak', () => {
    render(<BarisRiwayat r={dasar} />)
    expect(screen.getByText('Ditolak')).toBeInTheDocument()
    expect(screen.getByText(/Hesti Qodriani/)).toBeInTheDocument()
    expect(screen.getByText(/harga terlalu tinggi/)).toBeInTheDocument()
  })

  it('data lama tanpa jam ditandai jujur', () => {
    render(<BarisRiwayat r={{ ...dasar, waktu: null, dari_data_lama: true, keputusan: 'setuju', alasan: null }} />)
    expect(screen.getByText('Jam tidak tercatat')).toBeInTheDocument()
    expect(screen.getByText('Disetujui')).toBeInTheDocument()
  })

  it('pelaku tidak diketahui ditampilkan sebagai tanda pisah', () => {
    render(<BarisRiwayat r={{ ...dasar, pelaku_nama: null }} />)
    expect(screen.getByText(/oleh —/)).toBeInTheDocument()
  })
})
