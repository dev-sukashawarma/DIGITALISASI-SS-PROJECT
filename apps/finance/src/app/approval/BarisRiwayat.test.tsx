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
  pelaku_nama: 'Superadmin 2',
}

describe('BarisRiwayat', () => {
  it('menampilkan jam WIB, keputusan, pelaku, dan alasan tolak', () => {
    render(<BarisRiwayat r={dasar} />)
    expect(screen.getByText('10.00')).toBeInTheDocument()
    expect(screen.getByText('Ditolak')).toBeInTheDocument()
    expect(screen.getByText('Hesti Qodriani')).toBeInTheDocument()
    expect(screen.getByText('harga terlalu tinggi')).toBeInTheDocument()
    expect(screen.getByText('Rp 5.000.000')).toBeInTheDocument()
  })

  it('data lama tanpa jam tidak mengarang jam', () => {
    render(<BarisRiwayat r={{ ...dasar, waktu: null, dari_data_lama: true, keputusan: 'setuju', alasan: null }} />)
    expect(screen.queryByText('10.00')).toBeNull()
    expect(screen.getByText('Disetujui')).toBeInTheDocument()
  })

  it('pelaku yang tidak tercatat ditulis apa adanya', () => {
    render(<BarisRiwayat r={{ ...dasar, pelaku_nama: null }} />)
    expect(screen.getByText('Pelaku tidak tercatat')).toBeInTheDocument()
  })
})
