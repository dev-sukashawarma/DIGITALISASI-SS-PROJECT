import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { PayablePo } from '@/hooks/useSupplierSettlement'

// Tiru kegagalan RPC setujui_bayar_po (mis. sudah diputuskan di tab lain).
vi.mock('@/hooks/useSupplierSettlement', () => ({
  useSetujuiBayarPo: () => ({
    isPending: false,
    mutate: (_v: unknown, opts: { onError?: (e: Error) => void }) => opts.onError?.(new Error('Pembayaran sudah diproses')),
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

describe('SetujuiBayarVendorModal', () => {
  it('memanggil onGagal saat RPC menolak agar daftar disegarkan', () => {
    const onGagal = vi.fn()
    const { container } = render(
      <SetujuiBayarVendorModal po={po} rekeningLabel="Rekening Bahan Baku Bank" saldo={10_000_000} onClose={() => {}} onGagal={onGagal} />,
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'bukti.png', { type: 'image/png' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Setujui & Tandai Lunas' }))
    expect(onGagal).toHaveBeenCalledTimes(1)
  })
})
