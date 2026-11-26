import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCashOverview } from '@/hooks/useCashData'
import type { LocationWithBalance, PettyCashTopup } from '@/lib/types'
import { FinanceApprovalModal } from './FinanceApprovalModal'

vi.mock('@/hooks/useCashData', () => ({ useCashOverview: vi.fn() }))

URL.createObjectURL = vi.fn(() => 'blob:bukti')
URL.revokeObjectURL = vi.fn()

beforeEach(() => {
  // Jam pencairan dibatasi sebelum pukul 16:00 WIB pada hari pengajuan (2026-11-05 10:00 WIB)
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-05T03:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

function lampirkanBukti() {
  const input = document.getElementById('proof-photo-upload') as HTMLInputElement
  const file = new File(['x'], 'bukti.jpg', { type: 'image/jpeg' })
  fireEvent.change(input, { target: { files: [file] } })
  return file
}

const request = {
  id: 'request',
  amount: 100_000,
  created_at: '2026-11-05T00:00:00Z',
} as PettyCashTopup

function showModal(locations: Array<Pick<LocationWithBalance, 'id' | 'label' | 'grup' | 'kind' | 'is_active' | 'saldo'>>) {
  vi.mocked(useCashOverview).mockReturnValue({
    locations: locations as LocationWithBalance[],
    isLoading: false,
    error: null,
  })
  const onApprove = vi.fn().mockResolvedValue(undefined)
  const onReject = vi.fn().mockResolvedValue(undefined)
  render(<FinanceApprovalModal isOpen request={request} onClose={vi.fn()} onApprove={onApprove} onReject={onReject} />)
  return { onApprove, onReject }
}

it('mewajibkan sumber Office sesuai metode dan mengirim lokasi yang ditampilkan', async () => {
  const { onApprove } = showModal([
    { id: 'setoran', label: 'Rekening Utama', grup: 'utama', kind: 'bank', is_active: true, saldo: 1_000_000 },
    { id: 'bank', label: 'Rekening Petty Cash', grup: 'petty_cash', kind: 'bank', is_active: true, saldo: 90_000 },
    { id: 'tunai', label: 'Rekening Petty Cash Tunai', grup: 'petty_cash', kind: 'cash', is_active: true, saldo: 100_000 },
  ])
  const cairkan = screen.getByRole('button', { name: 'Acc & Cairkan' })
  expect(cairkan).toBeDisabled()
  expect(screen.getByText(/Saldo Rekening Petty Cash tidak mencukupi/)).toBeVisible()

  fireEvent.click(screen.getByRole('radio', { name: /Beri Tunai/ }))
  const bukti = lampirkanBukti()
  expect(cairkan).toBeEnabled()
  await act(async () => { fireEvent.click(cairkan) })
  expect(onApprove).toHaveBeenCalledWith('tunai', 'tunai', bukti, 100_000, '')
})

it('memblokir pencairan tanpa lokasi Office aktif dan tetap mengizinkan penolakan', async () => {
  const { onApprove, onReject } = showModal([
    { id: 'lama', label: 'Rekening lama', grup: 'petty_cash', kind: 'bank', is_active: false, saldo: 1_000_000 },
  ])
  const cairkan = screen.getByRole('button', { name: 'Acc & Cairkan' })
  expect(cairkan).toBeDisabled()
  fireEvent.click(cairkan)
  expect(onApprove).not.toHaveBeenCalled()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tolak' })) })
  expect(onReject).toHaveBeenCalledOnce()
})

const lokasiCukup = [
  { id: 'bank', label: 'Rekening Petty Cash', grup: 'petty_cash', kind: 'bank', is_active: true, saldo: 1_000_000 },
  { id: 'tunai', label: 'Rekening Petty Cash Tunai', grup: 'petty_cash', kind: 'cash', is_active: true, saldo: 1_000_000 },
] as const

it('tombol cairkan terkunci sampai bukti transfer dilampirkan', () => {
  showModal([...lokasiCukup])
  const cairkan = screen.getByRole('button', { name: 'Acc & Cairkan' })
  expect(cairkan).toBeDisabled()
  expect(screen.getByText('Bukti transfer (wajib)')).toBeVisible()
  lampirkanBukti()
  expect(cairkan).toBeEnabled()
})

it('bukti tetap terkirim untuk metode tunai', async () => {
  const { onApprove } = showModal([...lokasiCukup])
  const bukti = lampirkanBukti()
  fireEvent.click(screen.getByRole('radio', { name: /Beri Tunai/ }))
  expect(screen.getByText('Foto bukti serah uang (wajib)')).toBeVisible()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Acc & Cairkan' })) })
  expect(onApprove).toHaveBeenCalledWith('tunai', 'tunai', bukti, 100_000, '')
})
