import type { SupabaseClient } from '@supabase/supabase-js'

export interface CustomerNotificationItem {
  id: string
  customer_id: string
  order_id: string | null
  type: 'order_status' | 'reminder' | 'promo' | 'system'
  title: string
  body: string
  data: Record<string, unknown>
  is_read: boolean
  created_at: string
}

export interface NotificationPreferences {
  notify_order_status: boolean
  notify_promotions: boolean
}

/**
 * Filter notifikasi berdasarkan tab kategori (all, orders, promos).
 */
export function filterNotificationsByCategory(
  items: CustomerNotificationItem[],
  category: 'all' | 'orders' | 'promos' = 'all'
): CustomerNotificationItem[] {
  if (category === 'orders') {
    return items.filter((it) => it.type === 'order_status' || it.type === 'reminder')
  }
  if (category === 'promos') {
    return items.filter((it) => it.type === 'promo')
  }
  return items
}

/**
 * Format timestamp ISO ke teks relatif Bahasa Indonesia.
 */
export function formatNotificationTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diffMs / (60 * 1000))
  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `${minutes} mnt lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} hr lalu`
  return new Date(isoString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Menyisipkan notifikasi ke riwayat pelanggan di database.
 */
export async function insertCustomerNotification(
  // Skema `retail`, bukan `public`. `SupabaseClient` polos berarti skema
  // `public` di tipenya, dan ketiga pemanggil mengoper createRetailClient()
  // -- itu yang membuat build gagal type-check di Docker.
  retail: SupabaseClient<any, any, any>,
  input: {
    customerId: string
    orderId?: string | null
    type: 'order_status' | 'reminder' | 'promo' | 'system'
    title: string
    body: string
    data?: Record<string, unknown>
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Cegah duplikasi notifikasi status yang sama untuk order yang sama (< 15 detik)
    if (input.orderId && input.data?.status) {
      const { data: existing } = await retail
        .from('customer_notifications')
        .select('id')
        .eq('order_id', input.orderId)
        .eq('type', input.type)
        .filter('data->>status', 'eq', String(input.data.status))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        return { success: true, id: existing.id }
      }
    }

    const { data, error } = await retail
      .from('customer_notifications')
      .insert({
        customer_id: input.customerId,
        order_id: input.orderId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('Gagal mencatat notifikasi:', error)
      return { success: false, error: error.message }
    }
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('Error insertCustomerNotification:', err)
    return { success: false, error: String(err) }
  }
}
