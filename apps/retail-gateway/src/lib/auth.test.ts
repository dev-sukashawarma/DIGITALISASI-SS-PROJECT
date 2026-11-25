import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { requireCustomer } from './auth'
import { issueSession } from './session'
import * as supabase from './supabase'

vi.mock('./supabase')

beforeAll(() => {
  process.env.SESSION_SECRET = 'rahasia-uji-panjang-minimal-32-karakter-ok'
})

function mockPelanggan(row: Record<string, unknown> | null, error: unknown = null) {
  vi.mocked(supabase.createRetailClient).mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: row, error })),
        })),
      })),
    })),
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPelanggan({
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Budi',
    email: 'budi@contoh.com',
    phone: null,
  })
})

function permintaan(header?: string): Request {
  return new Request('https://contoh.test/api/v1/catalog', {
    headers: header ? { authorization: header } : {},
  })
}

describe('requireCustomer', () => {
  it('menerima Bearer token yang sah', async () => {
    const { token } = await issueSession('22222222-2222-2222-2222-222222222222')
    const hasil = await requireCustomer(permintaan(`Bearer ${token}`))
    expect(hasil).toEqual({ customerId: '22222222-2222-2222-2222-222222222222' })
  })

  it('menolak permintaan tanpa header', async () => {
    expect(await requireCustomer(permintaan())).toBeNull()
  })

  it('menolak skema selain Bearer', async () => {
    const { token } = await issueSession('22222222-2222-2222-2222-222222222222')
    expect(await requireCustomer(permintaan(`Basic ${token}`))).toBeNull()
  })

  it('menolak token yang tidak sah', async () => {
    expect(await requireCustomer(permintaan('Bearer palsu'))).toBeNull()
  })

  it('menolak token milik akun yang sudah dianonimkan/dihapus', async () => {
    mockPelanggan({
      id: '22222222-2222-2222-2222-222222222222',
      name: null,
      email: null,
      phone: null,
    })
    const { token } = await issueSession('22222222-2222-2222-2222-222222222222')
    expect(await requireCustomer(permintaan(`Bearer ${token}`))).toBeNull()
  })

  it('menolak token bila baris pelanggan tidak lagi ada', async () => {
    mockPelanggan(null)
    const { token } = await issueSession('22222222-2222-2222-2222-222222222222')
    expect(await requireCustomer(permintaan(`Bearer ${token}`))).toBeNull()
  })
})
