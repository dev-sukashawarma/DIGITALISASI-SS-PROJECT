import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'
import { susunPesanKredensialTelegram } from '@/lib/telegram/hermesNotifier'
import {
  buatKredensialOrderOnline,
  sinkronOutletKeOrderOnline,
  tipeOrderOnline,
} from './orderOnlineSync'

vi.mock('@/lib/supabase/order-online-client', () => ({
  createOrderOnlineAdminClient: vi.fn(),
}))

/** In-memory fake untuk menguji perilaku sinkronisasi Form Order secara utuh di batas sistem. */
function buatFakeOrderOnlineDb(awal?: {
  outlets?: Array<Record<string, any>>
  adminUsers?: Array<Record<string, any>>
  authUsers?: Array<{ id: string; email: string; password: string }>
}) {
  const outlets = [...(awal?.outlets ?? [])]
  const adminUsers = [...(awal?.adminUsers ?? [])]
  const authUsers = [...(awal?.authUsers ?? [])]

  const from = (table: string) => {
    const koleksi = table === 'outlets' ? outlets : adminUsers
    let filterFn: (row: any) => boolean = () => true

    const builder: any = {
      select: () => builder,
      eq: (col: string, val: any) => {
        const prev = filterFn
        filterFn = (r) => prev(r) && r[col] === val
        return builder
      },
      ilike: (col: string, val: string) => {
        const prev = filterFn
        const lower = val.toLowerCase()
        filterFn = (r) => prev(r) && String(r[col] ?? '').toLowerCase() === lower
        return builder
      },
      or: (expr: string) => {
        const prev = filterFn
        const parts = expr.split(',').map((p) => p.split('.eq.'))
        filterFn = (r) =>
          prev(r) && parts.some(([col, val]) => String(r[col] ?? '') === val)
        return builder
      },
      limit: (n: number) =>
        Promise.resolve({
          data: koleksi.filter(filterFn).slice(0, n),
          error: null,
        }),
      maybeSingle: async () => ({
        data: koleksi.find(filterFn) ?? null,
        error: null,
      }),
      then: (resolve: any) =>
        Promise.resolve({ data: koleksi.filter(filterFn), error: null }).then(resolve),
      insert: async (row: any) => {
        koleksi.push({ ...row })
        return { error: null }
      },
      upsert: async (row: any) => {
        const idx = koleksi.findIndex((r) => r.id === row.id)
        if (idx >= 0) koleksi[idx] = { ...koleksi[idx], ...row }
        else koleksi.push({ ...row })
        return { error: null }
      },
      update: (patch: any) => ({
        eq: (col: string, val: any) => {
          const prev = filterFn
          const nextFilter = (r: any) => prev(r) && r[col] === val
          const sub: any = {
            eq: (col2: string, val2: any) => {
              koleksi.forEach((r, i) => {
                if (nextFilter(r) && r[col2] === val2) koleksi[i] = { ...r, ...patch }
              })
              return Promise.resolve({ error: null })
            },
            then: (resolve: any) => {
              koleksi.forEach((r, i) => {
                if (nextFilter(r)) koleksi[i] = { ...r, ...patch }
              })
              return Promise.resolve({ error: null }).then(resolve)
            },
          }
          return sub
        },
      }),
    }
    return builder
  }

  return {
    outlets,
    adminUsers,
    authUsers,
    client: {
      from,
      auth: {
        admin: {
          createUser: async ({ email, password }: { email: string; password: string }) => {
            if (authUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
              return { data: { user: null }, error: { message: 'User already registered' } }
            }
            const user = { id: `auth-${authUsers.length + 1}`, email, password }
            authUsers.push(user)
            return { data: { user }, error: null }
          },
          updateUserById: async (id: string, patch: { email?: string; password?: string }) => {
            const idx = authUsers.findIndex((u) => u.id === id)
            if (idx < 0) return { data: null, error: { message: 'User not found' } }
            authUsers[idx] = {
              ...authUsers[idx],
              ...(patch.email ? { email: patch.email } : {}),
              ...(patch.password ? { password: patch.password } : {}),
            }
            return { data: { user: authUsers[idx] }, error: null }
          },
          listUsers: async () => ({ data: { users: authUsers }, error: null }),
          deleteUser: async (id: string) => {
            const idx = authUsers.findIndex((u) => u.id === id)
            if (idx >= 0) authUsers.splice(idx, 1)
            return { error: null }
          },
        },
      },
    },
  }
}

describe('tipeOrderOnline', () => {
  it('memetakan mitra ke partner dan internal ke owned', () => {
    expect(tipeOrderOnline('mitra')).toBe('partner')
    expect(tipeOrderOnline('internal')).toBe('owned')
    expect(tipeOrderOnline('')).toBe('owned')
  })
})

describe('buatKredensialOrderOnline', () => {
  it.each([
    {
      nama: 'cileungsi',
      tipe: 'mitra' as const,
      email: 'mitracileungsi@ss.com',
      password: 'mitracileungsi2627',
      fullName: 'MITRA CILEUNGSI',
    },
    {
      nama: 'cileungsi',
      tipe: 'internal' as const,
      email: 'sscileungsi@ss.com',
      password: 'sscileungsi2627',
      fullName: 'SS CILEUNGSI',
    },
    {
      nama: 'MITRA CILEUNGSI',
      tipe: 'mitra' as const,
      email: 'mitracileungsi@ss.com',
      password: 'mitracileungsi2627',
      fullName: 'MITRA CILEUNGSI',
    },
    {
      nama: 'SUKA SHAWARMA Pondok Aren',
      tipe: 'internal' as const,
      email: 'sspondokaren@ss.com',
      password: 'sspondokaren2627',
      fullName: 'SS PONDOK AREN',
    },
    {
      nama: 'Pekayon Mitra',
      tipe: 'mitra' as const,
      email: 'mitrapekayon@ss.com',
      password: 'mitrapekayon2627',
      fullName: 'MITRA PEKAYON',
    },
  ])(
    'menghasilkan email & password standar untuk "$nama" ($tipe)',
    ({ nama, tipe, email, password, fullName }) => {
      const hasil = buatKredensialOrderOnline(nama, tipe)
      expect(hasil.email).toBe(email)
      expect(hasil.password).toBe(password)
      expect(hasil.fullName).toBe(fullName)
    },
  )
})

describe('susunPesanKredensialTelegram', () => {
  it('melakukan escape karakter HTML pada nama outlet dan mencantumkan transisi tipe', () => {
    const html = susunPesanKredensialTelegram({
      aksi: 'perubahan_kredensial',
      namaOutlet: 'Cabang A & B <Utama>',
      slugOutlet: 'cabang-a-b',
      tipeLama: 'internal',
      tipeBaru: 'mitra',
      statusOutlet: 'pending',
      email: 'mitracabangabutama@ss.com',
      password: 'mitracabangabutama2627',
    })

    expect(html).toContain('Cabang A &amp; B &lt;Utama&gt;')
    expect(html).toContain('INTERNAL -&gt; MITRA')
    expect(html).toContain('<code>mitracabangabutama@ss.com</code>')
    expect(html).toContain('<code>mitracabangabutama2627</code>')
    expect(html).toContain('Pending (Persiapan')
  })
})

describe('sinkronOutletKeOrderOnline', () => {
  const fetchAsli = globalThis.fetch
  const envAsli = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TELEGRAM_HERMES_BOT_TOKEN = 'test-bot-token'
    process.env.TELEGRAM_HERMES_CHAT_ID = '5253841857'
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
    } as any)
  })

  afterAll(() => {
    globalThis.fetch = fetchAsli
    process.env = envAsli
  })

  it('outlet baru berstatus pending otomatis membuat outlet nonaktif-pelanggan, akun user aktif, dan mengirim Telegram', async () => {
    const fake = buatFakeOrderOnlineDb()
    vi.mocked(createOrderOnlineAdminClient).mockReturnValue(fake.client as any)

    const hasil = await sinkronOutletKeOrderOnline(
      {
        id: 'outlet-1',
        slug: 'bekasi-timur',
        name: 'Bekasi Timur',
        address: 'Jl. Ir. H. Juanda',
        lat: -6.24,
        lng: 107.0,
        type: 'internal',
        status: 'pending',
        is_active: false,
        open_hour: '14:00',
        close_hour: '22:00',
      },
      { mode: 'buat' },
    )

    expect(fake.outlets).toHaveLength(1)
    expect(fake.outlets[0]).toMatchObject({
      id: 'outlet-1',
      type: 'owned',
      status: 'pending',
      is_active: false,
    })

    expect(fake.authUsers[0]).toMatchObject({
      email: 'ssbekasitimur@ss.com',
      password: 'ssbekasitimur2627',
    })
    expect(fake.adminUsers[0]).toMatchObject({
      email: 'ssbekasitimur@ss.com',
      full_name: 'SS BEKASI TIMUR',
      role: 'outlet_staff',
      outlet_id: 'outlet-1',
      is_active: true,
    })
    expect(hasil.telegramTerkirim).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('perubahan tipe dari internal ke mitra saat edit otomatis memutar email+password user yang ada dan mengirim ulang ke Telegram', async () => {
    const fake = buatFakeOrderOnlineDb({
      outlets: [
        {
          id: 'outlet-1',
          pos_outlet_id: 'outlet-1',
          slug: 'bekasi-timur',
          name: 'Bekasi Timur',
          type: 'owned',
          status: 'active',
          is_active: true,
        },
      ],
      authUsers: [
        { id: 'auth-1', email: 'ssbekasitimur@ss.com', password: 'ssbekasitimur2627' },
      ],
      adminUsers: [
        {
          id: 'auth-1',
          email: 'ssbekasitimur@ss.com',
          full_name: 'SS BEKASI TIMUR',
          role: 'outlet_staff',
          outlet_id: 'outlet-1',
          is_active: true,
        },
      ],
    })
    vi.mocked(createOrderOnlineAdminClient).mockReturnValue(fake.client as any)

    const hasil = await sinkronOutletKeOrderOnline(
      {
        id: 'outlet-1',
        slug: 'bekasi-timur',
        name: 'Bekasi Timur',
        address: 'Jl. Ir. H. Juanda',
        lat: -6.24,
        lng: 107.0,
        type: 'mitra',
        status: 'active',
        is_active: true,
        open_hour: '14:00',
        close_hour: '22:00',
      },
      { mode: 'ubah', tipeSebelumnya: 'internal', namaSebelumnya: 'Bekasi Timur' },
    )

    expect(fake.outlets[0].type).toBe('partner')
    expect(fake.authUsers).toHaveLength(1)
    expect(fake.authUsers[0]).toMatchObject({
      id: 'auth-1',
      email: 'mitrabekasitimur@ss.com',
      password: 'mitrabekasitimur2627',
    })
    expect(fake.adminUsers[0]).toMatchObject({
      id: 'auth-1',
      email: 'mitrabekasitimur@ss.com',
      full_name: 'MITRA BEKASI TIMUR',
      is_active: true,
    })
    expect(hasil.telegramTerkirim).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('edit alamat/jam tanpa mengubah tipe maupun nama tidak mereset password dan tidak mengirim ulang Telegram', async () => {
    const fake = buatFakeOrderOnlineDb({
      outlets: [
        {
          id: 'outlet-1',
          pos_outlet_id: 'outlet-1',
          slug: 'bekasi-timur',
          name: 'Bekasi Timur',
          type: 'partner',
          status: 'active',
          is_active: true,
        },
      ],
      authUsers: [
        { id: 'auth-1', email: 'mitrabekasitimur@ss.com', password: 'password-kustom-staf' },
      ],
      adminUsers: [
        {
          id: 'auth-1',
          email: 'mitrabekasitimur@ss.com',
          full_name: 'MITRA BEKASI TIMUR',
          role: 'outlet_staff',
          outlet_id: 'outlet-1',
          is_active: true,
        },
      ],
    })
    vi.mocked(createOrderOnlineAdminClient).mockReturnValue(fake.client as any)

    await sinkronOutletKeOrderOnline(
      {
        id: 'outlet-1',
        slug: 'bekasi-timur',
        name: 'Bekasi Timur',
        address: 'Alamat Baru No. 99',
        lat: -6.25,
        lng: 107.01,
        type: 'mitra',
        status: 'active',
        is_active: true,
        open_hour: '13:00',
        close_hour: '23:00',
      },
      { mode: 'ubah', tipeSebelumnya: 'mitra', namaSebelumnya: 'Bekasi Timur' },
    )

    expect(fake.authUsers[0].password).toBe('password-kustom-staf')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
