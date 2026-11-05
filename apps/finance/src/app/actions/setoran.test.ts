import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/authz', () => ({ requireRole: vi.fn(async () => undefined) }))

const rows: Record<string, unknown> = {}
const updates: unknown[] = []
vi.mock('@/lib/supabase-service', () => ({
  getServiceSupabase: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: rows[table], error: null }) }),
      }),
      update: (v: unknown) => {
        updates.push(v)
        return { eq: async () => ({ error: null }) }
      },
    }),
  }),
}))

import { updateCashDepositMethodAction } from './setoran'

describe('updateCashDepositMethodAction', () => {
  beforeEach(() => {
    updates.length = 0
    rows.cash_transaction = { id: 't1', cash_location_id: 'lama', status: 'reconciled', source_type: 'cash_deposit' }
  })

  it('menolak pindah setoran ke lokasi Kas Office', async () => {
    rows.cash_location = { id: 'ko', label: 'Kas Office Tunai', kind: 'cash', scope: 'pusat', is_active: true, grup: 'office' }
    await expect(updateCashDepositMethodAction({ id: 't1', newLocationId: 'ko' }))
      .rejects.toThrow('Setoran harus ke Kas Setoran Outlet')
    expect(updates).toHaveLength(0)
  })

  it('mengizinkan pindah ke lokasi Kas Setoran Outlet', async () => {
    rows.cash_location = { id: 'rs', label: 'Rekening Setoran', kind: 'bank', scope: 'pusat', is_active: true, grup: 'setoran_outlet' }
    await expect(updateCashDepositMethodAction({ id: 't1', newLocationId: 'rs' }))
      .resolves.toEqual({ success: true, locationLabel: 'Rekening Setoran' })
  })
})
