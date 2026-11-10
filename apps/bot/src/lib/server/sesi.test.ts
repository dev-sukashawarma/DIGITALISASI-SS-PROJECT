import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCookiesGetAll = vi.fn()
const mockCookiesSet = vi.fn()
const mockGetVerifiedUserId = vi.fn()
const mockRpc = vi.fn()
const mockMaybeSingle = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => mockCookiesGetAll(),
    set: (...args: any[]) => mockCookiesSet(...args),
  })),
}))

vi.mock('@suka/auth', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    rpc: (...args: any[]) => mockRpc(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => mockMaybeSingle(),
        }),
      }),
    }),
  })),
  getVerifiedUserId: (...args: any[]) => mockGetVerifiedUserId(...args),
}))

import { ambilSesi, resetCacheSesiServer } from './sesi'

describe('ambilSesi cache sesi terverifikasi (0-RTT pada giliran suara beruntun)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetCacheSesiServer()
  })

  it('menyimpan cache sesi valid selama 60 detik sehingga panggilan ke-2 tidak menembak RPC/DB ulang', async () => {
    mockCookiesGetAll.mockReturnValue([{ name: 'sb-khp-auth-token', value: 'jwt-valid-123' }])
    mockGetVerifiedUserId.mockResolvedValue('user-owner-1')
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockMaybeSingle.mockResolvedValue({
      data: { name: 'Pak Boss', role: 'owner', status: 'active' },
      error: null,
    })

    const r1 = await ambilSesi()
    expect(r1.ok).toBe(true)
    expect(mockGetVerifiedUserId).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1)

    // Panggilan ke-2 (mis. kalimat ke-1 & ke-2 /api/voice/tts): langsung 0-RTT dari cache!
    const r2 = await ambilSesi()
    expect(r2.ok).toBe(true)
    if (r2.ok) {
      expect(r2.sesi.userId).toBe('user-owner-1')
      expect(r2.sesi.nama).toBe('Pak Boss')
      expect(r2.sesi.role).toBe('owner')
    }
    expect(mockGetVerifiedUserId).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1)
  })

  it('tidak menyimpan cache jika sesi ditolak (401 / 403)', async () => {
    mockCookiesGetAll.mockReturnValue([{ name: 'sb-khp-auth-token', value: 'jwt-expired' }])
    mockGetVerifiedUserId.mockResolvedValueOnce(null).mockResolvedValueOnce('user-owner-1')
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockMaybeSingle.mockResolvedValue({
      data: { name: 'Pak Boss', role: 'owner', status: 'active' },
      error: null,
    })

    const r1 = await ambilSesi()
    expect(r1).toEqual({ ok: false, status: 401 })

    const r2 = await ambilSesi()
    expect(r2.ok).toBe(true)
    expect(mockGetVerifiedUserId).toHaveBeenCalledTimes(2)
  })
})
