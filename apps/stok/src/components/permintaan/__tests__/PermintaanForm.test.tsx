import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PermintaanForm } from '../PermintaanForm'

vi.mock('@/hooks/usePermintaan', () => ({
  useSaranItem: () => ({
    saran: [{ bahan_baku_id: 'b1', item_name: 'Daging', satuan: 'kg', current_qty: 2, threshold: 10 }],
    loading: false,
  }),
  usePermintaanActions: () => ({ buat: vi.fn(), approve: vi.fn(), tolak: vi.fn() }),
}))
vi.mock('@/hooks/useBahanBaku', () => ({ useBahanBaku: () => ({ bahanBaku: [] }) }))

describe('PermintaanForm', () => {
  it('menampilkan item saran di bawah threshold', () => {
    render(<PermintaanForm outletId="o1" />)
    expect(screen.getByText(/Daging/)).toBeInTheDocument()
  })
})
