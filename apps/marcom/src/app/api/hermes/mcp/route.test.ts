import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST, GET, DELETE } from './route'

// Mock prisma agar tidak menyentuh database sungguhan saat integration test route
vi.mock('@/lib/prisma', () => {
  return {
    prisma: {
      endorsement: { findMany: vi.fn().mockResolvedValue([]) },
      internalContent: { findMany: vi.fn().mockResolvedValue([]) },
      outlet: { findMany: vi.fn().mockResolvedValue([]) },
      ad: { findMany: vi.fn().mockResolvedValue([]) },
      promoEvent: { findMany: vi.fn().mockResolvedValue([]) },
    },
    ensureDatabaseSchema: vi.fn().mockResolvedValue(undefined),
  }
})

describe('Endpoint MCP Marcom (/api/hermes/mcp)', () => {
  const KUNCI_VALID = 'hermes_marcom_test_key_123_panjang_cukup'

  beforeEach(() => {
    process.env.HERMES_MARCOM_API_KEY = KUNCI_VALID
  })

  it('menolak akses tanpa Authorization header dengan HTTP 401', async () => {
    const req = new NextRequest('http://localhost/api/hermes/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('menolak akses dengan token yang salah dengan HTTP 401', async () => {
    const req = new NextRequest('http://localhost/api/hermes/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer kunci_salah',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('menangani method initialize dengan protokol MCP', async () => {
    const req = new NextRequest('http://localhost/api/hermes/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KUNCI_VALID}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.result.serverInfo.name).toBe('suka-shawarma-marcom')
    expect(json.result.protocolVersion).toBe('2024-11-05')
  })

  it('mengembalikan 5 alat marcom pada tools/list', async () => {
    const req = new NextRequest('http://localhost/api/hermes/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KUNCI_VALID}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    const tools = json.result.tools
    expect(tools).toHaveLength(5)
    const names = tools.map((t: any) => t.name)
    expect(names).toContain('marcom_endorsement')
    expect(names).toContain('marcom_konten_jadwal')
    expect(names).toContain('marcom_ads_budget')
    expect(names).toContain('marcom_promo_aktif')
    expect(names).toContain('marcom_analisis_konten')
  })

  it('menangani tools/call untuk marcom_endorsement', async () => {
    const req = new NextRequest('http://localhost/api/hermes/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KUNCI_VALID}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'marcom_endorsement',
          arguments: {},
        },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.result.isError).toBe(false)
    expect(json.result.structuredContent.ringkasan).toBeDefined()
  })

  it('menolak tools/call untuk alat yang tidak dikenal dengan error -32602', async () => {
    const req = new NextRequest('http://localhost/api/hermes/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KUNCI_VALID}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'alat_gaib',
          arguments: {},
        },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.error.code).toBe(-32602)
  })

  const initReq = (token: string) =>
    new NextRequest('http://localhost/api/hermes/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'initialize', params: {} }),
    })

  it('KEAMANAN: kunci bawaan lama dari repo publik selalu ditolak', async () => {
    expect((await POST(initReq('hermes_marcom_dev_secret_key'))).status).toBe(401)
  })

  it('KEAMANAN: env kunci kosong -> semua ditolak 503, termasuk kunci bawaan lama', async () => {
    delete process.env.HERMES_MARCOM_API_KEY
    expect((await POST(initReq('hermes_marcom_dev_secret_key'))).status).toBe(503)
    expect((await POST(initReq(''))).status).toBe(503)
  })

  it('KEAMANAN: env kunci terlalu pendek dianggap belum dikonfigurasi', async () => {
    process.env.HERMES_MARCOM_API_KEY = 'pendek'
    expect((await POST(initReq('pendek'))).status).toBe(503)
  })

  it('mengembalikan status 405 untuk GET dan DELETE', () => {
    expect(GET().status).toBe(405)
    expect(DELETE().status).toBe(405)
  })
})
