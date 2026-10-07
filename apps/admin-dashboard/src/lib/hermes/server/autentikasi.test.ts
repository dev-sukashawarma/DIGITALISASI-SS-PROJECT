import { autentikasi } from './autentikasi'
import { buatKunciBaru } from '../kunci'

const k = buatKunciBaru()
const baris = (o: Record<string, unknown> = {}) => ({
  id: 'kid', hash_kunci: k.hash, scope: ['penjualan'], ip_diizinkan: ['76.13.193.138'], aktif: true, ...o,
})
function svc(data: unknown, error: unknown = null) {
  const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data, error }) }
  return { from: vi.fn(() => q) }
}
const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null })
const sah = { authorization: `Bearer ${k.kunci}`, 'x-real-ip': '76.13.193.138' }

describe('autentikasi Hermes', () => {
  it('kunci + IP benar → ok dengan scope', async () => {
    expect(await autentikasi(h(sah), svc(baris()))).toEqual({ ok: true, kunciId: 'kid', prefix: k.prefix, scope: ['penjualan'], ip: '76.13.193.138' })
  })
  it('tanpa header → 401, tanpa menyentuh DB', async () => {
    const s = svc(baris())
    const r = await autentikasi(h({ 'x-real-ip': '1.1.1.1' }), s)
    expect(r).toMatchObject({ ok: false, status: 401 })
    expect(s.from).not.toHaveBeenCalled()
  })
  it('prefix tak ada di DB → 401', async () => {
    expect(await autentikasi(h(sah), svc(null))).toMatchObject({ ok: false, status: 401, alasan: 'kunci tidak dikenal' })
  })
  it('hash tak cocok (rahasia ditebak dengan prefix benar) → 401', async () => {
    const palsu = `Bearer hms_${k.prefix}_${'A'.repeat(32)}`
    expect(await autentikasi(h({ ...sah, authorization: palsu }), svc(baris()))).toMatchObject({ ok: false, status: 401, alasan: 'kunci tidak dikenal' })
  })
  it('kunci dicabut → 401', async () => {
    expect(await autentikasi(h(sah), svc(baris({ aktif: false })))).toMatchObject({ ok: false, status: 401, alasan: 'kunci dicabut', kunciId: 'kid' })
  })
  it('IP lain / allowlist kosong → 403 (fail-closed)', async () => {
    expect(await autentikasi(h({ ...sah, 'x-real-ip': '9.9.9.9' }), svc(baris()))).toMatchObject({ ok: false, status: 403, ip: '9.9.9.9' })
    expect(await autentikasi(h(sah), svc(baris({ ip_diizinkan: [] })))).toMatchObject({ ok: false, status: 403 })
  })
  it('scope di DB yang bukan domain dibuang', async () => {
    const r = await autentikasi(h(sah), svc(baris({ scope: ['penjualan', 'aneh'] })))
    expect(r.ok && r.scope).toEqual(['penjualan'])
  })
  it('galat DB → dilempar (route membalas 500), bukan diam-diam lolos', async () => {
    await expect(autentikasi(h(sah), svc(null, { message: 'down' }))).rejects.toThrow('down')
  })
})
