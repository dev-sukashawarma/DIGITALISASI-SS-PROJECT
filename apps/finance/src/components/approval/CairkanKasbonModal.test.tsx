import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { LocationWithBalance } from '@/lib/types'
import type { KasbonMenunggu } from '@/lib/approval/kasbon'
import { CairkanKasbonModal } from './CairkanKasbonModal'

const lok = (id: string, label: string, grup: LocationWithBalance['grup'], kind: 'bank' | 'cash', saldo: number): LocationWithBalance => ({
  id, label, grup, kind, saldo, bank_name: null, account_no: null, holder_name: null, scope: 'pusat' as LocationWithBalance['scope'],
  outlet_id: null, is_active: true, opening_balance: 0, opening_date: '2026-11-01', created_at: '2026-11-01',
})

const locations = [
  lok('bb-bank', 'Rekening Bahan Baku 0955353124', 'bahan_baku', 'bank', 10_000_000),
  lok('pc-bank', 'Rekening Petty Cash 0955381004', 'petty_cash', 'bank', 5_000_000),
  lok('pc-tunai', 'Rekening Petty Cash Tunai', 'petty_cash', 'cash', 100_000),
]

const kasbon: KasbonMenunggu = {
  id: 'k1', staff_id: 's1', staff_nama: 'Budi', outlet_nama: 'EMPANG', amount: 500000, amount_requested: 500000,
  reason: 'berobat', installment_months: 1, approval_note: null, approved_at: '2026-11-13T03:00:00Z',
  approved_by: 'hr1', penyetuju_nama: 'Admin HR', created_at: '2026-11-12T03:00:00Z',
}

function tampil(userId: string | null, onCairkan = vi.fn(async () => {})) {
  const r = render(
    <CairkanKasbonModal isOpen kasbon={kasbon} locations={locations} userId={userId} onClose={() => {}} onCairkan={onCairkan} />,
  )
  return { ...r, onCairkan }
}

describe('CairkanKasbonModal', () => {
  it('hanya menawarkan Rekening Petty Cash, nominal tidak bisa diubah', () => {
    tampil('fin1')
    const pilihan = screen.getAllByRole('option').map((o) => o.textContent)
    expect(pilihan.some((t) => t?.includes('Bahan Baku'))).toBe(false)
    expect(pilihan.some((t) => t?.includes('Petty Cash 0955381004'))).toBe(true)
    expect(pilihan.some((t) => t?.includes('Petty Cash Tunai'))).toBe(true)
    expect(screen.getByText('Rp 500.000')).toBeTruthy()
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  it('tombol Cairkan terkunci sampai rekening & bukti dipilih, lalu memanggil onCairkan', () => {
    const { container, onCairkan } = tampil('fin1')
    const tombol = screen.getByRole('button', { name: 'Cairkan' }) as HTMLButtonElement
    expect(tombol.disabled).toBe(true)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pc-bank' } })
    expect(tombol.disabled).toBe(true)
    const file = new File(['x'], 'bukti.jpg', { type: 'image/jpeg' })
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } })
    expect(tombol.disabled).toBe(false)
    fireEvent.click(tombol)
    expect(onCairkan).toHaveBeenCalledWith('pc-bank', file)
  })

  it('label bukti mengikuti jenis rekening', () => {
    tampil('fin1')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pc-tunai' } })
    expect(screen.getByText(/Foto tanda terima bertanda tangan karyawan/)).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pc-bank' } })
    expect(screen.getByText(/Bukti transfer/)).toBeTruthy()
  })

  it('penyetuju HR tidak bisa mencairkan sendiri', () => {
    const { container } = tampil('hr1')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pc-bank' } })
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['x'], 'b.jpg', { type: 'image/jpeg' })] },
    })
    expect((screen.getByRole('button', { name: 'Cairkan' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Anda menyetujui kasbon ini di HR, pencairan harus oleh orang lain')).toBeTruthy()
  })
})
