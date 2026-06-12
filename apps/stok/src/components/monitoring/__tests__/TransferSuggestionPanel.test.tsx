import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TransferSuggestionPanel } from '../TransferSuggestionPanel'
import type { MonitoringItem } from '@/lib/types/monitoring'

function makeItem(overrides: Partial<MonitoringItem>): MonitoringItem {
  return {
    outlet_id: 'o1',
    outlet_name: 'Outlet 1',
    bahan_baku_id: 'b1',
    item_name: 'Daging',
    satuan: 'kg',
    kategori: 'protein',
    current_qty: 10,
    threshold: 10,
    status: 'ok',
    is_flagged: false,
    last_updated: '2026-06-12T00:00:00Z',
    last_opname_date: null,
    ...overrides,
  }
}

describe('TransferSuggestionPanel', () => {
  it('shows empty state when there are no suggestions', () => {
    render(<TransferSuggestionPanel items={[]} onTransfer={vi.fn()} />)
    expect(screen.getByText(/stok seimbang/i)).toBeInTheDocument()
  })

  it('renders a card with donor, recipient, qty and item', () => {
    const items = [
      makeItem({ outlet_id: 'a', outlet_name: 'EMPANG', current_qty: 2, threshold: 10, status: 'below' }),
      makeItem({ outlet_id: 'b', outlet_name: 'KITCHEN', current_qty: 30, threshold: 10, status: 'ok' }),
    ]
    render(<TransferSuggestionPanel items={items} onTransfer={vi.fn()} />)
    expect(screen.getByText(/KITCHEN/)).toBeInTheDocument()
    expect(screen.getByText(/EMPANG/)).toBeInTheDocument()
    expect(screen.getByText(/8\s*kg/)).toBeInTheDocument()
  })

  it('calls onTransfer with the suggestion when the button is clicked', () => {
    const onTransfer = vi.fn()
    const items = [
      makeItem({ outlet_id: 'a', outlet_name: 'EMPANG', current_qty: 2, threshold: 10, status: 'below' }),
      makeItem({ outlet_id: 'b', outlet_name: 'KITCHEN', current_qty: 30, threshold: 10, status: 'ok' }),
    ]
    render(<TransferSuggestionPanel items={items} onTransfer={onTransfer} />)
    fireEvent.click(screen.getByRole('button', { name: /transfer/i }))
    expect(onTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ donorOutletId: 'b', recipientOutletId: 'a', qty: 8 })
    )
  })
})
