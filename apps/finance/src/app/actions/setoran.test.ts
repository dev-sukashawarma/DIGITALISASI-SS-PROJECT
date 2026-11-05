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

  it('menolak pindah setoran ke Rekening Petty Cash', async () => {
    rows.cash_location = { id: 'pc', label: 'Rekening Petty Cash Tunai', kind: 'cash', scope: 'pusat', is_active: true, grup: 'petty_cash' }
    await expect(updateCashDepositMethodAction({ id: 't1', newLocationId: 'pc' }))
      .rejects.toThrow('Setoran transfer harus ke Rekening Utama, setoran tunai ke Rekening Bahan Baku Tunai')
    expect(updates).toHaveLength(0)
  })

  it('menolak setoran transfer ke Rekening Bahan Baku Bank', async () => {
    rows.cash_location = { id: 'bb', label: 'Rekening Bahan Baku', kind: 'bank', scope: 'pusat', is_active: true, grup: 'bahan_baku' }
    await expect(updateCashDepositMethodAction({ id: 't1', newLocationId: 'bb' })).rejects.toThrow('Rekening Utama')
  })

  it('mengizinkan transfer ke Rekening Utama dan tunai ke Bahan Baku Tunai', async () => {
    rows.cash_location = { id: 'ut', label: 'Rekening Utama', kind: 'bank', scope: 'pusat', is_active: true, grup: 'utama' }
    await expect(updateCashDepositMethodAction({ id: 't1', newLocationId: 'ut' }))
      .resolves.toEqual({ success: true, locationLabel: 'Rekening Utama' })
    rows.cash_location = { id: 'bt', label: 'Rekening Bahan Baku Tunai', kind: 'cash', scope: 'pusat', is_active: true, grup: 'bahan_baku' }
    await expect(updateCashDepositMethodAction({ id: 't1', newLocationId: 'bt' }))
      .resolves.toEqual({ success: true, locationLabel: 'Rekening Bahan Baku Tunai' })
  })
})
