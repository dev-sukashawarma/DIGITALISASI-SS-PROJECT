import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { POST as updateStatusPOST } from '../app/api/orders/update-status/route'
import { POST as notifyCancelPOST } from '../app/api/orders/notify-online-cancel/route'
import { createServiceClient } from '../lib/supabase/server'
import dotenv from 'dotenv'
import path from 'path'

// Mock next/headers so cookies() doesn't throw outside Next.js request lifecycle
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    setAll: () => {},
  }),
}))

describe('Two-way Order Status Sync API Routes', () => {
  let db: any
  let testOutletId: string
  let testOrderId: string
  let testExternalOrderId: string

  const secretToken = process.env.ORDER_TO_KASIR_SECRET || 'test-order-to-kasir-secret'
  const kasirToOrderSecret = process.env.KASIR_TO_ORDER_SECRET || 'test-kasir-to-order-secret'
  const orderSystemNotifyUrl = process.env.ORDER_SYSTEM_NOTIFY_URL || 'http://test-supabase.co/functions/v1/kasir-order-done'

  beforeAll(async () => {
    // Load .env.local variables manually
    dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

    // Set fallback environment variables for test execution if not defined
    if (!process.env.ORDER_TO_KASIR_SECRET) {
      process.env.ORDER_TO_KASIR_SECRET = secretToken
    }
    if (!process.env.KASIR_TO_ORDER_SECRET) {
      process.env.KASIR_TO_ORDER_SECRET = kasirToOrderSecret
    }
    if (!process.env.ORDER_SYSTEM_NOTIFY_URL) {
      process.env.ORDER_SYSTEM_NOTIFY_URL = orderSystemNotifyUrl
    }
    if (!process.env.NEXT_PUBLIC_SS_ORDER_URL) {
      process.env.NEXT_PUBLIC_SS_ORDER_URL = 'http://test-supabase.co'
    }
    if (!process.env.SS_ORDER_SERVICE_KEY) {
      process.env.SS_ORDER_SERVICE_KEY = 'test-ss-order-service-key'
    }

    db = createServiceClient()

    // 1. Get or create an outlet for tests
    const { data: outlets } = await db.from('outlets').select('id').limit(1)
    if (outlets && outlets.length > 0) {
      testOutletId = outlets[0].id
    } else {
      const { data: newOutlet, error } = await db
        .from('outlets')
        .insert({ name: 'Test Sync Outlet' })
        .select()
        .single()
      if (error || !newOutlet) {
        throw new Error(`Failed to create test outlet: ${error?.message || 'Unknown error'}`)
      }
      testOutletId = newOutlet.id
    }

    // 2. Insert a temporary online order for update-status and notify-online-cancel tests
    testExternalOrderId = 'test-ext-id-' + Math.random().toString(36).substring(7)
    const { data: order, error } = await db
      .from('orders')
      .insert({
        outlet_id: testOutletId,
        customer_name: 'Test Customer',
        customer_phone: '081234567890',
        payment_method: 'qris',
        total_amount: 50000,
        status: 'preparing',
        source: 'online',
        external_order_id: testExternalOrderId,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create test order: ${error.message}`)
    }
    testOrderId = order.id
  })

  afterAll(async () => {
    // Cleanup the test order
    if (testOrderId) {
      await db.from('orders').delete().eq('id', testOrderId)
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('POST /api/orders/update-status', () => {
    it('returns 403 if x-internal-token header is missing', async () => {
      const req = new Request('http://localhost:3000/api/orders/update-status', {
        method: 'POST',
        body: JSON.stringify({ external_order_id: testExternalOrderId, status: 'completed' }),
      })
      const res = await updateStatusPOST(req)
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toBe('Forbidden')
    })

    it('returns 403 if x-internal-token header is invalid', async () => {
      const req = new Request('http://localhost:3000/api/orders/update-status', {
        method: 'POST',
        headers: { 'x-internal-token': 'wrong-secret-token' },
        body: JSON.stringify({ external_order_id: testExternalOrderId, status: 'completed' }),
      })
      const res = await updateStatusPOST(req)
      expect(res.status).toBe(403)
    })

    it('returns 400 if required fields are missing', async () => {
      const req = new Request('http://localhost:3000/api/orders/update-status', {
        method: 'POST',
        headers: { 'x-internal-token': process.env.ORDER_TO_KASIR_SECRET! },
        body: JSON.stringify({ external_order_id: testExternalOrderId }), // status missing
      })
      const res = await updateStatusPOST(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 if status is invalid', async () => {
      const req = new Request('http://localhost:3000/api/orders/update-status', {
        method: 'POST',
        headers: { 'x-internal-token': process.env.ORDER_TO_KASIR_SECRET! },
        body: JSON.stringify({ external_order_id: testExternalOrderId, status: 'preparing' }), // invalid status for sync update
      })
      const res = await updateStatusPOST(req)
      expect(res.status).toBe(400)
    })

    it('returns 404 if external_order_id does not exist', async () => {
      const req = new Request('http://localhost:3000/api/orders/update-status', {
        method: 'POST',
        headers: { 'x-internal-token': process.env.ORDER_TO_KASIR_SECRET! },
        body: JSON.stringify({ external_order_id: 'non-existent-uuid', status: 'completed' }),
      })
      const res = await updateStatusPOST(req)
      expect(res.status).toBe(404)
    })

    it('updates status and returns 200 if valid', async () => {
      const req = new Request('http://localhost:3000/api/orders/update-status', {
        method: 'POST',
        headers: { 'x-internal-token': process.env.ORDER_TO_KASIR_SECRET! },
        body: JSON.stringify({ external_order_id: testExternalOrderId, status: 'completed' }),
      })
      const res = await updateStatusPOST(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)

      // Verify DB update
      const { data: order } = await db.from('orders').select('status').eq('id', testOrderId).single()
      expect(order.status).toBe('completed')
    })

    it('is idempotent when updating to same status', async () => {
      const req = new Request('http://localhost:3000/api/orders/update-status', {
        method: 'POST',
        headers: { 'x-internal-token': process.env.ORDER_TO_KASIR_SECRET! },
        body: JSON.stringify({ external_order_id: testExternalOrderId, status: 'completed' }),
      })
      const res = await updateStatusPOST(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.message).toContain('idempoten')
    })
  })

  describe('POST /api/orders/notify-online-cancel', () => {
    it('returns 400 if order_id is missing', async () => {
      const req = new Request('http://localhost:3000/api/orders/notify-online-cancel', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const res = await notifyCancelPOST(req)
      expect(res.status).toBe(400)
    })

    it('skips and returns 200 with skipped: true if order does not exist', async () => {
      const req = new Request('http://localhost:3000/api/orders/notify-online-cancel', {
        method: 'POST',
        body: JSON.stringify({ order_id: '00000000-0000-0000-0000-000000000000' }),
      })
      const res = await notifyCancelPOST(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.skipped).toBe(true)
    })

    it('forwards notification to online system and returns 200', async () => {
      // Mock global fetch but allow Supabase pass-through for other tests
      const originalFetch = globalThis.fetch
      const fetchSpy = vi.fn().mockImplementation(async (url, init) => {
        if (typeof url === 'string' && url.includes(process.env.NEXT_PUBLIC_SS_ORDER_URL!)) {
          return {
            ok: true,
            status: 200,
            json: async () => ([]),
            text: async () => '[]',
            headers: { get: () => null },
          }
        }
        return originalFetch(url, init)
      })
      vi.stubGlobal('fetch', fetchSpy)

      const req = new Request('http://localhost:3000/api/orders/notify-online-cancel', {
        method: 'POST',
        body: JSON.stringify({ order_id: testOrderId }),
      })
      const res = await notifyCancelPOST(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)

      // Expect that it called the Supabase REST API on the target URL
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(process.env.NEXT_PUBLIC_SS_ORDER_URL!),
        expect.objectContaining({
          method: 'PATCH', // Supabase update uses PATCH
          body: expect.stringContaining('"status":"cancelled"'),
        })
      )
    })

    it('returns 502 if online system returns an error', async () => {
      const originalFetch = globalThis.fetch
      const fetchSpy = vi.fn().mockImplementation(async (url, init) => {
        if (typeof url === 'string' && url.includes(process.env.NEXT_PUBLIC_SS_ORDER_URL!)) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: 'Internal Server Error' }),
            text: async () => 'Internal Server Error',
          }
        }
        return originalFetch(url, init)
      })
      vi.stubGlobal('fetch', fetchSpy)

      const req = new Request('http://localhost:3000/api/orders/notify-online-cancel', {
        method: 'POST',
        body: JSON.stringify({ order_id: testOrderId }),
      })
      const res = await notifyCancelPOST(req)
      expect(res.status).toBe(502)
    })
  })
})
