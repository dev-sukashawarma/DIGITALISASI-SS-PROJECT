import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'
import * as auth from '@/lib/auth'
import * as supabase from '@/lib/supabase'

vi.mock('@/lib/auth')
vi.mock('@/lib/supabase')

describe('API /api/v1/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('menolak permintaan tanpa sesi (401)', async () => {
    vi.mocked(auth.requireCustomer).mockResolvedValue(null)
    const req = new Request('https://retail.sukashawarma.com/api/v1/notifications')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('mengembalikan daftar notifikasi dan unread count jika sesi sah', async () => {
    vi.mocked(auth.requireCustomer).mockResolvedValue({ customerId: 'cust-123' })

    const mockNotifications = [
      {
        id: 'notif-1',
        customer_id: 'cust-123',
        order_id: 'order-1',
        type: 'order_status',
        title: 'Pesanan Diterima',
        body: 'Sedang disiapkan',
        data: {},
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]

    const mockRetailClient = {
      from: vi.fn((table: string) => {
        if (table === 'customer_notifications') {
          return {
            select: vi.fn((cols: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.head) {
                return {
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
                  }),
                }
              }
              return {
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
                  }),
                }),
              }
            }),
          }
        }
        return {}
      }),
    }

    vi.mocked(supabase.createRetailClient).mockReturnValue(mockRetailClient as any)

    const req = new Request('https://retail.sukashawarma.com/api/v1/notifications?category=all')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.unread_count).toBe(1)
    expect(body.notifications).toHaveLength(1)
    expect(body.notifications[0].title).toBe('Pesanan Diterima')
  })

  it('menandai semua notifikasi telah dibaca lewat POST { mark_all: true }', async () => {
    vi.mocked(auth.requireCustomer).mockResolvedValue({ customerId: 'cust-123' })

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    const mockRetailClient = {
      from: vi.fn(() => ({
        update: mockUpdate,
      })),
    }

    vi.mocked(supabase.createRetailClient).mockReturnValue(mockRetailClient as any)

    const req = new Request('https://retail.sukashawarma.com/api/v1/notifications', {
      method: 'POST',
      body: JSON.stringify({ mark_all: true }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.marked_all).toBe(true)
  })
})
