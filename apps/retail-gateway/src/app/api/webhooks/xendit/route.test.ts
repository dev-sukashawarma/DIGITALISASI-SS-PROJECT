import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import * as supabase from '@/lib/supabase'

vi.mock('@/lib/supabase')

const TOKEN = 'rahasia-uji'

function buildRetail(cfg: {
  draft: Record<string, unknown> | null
  lunasError?: unknown
  updateOrderDraftsMock?: ReturnType<typeof vi.fn>
}) {
  const lunasUpdateMock = vi.fn()
  const lunasEqMock = vi.fn()
  const lunasIsMock = vi.fn()
  const updateOrderDraftsMock = cfg.updateOrderDraftsMock ?? vi.fn()

  const from = vi.fn((table: string) => {
    if (table === 'order_drafts') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: cfg.draft, error: null })) })),
        })),
        update: vi.fn((payload: unknown) => {
          updateOrderDraftsMock(payload)
          return { eq: vi.fn(async () => ({ error: null })) }
        }),
      }
    }
    if (table === 'voucher_pemakaian') {
      return {
        update: vi.fn((payload: unknown) => {
          lunasUpdateMock(payload)
          const chain: any = {}
          chain.eq = vi.fn((...args: unknown[]) => {
            lunasEqMock(...args)
            return chain
          })
          chain.is = vi.fn((...args: unknown[]) => {
            lunasIsMock(...args)
            return Promise.resolve({ error: cfg.lunasError ?? null })
          })
          return chain
        }),
      }
    }
    throw new Error(`tabel tak diduga dalam uji: ${table}`)
  })

  return { from, lunasUpdateMock, lunasEqMock, lunasIsMock, updateOrderDraftsMock }
}

const req = (body: unknown, token: string | null = TOKEN) =>
  new Request('https://x/api/webhooks/xendit', {
    method: 'POST',
    headers: token ? { 'x-callback-token': token } : undefined,
    body: JSON.stringify(body),
  })

describe('POST /api/webhooks/xendit -- voucher lunas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.XENDIT_WEBHOOK_TOKEN = TOKEN
  })

  it('peristiwa lunas -> voucher_pemakaian ditandai lunas, juga pada webhook kembar (pos_order_id sudah ada)', async () => {
    const draft = {
      id: 'draft-1', client_order_id: 'cli-1', customer_id: 'c1', outlet_id: 'o1',
      items: [], subtotal: 30000, discount_amount: 0, total_amount: 30000,
      status: 'dibayar', pos_order_id: 'pos-99',
    }
    const retail = buildRetail({ draft })
    vi.mocked(supabase.createRetailClient).mockReturnValue(retail as any)

    const res = await POST(req({ external_id: 'cli-1', status: 'PAID' }))
    const body = await res.json()

    expect(body).toEqual({ ok: true, duplicate: true })
    expect(retail.lunasUpdateMock).toHaveBeenCalledTimes(1)
    expect(retail.lunasUpdateMock.mock.calls[0][0]).toHaveProperty('lunas_at')
    expect(retail.lunasEqMock).toHaveBeenCalledWith('draft_id', 'draft-1')
    expect(retail.lunasIsMock).toHaveBeenCalledWith('lunas_at', null)

    // Kontrol negatif (dijalankan manual & dikembalikan -- lihat task-5-report.md):
    // menghapus argumen `.is('lunas_at', null)` di route membuat asersi
    // `toHaveBeenCalledWith('lunas_at', null)` di atas gagal seperti diharapkan.
  })

  it('peristiwa gagal -> voucher_pemakaian TIDAK ditandai lunas', async () => {
    const draft = {
      id: 'draft-2', client_order_id: 'cli-2', customer_id: 'c1', outlet_id: 'o1',
      items: [], subtotal: 30000, discount_amount: 0, total_amount: 30000,
      status: 'menunggu_bayar', pos_order_id: null,
    }
    const retail = buildRetail({ draft })
    vi.mocked(supabase.createRetailClient).mockReturnValue(retail as any)

    const res = await POST(req({ external_id: 'cli-2', status: 'EXPIRED' }))
    const body = await res.json()

    expect(body).toEqual({ ok: true })
    expect(retail.lunasUpdateMock).not.toHaveBeenCalled()
    expect(retail.updateOrderDraftsMock).toHaveBeenCalledWith({ status: 'gagal' })
  })
})
