import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatNotificationTime,
  filterNotificationsByCategory,
  type CustomerNotificationItem,
} from './notifications'

describe('notifications library', () => {
  const dummyNotifs: CustomerNotificationItem[] = [
    {
      id: '1',
      customer_id: 'cust-1',
      order_id: 'order-1',
      type: 'order_status',
      title: 'Pesanan Diterima',
      body: 'Pesananmu sedang disiapkan dapur',
      data: { status: 'preparing' },
      is_read: false,
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      customer_id: 'cust-1',
      order_id: 'order-1',
      type: 'reminder',
      title: 'Pengingat Pengambilan',
      body: 'Pesananmu siap diambil',
      data: { status: 'ready' },
      is_read: true,
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      customer_id: 'cust-1',
      order_id: null,
      type: 'promo',
      title: 'Diskon Spesial',
      body: 'Dapatkan diskon 20% hari ini',
      data: {},
      is_read: false,
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
  ]

  it('filters notifications by category correctly', () => {
    expect(filterNotificationsByCategory(dummyNotifs, 'all')).toHaveLength(3)
    
    const orderNotifs = filterNotificationsByCategory(dummyNotifs, 'orders')
    expect(orderNotifs).toHaveLength(2)
    expect(orderNotifs.map((n) => n.id)).toEqual(['1', '2'])

    const promoNotifs = filterNotificationsByCategory(dummyNotifs, 'promos')
    expect(promoNotifs).toHaveLength(1)
    expect(promoNotifs[0].id).toBe('3')
  })

  it('formats notification time in readable Indonesian', () => {
    const now = new Date()
    expect(formatNotificationTime(now.toISOString())).toBe('Baru saja')

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    expect(formatNotificationTime(tenMinAgo)).toBe('10 mnt lalu')

    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString()
    expect(formatNotificationTime(threeHoursAgo)).toBe('3 jam lalu')
  })
})
