import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { PendingPo } from '@/hooks/usePoApproval'

const mutateMock = vi.fn()
vi.mock('@/hooks/usePoApproval', () => ({
  useApprovePo: () => ({
    isPending: false,
    mutate: mutateMock,
  }),
}))

vi.mock('@/hooks/useCashData', () => ({
  useCashOverview: () => ({
    locations: [
      {
        id: 'loc-bb-bank',
        label: 'Rekening Bahan Baku 0955353124',
        grup: 'bahan_baku',
        kind: 'bank',
        saldo: 15_000_000,
        is_active: true,
      },
      {
        id: 'loc-utama-bank',
        label: 'Rekening Utama 0955193763',
        grup: 'utama',
        kind: 'bank',
        saldo: 25_000_000,
        is_active: true,
      },
      {
        id: 'loc-pc-bank',
        label: 'Rekening Petty Cash 0955381004',
        grup: 'petty_cash',
        kind: 'bank',
        saldo: 5_000_000,
        is_active: true,
      },
    ],
    isLoading: false,
    error: null,
  }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { SetujuiPoModal } from './SetujuiPoModal'

const mockPo: PendingPo = {
  id: 'po-test-123',
  nomor_po: 'PO/KITCHEN/20261107/0001',
  supplier_nama: 'Indoboga Utama',
  tanggal_po: '2026-11-07',
  total: 5_000_000,
}

describe('SetujuiPoModal', () => {
  it('menampilkan detail PO dan daftar rekening pusat', () => {
    render(<SetujuiPoModal isOpen po={mockPo} onClose={() => {}} />)

    expect(screen.getByText('Setujui Purchase Order')).toBeInTheDocument()
    expect(screen.getByText('PO/KITCHEN/20261107/0001')).toBeInTheDocument()
    expect(screen.getByText(/Indoboga Utama/)).toBeInTheDocument()
    expect(screen.getByText('Pilih Rekening Pembayar')).toBeInTheDocument()

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('loc-bb-bank')
    expect(screen.getAllByText(/Rekening Bahan Baku 0955353124/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Rekening Utama 0955193763/)).toBeInTheDocument()
  })

  it('mengirim cashLocationId saat tombol Setujui PO diklik', () => {
    mutateMock.mockReset()
    render(<SetujuiPoModal isOpen po={mockPo} onClose={() => {}} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'loc-utama-bank' } })

    fireEvent.click(screen.getByRole('button', { name: 'Setujui PO' }))

    expect(mutateMock).toHaveBeenCalledTimes(1)
    expect(mutateMock).toHaveBeenCalledWith(
      {
        poId: 'po-test-123',
        cashLocationId: 'loc-utama-bank',
      },
      expect.any(Object),
    )
  })

  it('memanggil onGagal saat RPC menolak', () => {
    mutateMock.mockImplementation((_v, opts) => opts.onError?.(new Error('PO sudah disetujui di tab lain')))
    const onGagal = vi.fn()
    render(<SetujuiPoModal isOpen po={mockPo} onClose={() => {}} onGagal={onGagal} />)

    fireEvent.click(screen.getByRole('button', { name: 'Setujui PO' }))

    expect(onGagal).toHaveBeenCalledTimes(1)
  })
})
