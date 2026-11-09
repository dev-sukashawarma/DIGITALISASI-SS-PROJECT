import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { PayablePo } from '@/hooks/useSupplierSettlement'
import type { LocationWithBalance } from '@/lib/types'

// Tiru RPC setujui_bayar_po: simpan argumen, lalu gagal (mis. sudah diputuskan di tab lain).
const panggilan: unknown[] = []
vi.mock('@/hooks/useSupplierSettlement', () => ({
  useSetujuiBayarPo: () => ({
    isPending: false,
    mutate: (v: unknown, opts: { onError?: (e: Error) => void }) => {
      panggilan.push(v)
      opts.onError?.(new Error('Pembayaran sudah diproses'))
    },
  }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { SetujuiBayarVendorModal } from './SetujuiBayarVendorModal'

const po: PayablePo = {
  id: 'po1',
  nomor_po: 'SPB/PO/XI/2026/004',
  supplier_id: 's1',
  supplier_nama: 'Lettuce (Pak Aziz) - Tempo 15',
  tanggal_po: '2026-11-01',
  status: 'diterima_lengkap',
  payment_status: 'pending',
  paid_at: null,
  cash_transaction_id: null,
  total: 4250000,
}

const lok = (id: string, label: string, grup: LocationWithBalance['grup'], kind: 'bank' | 'cash', saldo: number): LocationWithBalance => ({
  id, label, grup, kind, saldo, bank_name: null, account_no: null, holder_name: null, scope: 'pusat' as LocationWithBalance['scope'],
  outlet_id: null, is_active: true, opening_balance: 0, opening_date: '2026-11-01', created_at: '2026-11-01',
})

const locations = [
  lok('bb-bank', 'Rekening Bahan Baku 0955353124', 'bahan_baku', 'bank', 10_000_000),
  lok('pc-bank', 'Rekening Petty Cash 0955381004', 'petty_cash', 'bank', 5_000_000),
  lok('pc-tunai', 'Rekening Petty Cash Tunai', 'petty_cash', 'cash', 100_000),
]

function unggahBukti(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File(['x'], 'bukti.png', { type: 'image/png' })] } })
}

describe('SetujuiBayarVendorModal', () => {
  beforeEach(() => { panggilan.length = 0 })

  it('memanggil onGagal saat RPC menolak agar daftar disegarkan', () => {
    const onGagal = vi.fn()
    const { container } = render(<SetujuiBayarVendorModal po={po} locations={locations} onClose={() => {}} onGagal={onGagal} />)
    unggahBukti(container)
    fireEvent.click(screen.getByRole('button', { name: 'Setujui & Tandai Lunas' }))
    expect(onGagal).toHaveBeenCalledTimes(1)
  })

  it('bawaan Rekening Bahan Baku Bank, bisa diganti, rekening terpilih dikirim', () => {
    const { container } = render(<SetujuiBayarVendorModal po={po} locations={locations} onClose={() => {}} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('bb-bank')
    fireEvent.change(select, { target: { value: 'pc-bank' } })
    unggahBukti(container)
    fireEvent.click(screen.getByRole('button', { name: 'Setujui & Tandai Lunas' }))
    expect(panggilan[0]).toMatchObject({ poId: 'po1', cashLocationId: 'pc-bank' })
  })

  it('bawaan mengikuti rekening pilihan saat Approval PO', () => {
    render(<SetujuiBayarVendorModal po={{ ...po, cash_location_id: 'pc-bank' }} locations={locations} onClose={() => {}} />)
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('pc-bank')
  })

  it('rekening tunai yang saldonya kurang mengunci tombol', () => {
    const { container } = render(<SetujuiBayarVendorModal po={po} locations={locations} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pc-tunai' } })
    unggahBukti(container)
    expect(screen.getByText(/tidak mencukupi/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Setujui & Tandai Lunas' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
