import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VerifikasiForm } from './VerifikasiForm'

const mock = vi.hoisted(() => ({
  qty: 10,
  data: {
    id: 'sj', status: 'dikirim', receipt_signatures: [], surat_jalan_item: [{
      id: 'i', bahan_baku_id: 'b', qty_dikirim: 10,
      bahan_baku: { id: 'b', nama: 'SAPI', satuan: 'Blok', satuan_distribusi: 'Blok' },
    }],
  },
  rpc: vi.fn(), update: vi.fn(), push: vi.fn(), error: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mock.push }) }))
vi.mock('next/link', () => ({ default: ({ children }: any) => <span>{children}</span> }))
vi.mock('sonner', () => ({ toast: { error: mock.error, warning: vi.fn(), info: vi.fn(), success: vi.fn() } }))
vi.mock('@/hooks/useSuratJalanDetail', () => ({ useSuratJalanDetail: () => {
  mock.data.surat_jalan_item[0].qty_dikirim = mock.qty
  return { loading: false, error: null, data: mock.data }
} }))
vi.mock('@suka/auth', () => ({ createSupabaseBrowserClient: () => ({
  from: () => ({ update: mock.update }), rpc: mock.rpc,
  storage: { from: () => ({ download: async () => ({ data: new Blob(['photo']) }) }) },
}) }))
vi.mock('./ReceiptSignatureStep', () => ({ ReceiptSignatureStep: ({ onFinalize }: any) => (
  <button onClick={onFinalize}>Finalisasi fixture</button>
) }))

beforeEach(() => {
  vi.clearAllMocks()
  mock.qty = 10
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('unlocked_verification_sj', 'true')
  URL.createObjectURL = vi.fn(() => 'blob:fixture')
  mock.update.mockReturnValue({ eq: async () => ({ error: null }) })
  mock.rpc.mockResolvedValue({ data: { success: true }, error: null })
})
afterEach(cleanup)

function draft(qty: number, step = 'cards') {
  localStorage.setItem('verification_draft_sj', JSON.stringify({
    verifications: { i: { qty_terima: qty, kondisi: 'baik', catatan: '', foto_path: 'sj/i.jpg' } },
    currentIndex: 0, step, kondisiConfirmed: true, updatedAt: Date.now(),
  }))
}

it('edit qty setelah konfirmasi mengharuskan konfirmasi ulang', async () => {
  draft(10)
  await act(async () => { render(<VerifikasiForm id="sj" />) })
  await screen.findByRole('button', { name: /Lihat Ringkasan Akhir/i })
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '11' } })
  expect(screen.queryByRole('button', { name: /Lihat Ringkasan Akhir/i })).not.toBeInTheDocument()
  expect(mock.update).not.toHaveBeenCalled()
})

it('Sesuai mempertahankan kiriman 0,91 Blok', async () => {
  mock.qty = 0.91
  draft(0.91)
  await act(async () => { render(<VerifikasiForm id="sj" />) })
  await screen.findByRole('spinbutton')
  fireEvent.click(screen.getByTitle('Sesuai dengan Qty Kirim'))
  await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue(0.91))
})

it('draft di langkah tanda tangan tetap ditolak jika qty melebihi kiriman', async () => {
  draft(11, 'signature')
  await act(async () => { render(<VerifikasiForm id="sj" />) })
  fireEvent.click(await screen.findByRole('button', { name: 'Finalisasi fixture' }))
  expect(mock.error).toHaveBeenCalled()
  expect(mock.update).not.toHaveBeenCalled()
  expect(mock.rpc).not.toHaveBeenCalled()
})

it('payload final penerimaan pecahan tidak dibulatkan menjadi satu', async () => {
  mock.qty = 0.91
  draft(0.91, 'signature')
  await act(async () => { render(<VerifikasiForm id="sj" />) })
  fireEvent.click(await screen.findByRole('button', { name: 'Finalisasi fixture' }))
  await waitFor(() => expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ qty_terima: 0.91, flagged: false })))
  await waitFor(() => expect(mock.rpc).toHaveBeenCalled())
})
