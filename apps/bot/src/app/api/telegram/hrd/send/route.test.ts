import { POST } from './route'
import { kirimPesanTelegram, supabaseAdmin } from '@/lib/server/telegram'

vi.mock('@/lib/server/telegram', () => ({ kirimPesanTelegram: vi.fn(), supabaseAdmin: vi.fn() }))
const id = '20000000-0000-0000-0000-000000000001'
const payload = { user_id: id, title: 'Terlambat', body: '16 menit' }
function request(body: unknown = payload, secret = 'test-secret') {
  return new Request('http://localhost/api/telegram/hrd/send', {
    method: 'POST', headers: { authorization: `Bearer ${secret}` }, body: JSON.stringify(body),
  })
}
function database(role = 'admin_hr', status = 'active', access = true, link = true, error = false) {
  const filters: string[][] = []
  vi.mocked(supabaseAdmin).mockReturnValue({ from: (table: string) => {
    const query = {
      select: () => query,
      eq: (key: string, value: string) => { filters.push([table, key, value]); return query },
      maybeSingle: async () => ({ error: error ? { message: 'unavailable' } : null, data:
        table === 'outlet_staff' ? { role, status } :
          table === 'hermes_bot_user_access' ? (access ? { staff_id: id } : null) :
            (link ? { chat_id: '123' } : null),
      }),
    }
    return query
  } } as unknown as ReturnType<typeof supabaseAdmin>)
  return filters
}

beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('TELEGRAM_HRD_SEND_SECRET', 'test-secret'); database() })
afterEach(() => vi.unstubAllEnvs())

it('requires the dedicated HRD secret before any lookup', async () => {
  expect((await POST(request(payload, 'stokist-secret'))).status).toBe(401)
  expect(supabaseAdmin).not.toHaveBeenCalled()
})
it('rejects invalid payloads', async () => {
  expect((await POST(request({ ...payload, user_id: 'invalid' }))).status).toBe(400)
  expect((await POST(request({ ...payload, body: 'x'.repeat(1201) }))).status).toBe(400)
  expect(kirimPesanTelegram).not.toHaveBeenCalled()
})
it.each(['owner', 'admin', 'crew', 'kitchen'])('does not send HR data to %s', async role => {
  database(role)
  expect(await (await POST(request())).json()).toEqual({ delivered: false, reason: 'not_eligible' })
  expect(kirimPesanTelegram).not.toHaveBeenCalled()
})
it.each([
  ['admin_hr', 'inactive', true, true], ['admin_hr', 'active', false, true], ['admin_hr', 'active', true, false],
  ['developer', 'inactive', true, true], ['developer', 'active', false, true], ['developer', 'active', true, false],
])('requires active status, HRD access and linked Telegram (%s,%s,%s,%s)', async (role, status, access, link) => {
  database(role as string, status as string, access as boolean, link as boolean)
  expect(await (await POST(request())).json()).toEqual({ delivered: false, reason: 'not_eligible' })
  expect(kirimPesanTelegram).not.toHaveBeenCalled()
})
it.each(['admin_hr', 'developer'])('uses the HRD profile and checks hrd access for %s', async role => {
  const filters = database(role)
  expect(await (await POST(request({ ...payload, url: 'https://example.com' }))).json()).toEqual({ delivered: true })
  expect(filters).toContainEqual(['hermes_bot_user_access', 'bot_slug', 'hrd'])
  expect(kirimPesanTelegram).toHaveBeenCalledWith('123', 'Terlambat\n\n16 menit', 'https://hr.sukashawarma.com/attendance', 'hrd')
})
it('returns a retryable status when lookup fails', async () => {
  database('admin_hr', 'active', true, true, true)
  expect((await POST(request())).status).toBe(503)
  expect(kirimPesanTelegram).not.toHaveBeenCalled()
})
it('returns a retryable status without leaking Telegram errors', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(kirimPesanTelegram).mockRejectedValueOnce(new Error('sensitive token'))
  const response = await POST(request())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('sensitive')
  vi.restoreAllMocks()
})
