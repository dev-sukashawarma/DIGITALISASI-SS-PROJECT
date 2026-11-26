import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SetujuiPengeluaranPettyCashModal } from './SetujuiPengeluaranPettyCashModal'
import {
  useReviewPettyCashExpense,
  useUbahKategoriPettyCashExpense,
  type PendingPettyCashExpense,
} from '@/hooks/usePettyCashExpenseApproval'

vi.mock('@/hooks/usePettyCashExpenseApproval', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/usePettyCashExpenseApproval')>(
    '@/hooks/usePettyCashExpenseApproval',
  )
  return {
    ...actual,
    useReviewPettyCashExpense: vi.fn(),
    useUbahKategoriPettyCashExpense: vi.fn(),
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const baseExpense: PendingPettyCashExpense = {
  id: 'exp-1',
  outlet_id: 'out-1',
  category: 'pln',
  type: 'expense',
  amount: 45_000,
  description: 'Beli gas 3kg',
  expense_date: '2026-11-26',
  receipt_url: 'https://example.com/struk.webp',
  created_at: '2026-11-26T04:00:00Z',
  created_by: 'staff-1',
  status: 'pending',
  outlet_nama: 'SS Cibubur',
  pengaju_nama: 'Budi',
}

describe('SetujuiPengeluaranPettyCashModal', () => {
  const reviewMutateAsync = vi.fn()
  const ubahMutateAsync = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    reviewMutateAsync.mockResolvedValue({})
    ubahMutateAsync.mockResolvedValue({})
    vi.mocked(useReviewPettyCashExpense).mockReturnValue({
      mutateAsync: reviewMutateAsync,
      isPending: false,
    } as any)
    vi.mocked(useUbahKategoriPettyCashExpense).mockReturnValue({
      mutateAsync: ubahMutateAsync,
      isPending: false,
    } as any)
  })

  it('menyetujui langsung tanpa ubah kategori bila kategori tidak diubah', async () => {
    const onClose = vi.fn()
    render(
      <SetujuiPengeluaranPettyCashModal
        isOpen
        expense={baseExpense}
        onClose={onClose}
        onTolak={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Setujui Pengeluaran' }))
    })

    expect(ubahMutateAsync).not.toHaveBeenCalled()
    expect(reviewMutateAsync).toHaveBeenCalledWith({ expenseId: 'exp-1', action: 'approve' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('memanggil koreksi kategori sebelum approve saat Finance mengubah kategori', async () => {
    const onClose = vi.fn()
    render(
      <SetujuiPengeluaranPettyCashModal
        isOpen
        expense={baseExpense}
        onClose={onClose}
        onTolak={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText(/Kategori/), { target: { value: 'gas' } })
    expect(screen.getByRole('button', { name: 'Simpan Kategori & Setujui' })).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Simpan Kategori & Setujui' }))
    })

    expect(ubahMutateAsync).toHaveBeenCalledWith({ expenseId: 'exp-1', category: 'gas' })
    expect(reviewMutateAsync).toHaveBeenCalledWith({ expenseId: 'exp-1', action: 'approve' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('mengunci kategori menjadi read-only untuk pengeluaran RAB otomatis', () => {
    render(
      <SetujuiPengeluaranPettyCashModal
        isOpen
        expense={{ ...baseExpense, category: 'rab', type: 'rab' }}
        onClose={vi.fn()}
        onTolak={vi.fn()}
      />,
    )

    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('RAB (Otomatis)')).toBeInTheDocument()
  })
})
