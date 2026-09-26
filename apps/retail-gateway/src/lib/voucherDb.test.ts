import { describe, it, expect, vi } from 'vitest'
import { normalisasiVoucher, normalisasiKode, nilaiVoucher, konteksPelanggan } from './voucherDb'

const baris = {
  id: 'v1', nama: 'Uji', deskripsi: null, kode: 'HEMAT', jenis: 'nominal', nilai: '5000', maks_potongan: null,
  menu_item_id: null, beli_qty: null, gratis_qty: null, harga_spesial: null, mulai: null, selesai: null,
  kuota_total: 10, batas_per_pelanggan: null, min_belanja: '20000', khusus_pesanan_pertama: false,
  outlet_ids: null, hari: null, jam_mulai: null, jam_selesai: null, menu_ids: null, kategori_ids: null, is_active: true,
}

describe('normalisasi', () => {
  it('numeric string jadi number', () => {
    const v = normalisasiVoucher(baris)
    expect(v.nilai).toBe(5000)
    expect(v.min_belanja).toBe(20000)
    expect(v.maks_potongan).toBeNull()
  })
  it('kode', () => expect(normalisasiKode('  hemat10 ')).toBe('HEMAT10'))
})

/** Klien palsu: `from(tabel)` mengembalikan rantai yang berakhir ke `hasil[tabel]`. */
function klien(hasil: Record<string, unknown>) {
  const rantai = (tabel: string): any => {
    const r: any = {}
    for (const f of ['select', 'eq', 'is', 'not', 'in', 'limit']) r[f] = vi.fn(() => r)
    r.maybeSingle = vi.fn(async () => hasil[tabel])
    r.then = (ok: (x: unknown) => unknown) => Promise.resolve(hasil[tabel + ':count'] ?? { count: 0, error: null }).then(ok)
    return r
  }
  return { from: vi.fn(rantai) } as any
}

/**
 * RECORDING fake: catat setiap call per-rantai untuk verifikasi filter yang tepat.
 * Mengembalikan counts berbeda untuk setiap call ke tabel yang sama (untuk deteksi filter berbeda).
 */
function klienRecording(hasil: Record<string, unknown>) {
  const callCounts: Record<string, number> = {}
  return {
    from: vi.fn((tabel: string): any => {
      const log: Array<{ method: string; args: unknown[] }> = []
      callCounts[tabel] = (callCounts[tabel] ?? 0) + 1
      const callIndex = callCounts[tabel]
      const r: any = {}
      for (const f of ['select', 'eq', 'is', 'not', 'in', 'limit']) {
        r[f] = vi.fn((arg1?: unknown, arg2?: unknown, arg3?: unknown) => {
          log.push({ method: f, args: [arg1, arg2, arg3].filter(x => x !== undefined) })
          return r
        })
      }
      r.maybeSingle = vi.fn(async () => hasil[tabel])
      r.then = (ok: (x: unknown) => unknown) => {
        // Return different counts based on which call this is (untuk voucher_pemakaian: 1st=7, 2nd=2)
        let countKey = tabel + ':count'
        if (tabel === 'voucher_pemakaian' && callIndex === 2) countKey = tabel + ':count:2' // 2nd call
        const countResult = hasil[countKey] ?? hasil[tabel + ':count'] ?? { count: 0, error: null }
        return Promise.resolve(countResult).then(ok)
      }
      return { ...r, _log: log }
    })
  } as any
}

describe('konteksPelanggan', () => {
  it('query 1 (total): filter eq(voucher_id) DAN not(lunas_at)', async () => {
    const rc = klienRecording({ 'voucher_pemakaian:count': { count: 7, error: null }, 'order_drafts:count': { count: 1, error: null } })
    await konteksPelanggan(rc, 'v1', 'c1')
    // Query 1: voucher_pemakaian (total) - first call
    const q1Calls = rc.from.mock.results[0]?.value._log || []
    expect(q1Calls.some((x: any) => x.method === 'eq' && x.args[0] === 'voucher_id' && x.args[1] === 'v1')).toBe(true)
    expect(q1Calls.some((x: any) => x.method === 'not' && x.args[0] === 'lunas_at' && x.args[1] === 'is')).toBe(true)
  })

  it('per-customer query memasukkan eq(customer_id), total query tidak', async () => {
    const rc = klienRecording({
      'voucher_pemakaian:count': { count: 10, error: null },
      'order_drafts:count': { count: 2, error: null }
    })
    await konteksPelanggan(rc, 'v1', 'c1')
    const q1Calls = rc.from.mock.results[0]?.value._log || []
    const q2Calls = rc.from.mock.results[1]?.value._log || []
    // Query 1 (total): NO eq(customer_id)
    expect(q1Calls.filter((x: any) => x.method === 'eq' && x.args[0] === 'customer_id')).toHaveLength(0)
    // Query 2 (pelanggan): HAS eq(customer_id)
    expect(q2Calls.some((x: any) => x.method === 'eq' && x.args[0] === 'customer_id' && x.args[1] === 'c1')).toBe(true)
    // Query 2: MUST have eq(voucher_id)
    expect(q2Calls.some((x: any) => x.method === 'eq' && x.args[0] === 'voucher_id')).toBe(true)
    // Query 2: MUST have not(lunas_at)
    expect(q2Calls.some((x: any) => x.method === 'not' && x.args[0] === 'lunas_at')).toBe(true)
  })

  it('order_drafts filter eq(customer_id) dan eq(status, dibayar)', async () => {
    const rc = klienRecording({
      'voucher_pemakaian:count': { count: 5, error: null },
      'order_drafts:count': { count: 3, error: null }
    })
    await konteksPelanggan(rc, 'v1', 'c1')
    const odCalls = rc.from.mock.results[2]?.value._log || []
    expect(odCalls.some((x: any) => x.method === 'eq' && x.args[0] === 'customer_id')).toBe(true)
    expect(odCalls.some((x: any) => x.method === 'eq' && x.args[0] === 'status' && x.args[1] === 'dibayar')).toBe(true)
  })

  it('count queries pakai select(id, { count: exact, head: true })', async () => {
    const rc = klienRecording({
      'voucher_pemakaian:count': { count: 3, error: null },
      'order_drafts:count': { count: 1, error: null }
    })
    await konteksPelanggan(rc, 'v1', 'c1')
    const allCalls = rc.from.mock.results.flatMap((r: any) => r.value._log || [])
    const selectCalls = allCalls.filter((x: any) => x.method === 'select')
    expect(selectCalls.length).toBeGreaterThan(0)
    selectCalls.forEach((sc: any) => {
      expect(sc.args[0]).toBe('id')
      expect(sc.args[1]).toEqual({ count: 'exact', head: true })
    })
  })

  it('hasil: counts mapping ke jumlahLunasPelanggan (query 2)', async () => {
    // Gunakan klienRecording untuk mendapatkan counts berbeda per query
    const rc = klienRecording({
      'voucher_pemakaian:count': { count: 7, error: null }, // Query 1 (total)
      'voucher_pemakaian:count:2': { count: 2, error: null }, // Query 2 (per-customer)
      'order_drafts:count': { count: 1, error: null }
    })
    const hasil = await konteksPelanggan(rc, 'v1', 'c1')
    // Verifikasi struktur
    expect(hasil).toHaveProperty('jumlahLunasTotal')
    expect(hasil).toHaveProperty('jumlahLunasPelanggan')
    expect(hasil).toHaveProperty('pelangganSudahPernahBayar')
    // Verifikasi exact counts - ini mendeteksi swap destruktur atau filter yang salah
    expect(hasil.jumlahLunasTotal).toBe(7)
    expect(hasil.jumlahLunasPelanggan).toBe(2)
    expect(hasil.pelangganSudahPernahBayar).toBe(true)
  })

  it('pelangganSudahPernahBayar=false saat drafts count 0', async () => {
    const hasil = await konteksPelanggan(
      klien({ 'voucher_pemakaian:count': { count: 5, error: null }, 'order_drafts:count': { count: 0, error: null } }),
      'v1', 'c1'
    )
    expect(hasil.pelangganSudahPernahBayar).toBe(false) // count 0 = false
  })

  it('error pada salah satu count query ditolak', async () => {
    await expect(
      konteksPelanggan(
        klien({ 'voucher_pemakaian:count': { count: null, error: { message: 'DB down' } } }),
        'v1', 'c1'
      )
    ).rejects.toThrow('DB down')
  })
})

describe('nilaiVoucher', () => {
  const dasar = { customerId: 'c1', outletId: 'o1', items: [{ menu_item_id: 'A', name: 'A', unit_price: 30000, quantity: 1 }],
    katalog: [{ id: 'A', name: 'A', description: null, price: 30000, image_url: null, is_available: true, category_id: null, sort_order: null, category_name: null, category_sort_order: null }],
    sekarang: new Date('2026-09-24T08:00:00Z') }
  it('tanpa pilihan → ada:false', async () => {
    expect(await nilaiVoucher({ retail: klien({}), pilih: {}, ...dasar })).toEqual({ ada: false })
  })
  it('kode tak dikenal → voucher null + alasan', async () => {
    const r = await nilaiVoucher({ retail: klien({ vouchers: { data: null, error: null } }), pilih: { kodeVoucher: 'x' }, ...dasar })
    expect(r).toEqual({ ada: true, voucher: null, hasil: { berlaku: false, alasan: 'Kode voucher tidak ditemukan' } })
  })
  it('voucher ditemukan → dihitung', async () => {
    const r = await nilaiVoucher({ retail: klien({ vouchers: { data: baris, error: null } }), pilih: { voucherId: 'v1' }, ...dasar })
    expect(r).toMatchObject({ ada: true, hasil: { berlaku: true, potongan: 5000 } })
  })
  it('galat DB dilempar', async () => {
    await expect(nilaiVoucher({ retail: klien({ vouchers: { data: null, error: { message: 'mati' } } }), pilih: { voucherId: 'v1' }, ...dasar }))
      .rejects.toThrow('mati')
  })
})
