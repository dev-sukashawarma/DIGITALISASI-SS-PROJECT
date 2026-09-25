import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import * as auth from '@/lib/auth'
import * as supabase from '@/lib/supabase'
import * as catalog from '@/lib/catalog'
import * as statusOutletDb from '@/lib/statusOutletDb'
import * as xendit from '@/lib/xendit'
import * as voucherDb from '@/lib/voucherDb'

vi.mock('@/lib/auth')
vi.mock('@/lib/supabase')
vi.mock('@/lib/catalog')
vi.mock('@/lib/statusOutletDb')
vi.mock('@/lib/xendit')
vi.mock('@/lib/voucherDb')

const MENU_A = { id: 'A', name: 'A', description: null, price: 30000, image_url: null, is_available: true, category_id: null, sort_order: null, category_name: null, category_sort_order: null }

const OUTLET = { id: 'o1', name: 'Outlet Uji', app_enabled: true, is_active: true, open_hour: '08:00', close_hour: '22:00' }

const STATUS_BUKA = { bisaPesan: true, alasan: 'buka' as const, bukaLagi: null, pesanTerakhir: null, alasanTutup: null }

/** Chain generik: tiap method mengembalikan diri sendiri, resmi berakhir di maybeSingle/then. */
function makeSelectChain(resp: { data: unknown; error: unknown }) {
  const chain: any = {}
  chain.eq = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => resp)
  return chain
}

function buildRetail(cfg: {
  existingDraft?: unknown
  insertResp?: { data: unknown; error: unknown }
  pelanggan?: unknown
  pakaiError?: unknown
  updateError?: unknown
} = {}) {
  const insertDraftMock = vi.fn()
  const pakaiInsertMock = vi.fn()
  const updateDraftMock = vi.fn()
  const updateCustomerMock = vi.fn()

  const from = vi.fn((table: string) => {
    if (table === 'order_drafts') {
      return {
        select: vi.fn(() => makeSelectChain({ data: cfg.existingDraft ?? null, error: null })),
        insert: vi.fn((payload: unknown) => {
          insertDraftMock(payload)
          return {
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => cfg.insertResp ?? { data: { id: 'draft-1' }, error: null }),
            })),
          }
        }),
        update: vi.fn((payload: unknown) => {
          updateDraftMock(payload)
          return { eq: vi.fn(async () => ({ error: cfg.updateError ?? null })) }
        }),
      }
    }
    if (table === 'customers') {
      return {
        select: vi.fn(() => makeSelectChain({ data: cfg.pelanggan ?? { name: 'Budi' }, error: null })),
        update: vi.fn((payload: unknown) => {
          updateCustomerMock(payload)
          return { eq: vi.fn(async () => ({ error: null })) }
        }),
      }
    }
    if (table === 'voucher_pemakaian') {
      return {
        insert: vi.fn(async (payload: unknown) => {
          pakaiInsertMock(payload)
          return { error: cfg.pakaiError ?? null }
        }),
      }
    }
    throw new Error(`tabel tak diduga dalam uji: ${table}`)
  })

  return { from, insertDraftMock, pakaiInsertMock, updateDraftMock, updateCustomerMock }
}

const req = (body: Record<string, unknown>) =>
  new Request('https://x/api/v1/orders', { method: 'POST', body: JSON.stringify(body) })

const BASE_BODY = { client_order_id: 'cli-1', outlet_id: 'o1', items: [{ menu_item_id: 'A', name: 'A', unit_price: 30000, quantity: 1 }] }

describe('POST /api/v1/orders -- voucher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth.requireCustomer).mockResolvedValue({ customerId: 'c1' } as any)
    vi.mocked(supabase.createServiceClient).mockReturnValue({
      from: vi.fn(() => ({ select: vi.fn(() => makeSelectChain({ data: OUTLET, error: null })) })),
    } as any)
    vi.mocked(catalog.ambilKatalog).mockResolvedValue([MENU_A] as any)
    vi.mocked(statusOutletDb.statusUntuk).mockResolvedValue(STATUS_BUKA as any)
    vi.mocked(xendit.buatQris).mockResolvedValue({ ref: 'ref-1', url: 'https://bayar/1', qrString: 'qr-1' } as any)
  })

  it('voucher tidak berlaku -> 409, tanpa insert draft, tanpa buatQris/buatTagihan', async () => {
    vi.mocked(voucherDb.nilaiVoucher).mockResolvedValue({
      ada: true, voucher: { id: 'v1', nama: 'Uji' } as any, hasil: { berlaku: false, alasan: 'Kuota voucher sudah habis' },
    })
    const retail = buildRetail()
    vi.mocked(supabase.createRetailClient).mockReturnValue(retail as any)

    const res = await POST(req({ ...BASE_BODY, voucher_id: 'v1' }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toEqual({ error: 'voucher_tidak_berlaku', pesan: 'Kuota voucher sudah habis' })

    expect(retail.insertDraftMock).not.toHaveBeenCalled()
    expect(xendit.buatQris).not.toHaveBeenCalled()
    expect(xendit.buatTagihan).not.toHaveBeenCalled()

    // Kontrol negatif: pastikan asersi status di atas benar-benar menjepit --
    // ubah status jadi 200 dan asersi status HARUS gagal (dibuktikan manual,
    // lihat catatan di task-5-report.md).
  })

  it('voucher berlaku -> item gratis & discount masuk draft, voucher_pemakaian tercatat SEBELUM buatQris', async () => {
    const itemGratis = { menu_item_id: 'M', name: 'M', unit_price: 10000, quantity: 1, note: 'Gratis voucher' }
    vi.mocked(voucherDb.nilaiVoucher).mockResolvedValue({
      ada: true, voucher: { id: 'v1', nama: 'Uji' } as any,
      hasil: { berlaku: true, potongan: 10000, itemGratis: [itemGratis] },
    })
    const retail = buildRetail()
    vi.mocked(supabase.createRetailClient).mockReturnValue(retail as any)

    const urutanPanggilan: string[] = []
    retail.pakaiInsertMock.mockImplementation(() => urutanPanggilan.push('voucher_pemakaian'))
    vi.mocked(xendit.buatQris).mockImplementation(async () => {
      urutanPanggilan.push('buatQris')
      return { ref: 'ref-1', url: 'https://bayar/1', qrString: 'qr-1' } as any
    })

    const res = await POST(req({ ...BASE_BODY, voucher_id: 'v1' }))
    expect(res.status).toBe(200)

    expect(retail.insertDraftMock).toHaveBeenCalledTimes(1)
    const payload = retail.insertDraftMock.mock.calls[0][0]
    expect(payload.items).toEqual([
      { menu_item_id: 'A', name: 'A', unit_price: 30000, quantity: 1, note: undefined },
      itemGratis,
    ])
    expect(payload.discount_amount).toBe(10000)
    expect(payload.subtotal).toBe(40000)
    expect(payload.total_amount).toBe(30000)

    expect(retail.pakaiInsertMock).toHaveBeenCalledWith({
      voucher_id: 'v1', draft_id: 'draft-1', customer_id: 'c1', potongan: 10000,
    })

    expect(urutanPanggilan).toEqual(['voucher_pemakaian', 'buatQris'])
  })

  it('tanpa field voucher -> perilaku lama: diskon 0, tanpa insert voucher_pemakaian', async () => {
    vi.mocked(voucherDb.nilaiVoucher).mockResolvedValue({ ada: false })
    const retail = buildRetail()
    vi.mocked(supabase.createRetailClient).mockReturnValue(retail as any)

    const res = await POST(req(BASE_BODY))
    expect(res.status).toBe(200)

    const payload = retail.insertDraftMock.mock.calls[0][0]
    expect(payload.discount_amount).toBe(0)
    expect(payload.total_amount).toBe(30000)
    expect(retail.pakaiInsertMock).not.toHaveBeenCalled()
  })

  it('item bercatatan "Gratis voucher" dari klien dibuang sebelum diproses', async () => {
    vi.mocked(voucherDb.nilaiVoucher).mockResolvedValue({ ada: false })
    const retail = buildRetail()
    vi.mocked(supabase.createRetailClient).mockReturnValue(retail as any)

    const itemGratisKlien = { menu_item_id: 'A', name: 'A palsu', unit_price: 0, quantity: 5, note: 'Gratis voucher' }
    const res = await POST(req({ ...BASE_BODY, items: [BASE_BODY.items[0], itemGratisKlien] }))
    expect(res.status).toBe(200)

    // nilaiVoucher dipanggil dengan items yang SUDAH disaring (tanpa item gratis klien).
    const argNv = vi.mocked(voucherDb.nilaiVoucher).mock.calls[0][0]
    expect(argNv.items).toEqual([{ menu_item_id: 'A', name: 'A', unit_price: 30000, quantity: 1, note: undefined }])

    const payload = retail.insertDraftMock.mock.calls[0][0]
    expect(payload.items).toEqual([{ menu_item_id: 'A', name: 'A', unit_price: 30000, quantity: 1, note: undefined }])
  })
})
