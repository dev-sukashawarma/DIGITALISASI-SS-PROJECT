import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { KpiCards } from './KpiCards'
import type { SalesSummaryRow } from '@/lib/types'

const rows: SalesSummaryRow[] = [
  { outlet_id: 'a', outlet_name: 'A', sales_source: 'pos', sales_date: '2026-06-18', omzet: 100000, jumlah_order_completed: 4, jumlah_order_all: 5 },
  { outlet_id: 'b', outlet_name: 'B', sales_source: 'online', sales_date: '2026-06-18', omzet: 50000, jumlah_order_completed: 1, jumlah_order_all: 1 },
]

describe('KpiCards', () => {
  it('omzet total & AOV', () => {
    render(<KpiCards rows={rows} />)
    expect(screen.getByText('Rp 150.000')).toBeInTheDocument()   // omzet
    expect(screen.getByText('Rp 30.000')).toBeInTheDocument()    // AOV 150000/5
  })
})
