import { describe, it, expect, beforeAll } from 'vitest'
import { requireCustomer } from './auth'
import { issueSession } from './session'

beforeAll(() => {
  process.env.SESSION_SECRET = 'rahasia-uji-panjang-minimal-32-karakter-ok'
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
})
