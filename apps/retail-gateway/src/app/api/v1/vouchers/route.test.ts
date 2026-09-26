import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import * as auth from '@/lib/auth'
import * as supabase from '@/lib/supabase'
import * as voucherDb from '@/lib/voucherDb'

vi.mock('@/lib/auth')
vi.mock('@/lib/supabase')
vi.mock('@/lib/catalog', () => ({ ambilKatalog: vi.fn(async () => []) }))
vi.mock('@/lib/voucherDb', async (asli) => ({ ...(await asli<typeof voucherDb>()), konteksPelanggan: vi.fn() }))

const baris = (x: Record<string, unknown>) => ({
  id: 'v', nama: 'V', deskripsi: null, kode: null, jenis: 'nominal', nilai: 5000, maks_potongan: null, menu_item_id: null,
  beli_qty: null, gratis_qty: null, harga_spesial: null, mulai: null, selesai: null, kuota_total: null,
  batas_per_pelanggan: null, min_belanja: null, khusus_pesanan_pertama: false, outlet_ids: null, hari: null,
  jam_mulai: null, jam_selesai: null, menu_ids: null, kategori_ids: null, is_active: true, ...x,
})

function retailDengan(data: unknown[], error: unknown = null) {
  const r: any = {}
  for (const f of ['select', 'is', 'eq', 'or', 'order']) r[f] = vi.fn((...args: unknown[]) => r)
  r.then = (ok: (x: unknown) => unknown) => Promise.resolve({ data, error }).then(ok)
  const fromFn = vi.fn(() => r)
  return { from: fromFn, _chain: r, _from: fromFn } as any
}
const req = (body?: unknown) => new Request('https://x/api/v1/vouchers', { method: 'POST', body: body ? JSON.stringify(body) : undefined })

describe('POST /api/v1/vouchers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(voucherDb.konteksPelanggan).mockResolvedValue({ jumlahLunasTotal: 0, jumlahLunasPelanggan: 0, pelangganSudahPernahBayar: false })
    vi.mocked(supabase.createServiceClient).mockReturnValue({ from: vi.fn(() => ({ select: vi.fn(() => ({ in: vi.fn(async () => ({ data: [], error: null })) })) })) } as any)
  })
  it('401 tanpa sesi', async () => {
    vi.mocked(auth.requireCustomer).mockResolvedValue(null)
    expect((await POST(req())).status).toBe(401)
  })
  it('berlaku didahulukan, alasan ikut', async () => {
    vi.mocked(auth.requireCustomer).mockResolvedValue({ customerId: 'c1' })
    vi.mocked(voucherDb.konteksPelanggan)
      .mockResolvedValueOnce({ jumlahLunasTotal: 0, jumlahLunasPelanggan: 1, pelangganSudahPernahBayar: true })
      .mockResolvedValueOnce({ jumlahLunasTotal: 0, jumlahLunasPelanggan: 0, pelangganSudahPernahBayar: true })
    const retail = retailDengan([
      baris({ id: 'habis', batas_per_pelanggan: 1 }), baris({ id: 'ok' }),
    ])
    vi.mocked(supabase.createRetailClient).mockReturnValue(retail)
    const res = await POST(req())
    const body = await res.json()
    expect(body.vouchers.map((v: { id: string }) => v.id)).toEqual(['ok', 'habis'])
    expect(body.vouchers[1]).toMatchObject({ status: 'belum', alasan: 'Sudah kamu pakai', kalimat_syarat: 'Potongan Rp5.000 · maks 1× per pelanggan', label_nilai: 'Rp5rb', label_sub: 'potongan' })

    // Validasi query filters untuk security
    expect(retail._from).toHaveBeenCalledWith('vouchers')
    expect(retail._chain.is).toHaveBeenCalledWith('kode', null)
    expect(retail._chain.eq).toHaveBeenCalledWith('is_active', true)
    const orCalls = vi.mocked(retail._chain.or).mock.calls
    expect(orCalls.length).toBeGreaterThan(0)
    const orArg = orCalls[0][0] as string
    expect(orArg).toContain('selesai.is.null')
    expect(orArg).toContain('selesai.gt.')
  })
  it('502 saat DB galat', async () => {
    vi.mocked(auth.requireCustomer).mockResolvedValue({ customerId: 'c1' })
    vi.mocked(supabase.createRetailClient).mockReturnValue(retailDengan([], { message: 'mati' }))
    expect((await POST(req())).status).toBe(502)
  })
})
