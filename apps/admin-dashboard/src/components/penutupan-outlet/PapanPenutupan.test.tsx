import { describe, it, expect, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/app/dashboard/penutupan-outlet/actions', () => ({
  bukaKembaliOutlet: vi.fn(),
  centangLangkah: vi.fn(),
  koreksiTanggalTutup: vi.fn(),
  nolkanSisaStok: vi.fn(),
  tandaiPenutupanSelesai: vi.fn(),
}))

import { render, screen } from '@testing-library/react'
import { PapanPenutupan } from './PapanPenutupan'
import type { StatusPenutupan } from '@/lib/penutupanOutlet/types'

function status(alasanTutup: string | null): StatusPenutupan {
  return {
    outletId: 'o1',
    nama: 'MITRA LAMA',
    jenis: 'mitra',
    status: 'inactive',
    nonaktifAt: '2026-08-13',
    alasanTutup,
    penutupanSelesaiAt: null,
    siapSelesai: false,
    langkah: [
      { kunci: 'stok', label: 'Sisa stok dikosongkan', penanggungJawab: 'Admin', wajib: true, selesai: false, info: '3 bahan, Rp 10.000', manual: false, dicentangOleh: null, dicentangAt: null },
      { kunci: 'aset', label: 'Aset dipindah', penanggungJawab: 'AM', wajib: false, selesai: false, info: null, manual: true, dicentangOleh: null, dicentangAt: null },
    ],
  }
}

describe('PapanPenutupan', () => {
  it('outlet yang ditutup lewat wizard: centang, Nolkan, dan Tandai selesai tersedia', () => {
    render(<PapanPenutupan status={status('Lokasi diambil alih')} bolehTulis bolehCentang />)
    expect(screen.getByRole('checkbox', { name: /Aset dipindah/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nolkan sisa stok/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tandai/ })).toBeInTheDocument()
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
