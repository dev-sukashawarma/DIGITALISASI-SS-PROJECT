import { describe, it, expect } from 'vitest'
import { muatPembayaranXendit, muatPesananTertaut } from './xenditLoad'

/** Klien Supabase palsu: rpc boleh_baca_xendit + select xendit_pembayaran/orders. */
function klien(boleh: boolean, baris: any[], pesanan: any[] = []) {
  const panggilan: string[] = []
  const builder = (tabel: string) => {
    const b: any = {
      select: () => b, gte: () => b, lte: () => b, order: () => b, in: () => b,
      range: async () => { panggilan.push(tabel); return { data: tabel === 'orders' ? pesanan : baris, error: null } },
      then: (res: any) => { panggilan.push(tabel); return Promise.resolve({ data: tabel === 'orders' ? pesanan : baris, error: null }).then(res) },
    }
    return b
  }
  return {
    panggilan,
    rpc: async (nama: string) => { panggilan.push('rpc:' + nama); return { data: boleh, error: null } },
    from: (t: string) => builder(t),
  }
}
const row = { xendit_id: 'x', ref_qris: null, nominal: 1000, dibayar_at: '2026-10-09T07:00:00.000Z', cara_cocok: 'manual', external_order_id: 'e', outlet_id: 'o', nama_pelanggan: null, ringkasan_item: null, bukan_penjualan: false }

describe('muatPembayaranXendit', () => {
  it('peran yang tidak boleh membaca → null, tanpa membaca tabel', async () => {
    const k = klien(false, [row])
    expect(await muatPembayaranXendit(k, 'all', '2026-10-01', '2026-10-31')).toBeNull()
    expect(k.panggilan).toEqual(['rpc:boleh_baca_xendit'])
  })

  it('tidak berbagi hasil antar pemanggil dengan scopeKey sama (tanpa cache lintas pengguna)', async () => {
    const a = klien(true, [row])
    const b = klien(true, [])
    expect(await muatPembayaranXendit(a, 'all', '2026-10-01', '2026-10-31')).toHaveLength(1)
    expect(await muatPembayaranXendit(b, 'all', '2026-10-01', '2026-10-31')).toHaveLength(0)
  })
})

describe('muatPesananTertaut', () => {
  it('mengambil status pesanan tertaut yang tidak ada di data laporan', async () => {
    const k = klien(true, [], [{ external_order_id: 'e', status: 'completed', sales_source: 'online', total_amount: 1000 }])
    expect(await muatPesananTertaut(k, ['e'])).toEqual([{ external_order_id: 'e', status: 'completed', sales_source: 'online', total_amount: 1000 }])
    expect(await muatPesananTertaut(k, [])).toEqual([])
  })
})
