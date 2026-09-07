import { describe, it, expect, afterEach } from 'vitest'
import { GET } from './route'

const asli = process.env.SOURCE_COMMIT

afterEach(() => {
  if (asli === undefined) delete process.env.SOURCE_COMMIT
  else process.env.SOURCE_COMMIT = asli
})

describe('GET /api/health', () => {
  it('mengembalikan status ok', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('retail-gateway')
  })

  it('memendekkan commit jadi tujuh karakter', async () => {
    process.env.SOURCE_COMMIT = '7ae30b0d1234567890abcdef'
    const body = await (await GET()).json()
    expect(body.commit).toBe('7ae30b0')
  })

  it('mengatakan "tidak diketahui" kalau variabelnya belum di-set', async () => {
    // Ini BUKAN penanda build bermasalah -- hanya berarti SOURCE_COMMIT
    // belum ada di panel Coolify. Bedanya penting saat menelusuri deploy.
    delete process.env.SOURCE_COMMIT
    const body = await (await GET()).json()
    expect(body.commit).toBe('tidak diketahui')
  })

  it('nilai kosong atau spasi diperlakukan sebagai tidak diketahui', async () => {
    process.env.SOURCE_COMMIT = '   '
    const body = await (await GET()).json()
    expect(body.commit).toBe('tidak diketahui')
  })
})
