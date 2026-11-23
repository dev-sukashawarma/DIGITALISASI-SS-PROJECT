import { describe, it, expect, vi } from 'vitest'
import { STATUS_PO_TERBUKA, ambilPoTerbuka } from './poTerbuka'

function klienPalsu(perStatus: Record<string, any[]>, galat?: { message: string }) {
  const rpc = vi.fn(async (_fn: string, args: { p_from: unknown; p_to: unknown; p_status: string }) => {
    if (galat) return { data: null, error: galat }
    return { data: perStatus[args.p_status] ?? [], error: null }
  })
  return { rpc }
}

describe('ambilPoTerbuka', () => {
  it('meminta tiap status terbuka tanpa batas tanggal (PO lama tetap muncul, PO hari ini tak tergantung UTC)', async () => {
    const klien = klienPalsu({})
    await ambilPoTerbuka(klien)
    expect(klien.rpc).toHaveBeenCalledTimes(STATUS_PO_TERBUKA.length)
    for (const status of STATUS_PO_TERBUKA) {
      expect(klien.rpc).toHaveBeenCalledWith('get_purchase_orders', { p_from: null, p_to: null, p_status: status })
    }
  })

  it('menggabungkan hasil semua status, terbaru (created_at) di atas, tanpa duplikat', async () => {
    const klien = klienPalsu({
      dikirim_ke_supplier: [
        { id: 'a', status: 'dikirim_ke_supplier', created_at: '2026-11-23T01:00:00Z' },
      ],
      sebagian_diterima: [
        { id: 'b', status: 'sebagian_diterima', created_at: '2026-09-28T01:00:00Z' },
        { id: 'a', status: 'sebagian_diterima', created_at: '2026-11-23T01:00:00Z' },
      ],
    })
    const hasil = await ambilPoTerbuka(klien)
    expect(hasil.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('membuang status di luar daftar terbuka walau RPC mengembalikannya', async () => {
    const klien = klienPalsu({ dikirim_ke_supplier: [{ id: 'x', status: 'diterima_lengkap', created_at: '2026-11-01' }] })
    expect(await ambilPoTerbuka(klien)).toEqual([])
  })

  it('melempar galat RPC (pemanggil yang memutuskan menampilkan atau mengosongkan)', async () => {
    const klien = klienPalsu({}, { message: 'boom' })
    await expect(ambilPoTerbuka(klien)).rejects.toThrow('boom')
  })
})
