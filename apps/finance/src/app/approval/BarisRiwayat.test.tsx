import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('pencairan kasbon yang masih bisa dibatalkan menampilkan tombol batal', () => {
    const onBatal = vi.fn()
    const r = { ...dasar, jenis: 'kasbon' as const, keputusan: 'setuju' as const, alasan: null }
    const { rerender } = render(<BarisRiwayat r={r} bisaBatal onBatal={onBatal} />)
    expect(screen.getByText('Dicairkan')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Batalkan pencairan' }))
    expect(onBatal).toHaveBeenCalledWith(r)
    rerender(<BarisRiwayat r={r} bisaBatal={false} onBatal={onBatal} />)
    expect(screen.queryByRole('button', { name: 'Batalkan pencairan' })).toBeNull()
  })

  it('pembatalan pencairan menampilkan alasannya sebagai alasan batal', () => {
    render(<BarisRiwayat r={{ ...dasar, jenis: 'kasbon', keputusan: 'batal_cair', alasan: 'salah rekening' }} />)
    expect(screen.getByText('Pencairan dibatalkan')).toBeInTheDocument()
    expect(screen.getByText('Alasan dibatalkan:')).toBeInTheDocument()
  })
})
