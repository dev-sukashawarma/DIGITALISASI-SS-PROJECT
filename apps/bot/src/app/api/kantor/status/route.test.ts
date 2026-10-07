import { vi } from 'vitest'

const ambil = vi.fn()
vi.mock('@/lib/server/sesi', () => ({ ambilSesiKantor: () => ambil() }))

import { GET } from './route'

const sesiDengan = (rpc: () => Promise<unknown>) => ({ ok: true, sesi: { supabase: { rpc }, userId: 'u', nama: 'Bos' } })

describe('GET /api/kantor/status', () => {
  beforeEach(() => ambil.mockReset())

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
  it('200 dengan meja ber-keadaan & no-store', async () => {
    const baris = { id: 'k1', nama: 'Bot HRD', scope: ['absensi'], dibuat_at: '2026-10-01T00:00:00Z',
      terakhir_at: new Date().toISOString(), status_terakhir: 'ok', alat_terakhir: 'rekap', panggilan_hari_ini: 1 }
    ambil.mockResolvedValue(sesiDengan(async () => ({ data: [baris], error: null })))
    const r = await GET()
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('no-store')
    const j = await r.json()
    expect(j.meja).toEqual([{ id: 'k1', nama: 'Bot HRD', scope: ['absensi'], keadaan: 'bekerja', alatTerakhir: 'rekap', terakhirAt: baris.terakhir_at }])
    expect(typeof j.diambilAt).toBe('string')
  })
})
