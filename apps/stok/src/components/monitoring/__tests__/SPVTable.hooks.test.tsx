import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SPVTable } from '../SPVTable'
import { CrewList } from '../CrewList'
import type { MonitoringItem } from '@/lib/types/monitoring'

const item: MonitoringItem = {
  outlet_id: 'o1',
  outlet_name: 'OUTLET A',
  bahan_baku_id: 'b1',
  item_name: 'Ayam',
  current_qty: 2,
  threshold: 10,
  satuan: 'kg',
  status: 'below',
  is_flagged: false,
  last_opname_date: null,
} as MonitoringItem

// Regresi React #310: loading flip true→false tidak boleh mengubah jumlah hook.
describe('hook-count stability (React #310 regression)', () => {
  it('SPVTable: re-render loading true→false tanpa error hooks', () => {
    const { rerender } = render(
      <SPVTable items={[]} tab="overview" onRowClick={vi.fn()} loading={true} />
    )
    expect(() =>
      rerender(
        <SPVTable items={[item]} tab="overview" selectedOutletId="o1" onRowClick={vi.fn()} loading={false} />
      )
    ).not.toThrow()
  })

  it('CrewList: re-render loading true→false tanpa error hooks', () => {
    const { rerender } = render(<CrewList items={[]} onItemClick={vi.fn()} loading={true} />)
    expect(() =>
      rerender(<CrewList items={[item]} onItemClick={vi.fn()} loading={false} />)
    ).not.toThrow()
  })
})
