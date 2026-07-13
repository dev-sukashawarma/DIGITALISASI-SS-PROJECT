import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PermintaanForm } from '../PermintaanForm'

vi.mock('@/hooks/usePermintaan', () => ({
  useSaranItem: () => ({
    saran: [{ bahan_baku_id: 'b1', item_name: 'Daging', satuan: 'kg', current_qty: 2, threshold: 10 }],
    loading: false,
  }),
  usePermintaanActions: () => ({ buat: vi.fn(), approve: vi.fn(), tolak: vi.fn() }),
  usePermintaanList: () => ({ permintaan: [], loading: false, error: null, refresh: vi.fn() }),
}))
vi.mock('@/hooks/useBahanBaku', () => ({
  useBahanBaku: () => ({ bahanBaku: [{ id: 'b1', nama: 'Daging', satuan: 'kg' }] }),
}))
// PermintaanForm juga menarik daftar menu resep (tab "Target Menu") — mock supaya
// test tidak bergantung pada Supabase asli.
vi.mock('@/app/actions/permintaan_target', () => ({
  fetchActiveResep: vi.fn().mockResolvedValue([]),
  calculateBahanBakuRequest: vi.fn(),
}))

describe('PermintaanForm', () => {
  it('menampilkan item saran di bawah threshold', () => {
    render(<PermintaanForm outletId="o1" />)
    // Item kritis/saran ditambahkan otomatis ke section "Tambah Manual", bukan
    // ditampilkan langsung di tab default "Target Menu" — pindah tab dulu.
    fireEvent.click(screen.getByText('📦 Tambah Manual'))
    // Exact match: "Daging" juga muncul sebagai "Daging (kg)" di dropdown picker.
    expect(screen.getByText('Daging')).toBeInTheDocument()
  })
})
