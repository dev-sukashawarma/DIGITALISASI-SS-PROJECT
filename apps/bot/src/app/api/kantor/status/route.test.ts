import { vi } from 'vitest'

const ambil = vi.fn()
vi.mock('@/lib/server/sesi', () => ({ ambilSesi: () => ambil() }))

import { GET } from './route'

const sesiDengan = (rpc: () => Promise<unknown>, role = 'developer') =>
  ({ ok: true, sesi: { supabase: { rpc }, userId: 'u', nama: 'Bos', role } })

const baris = (ubah: Record<string, unknown> = {}) => ({
  id: 'k1', nama: 'MANAGER UTAMA', scope: ['penjualan'], dibuat_at: '2026-10-01T00:00:00Z',
  terakhir_at: new Date().toISOString(), status_terakhir: 'ok', alat_terakhir: 'rekap', panggilan_hari_ini: 1, ...ubah,
})

describe('GET /api/kantor/status', () => {
  const envLama = process.env.HERMES_KEYS
  beforeEach(() => { ambil.mockReset(); process.env.HERMES_KEYS = JSON.stringify({ ceo: 'k' }) })
  afterAll(() => { process.env.HERMES_KEYS = envLama })

  it('401 diteruskan', async () => {
    ambil.mockResolvedValue({ ok: false, status: 401 })
    const r = await GET()
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ galat: 'Tidak punya akses.' })
  })
  it('42501 dari RPC → 403', async () => {
    ambil.mockResolvedValue(sesiDengan(async () => ({ data: null, error: { code: '42501' } })))
    expect((await GET()).status).toBe(403)
  })
  it('galat lain → 502', async () => {
    ambil.mockResolvedValue(sesiDengan(async () => ({ data: null, error: { code: 'XX000' } })))
    const r = await GET()
    expect(r.status).toBe(502)
    expect(await r.json()).toEqual({ galat: 'Gagal memuat status bot.' })
  })
  it('200: meja ber-keadaan, profil & bolehChat, no-store', async () => {
    const b = baris()
    ambil.mockResolvedValue(sesiDengan(async () => ({ data: [b, baris({ id: 'k2', nama: 'Bot HRD', scope: ['absensi'] })], error: null })))
    const r = await GET()
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('no-store')
    const j = await r.json()
    expect(j.meja[0]).toEqual({
      id: 'k1', nama: 'MANAGER UTAMA', scope: ['penjualan'], keadaan: 'bekerja', alatTerakhir: 'rekap',
      terakhirAt: b.terakhir_at, profil: 'ceo', bolehChat: true, alasanTanpaChat: null,
    })
    // hrd diizinkan role tapi kuncinya tidak dikonfigurasi → tidak boleh chat
    expect(j.meja[1]).toMatchObject({ profil: 'hrd', bolehChat: false, alasanTanpaChat: 'belum_tersambung' })
    expect(typeof j.diambilAt).toBe('string')
  })
  it('owner: semua meja tampil tanpa izin chat', async () => {
    ambil.mockResolvedValue(sesiDengan(async () => ({ data: [baris()], error: null }), 'owner'))
    expect((await (await GET()).json()).meja[0]).toMatchObject({ profil: 'ceo', bolehChat: false, alasanTanpaChat: 'peran' })
  })
})
