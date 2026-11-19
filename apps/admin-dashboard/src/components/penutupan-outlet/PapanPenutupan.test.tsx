import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
const mockTandaiPenutupanSelesai = vi.fn()
vi.mock('@/app/dashboard/penutupan-outlet/actions', () => ({
  bukaKembaliOutlet: vi.fn(),
  centangLangkah: vi.fn(),
  koreksiTanggalTutup: vi.fn(),
  nolkanSisaStok: vi.fn(),
  tandaiPenutupanSelesai: (...args: unknown[]) => mockTandaiPenutupanSelesai(...args),
}))

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PapanPenutupan } from './PapanPenutupan'
import type { StatusPenutupan } from '@/lib/penutupanOutlet/types'

function status(alasanTutup: string | null, siapSelesai = false): StatusPenutupan {
  return {
    outletId: 'o1',
    nama: 'MITRA LAMA',
    jenis: 'mitra',
    status: 'inactive',
    nonaktifAt: '2026-08-13',
    alasanTutup,
    penutupanSelesaiAt: null,
    siapSelesai,
    langkah: [
      { kunci: 'stok', label: 'Sisa stok dikosongkan', penanggungJawab: 'Admin', wajib: true, selesai: siapSelesai, info: siapSelesai ? null : '3 bahan, Rp 10.000', manual: false, dicentangOleh: null, dicentangAt: null },
      { kunci: 'aset', label: 'Aset dipindah', penanggungJawab: 'AM', wajib: false, selesai: false, info: null, manual: true, dicentangOleh: null, dicentangAt: null },
    ],
  }
}

describe('PapanPenutupan', () => {
  beforeEach(() => {
    mockTandaiPenutupanSelesai.mockReset()
    mockTandaiPenutupanSelesai.mockResolvedValue({ ok: true })
  })

  it('outlet yang ditutup lewat wizard: centang, Nolkan, dan Tandai selesai paksa tersedia', () => {
    render(<PapanPenutupan status={status('Lokasi diambil alih')} bolehTulis bolehCentang />)
    expect(screen.getByRole('checkbox', { name: /Aset dipindah/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nolkan sisa stok/ })).toBeInTheDocument()
    const btnSelesai = screen.getByRole('button', { name: /Tandai selesai paksa \(1 langkah wajib belum\)/ })
    expect(btnSelesai).toBeEnabled()
  })

  it('tandai selesai paksa membuka dialog alasan dan mengirim alasan ke server action', async () => {
    render(<PapanPenutupan status={status('Lokasi diambil alih')} bolehTulis bolehCentang />)
    fireEvent.click(screen.getByRole('button', { name: /Tandai selesai paksa/ }))
    expect(screen.getByRole('dialog', { name: 'Tandai selesai paksa' })).toBeInTheDocument()
    expect(screen.getByText(/1 langkah wajib belum selesai dan akan dilewati/)).toBeInTheDocument()

    const submit = screen.getByRole('button', { name: 'Tandai selesai paksa' })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Alasan'), { target: { value: 'Mutasi stok lama sudah tidak relevan' } })
    expect(submit).toBeEnabled()

    fireEvent.click(submit)
    await waitFor(() => {
      expect(mockTandaiPenutupanSelesai).toHaveBeenCalledWith('o1', 'Mutasi stok lama sudah tidak relevan')
    })
  })

  it('ketika siapSelesai true: tombol Tandai Penutupan Selesai memanggil action langsung tanpa dialog', async () => {
    render(<PapanPenutupan status={status('Lokasi diambil alih', true)} bolehTulis bolehCentang />)
    fireEvent.click(screen.getByRole('button', { name: 'Tandai Penutupan Selesai' }))
    await waitFor(() => {
      expect(mockTandaiPenutupanSelesai).toHaveBeenCalledWith('o1')
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('outlet nonaktif lama tanpa penutupan wizard: aksi yang pasti ditolak sistem tidak ditampilkan', () => {
    render(<PapanPenutupan status={status(null)} bolehTulis bolehCentang />)
    expect(screen.getByText(/dinonaktifkan sebelum Wizard Penutupan/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /Nolkan sisa stok/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Tandai/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Buka kembali outlet/ })).toBeInTheDocument()
  })
})
