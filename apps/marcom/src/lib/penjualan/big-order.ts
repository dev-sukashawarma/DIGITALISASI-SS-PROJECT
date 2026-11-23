export interface BigOrderLike {
  order_type?: string | null
  notes?: string | null
  scheduled_promo_names?: string[] | null
  sales_source?: string | null
  channel?: string | null
  is_endorse?: boolean | null
  discount_amount?: number | string | null
  total_amount?: number | string | null
}

/**
 * Menentukan apakah sebuah order adalah Big Order (diskon 15% dari total keranjang).
 * Prioritas utama: `order_type === 'big_order'` di database.
 * Fallback aman untuk order POS Offline: diskon tepat 15% dari subtotal
 * (`total_amount + discount_amount`) tanpa promo terjadwal lain.
 */
export function isBigOrder(order?: BigOrderLike | null): boolean {
  if (!order) return false
  const type = (order.order_type || '').trim().toLowerCase()
  if (type === 'big_order' || type === 'big-order' || type === 'bigorder') return true
  if (order.notes && /big\s*order/i.test(order.notes)) return true
  if (
    Array.isArray(order.scheduled_promo_names) &&
    order.scheduled_promo_names.some((n) => /big\s*order/i.test(String(n)))
  ) {
    return true
  }

  const salesSource = (order.sales_source || 'pos').trim().toLowerCase()
  const hasChannel = Boolean((order.channel || '').trim())
  const discount = Number(order.discount_amount) || 0
  const total = Number(order.total_amount) || 0

  if (
    (salesSource === 'pos' || salesSource === 'pos_kasir') &&
    !hasChannel &&
    !order.is_endorse &&
    discount > 0 &&
    total > 0 &&
    (!order.scheduled_promo_names || order.scheduled_promo_names.length === 0)
  ) {
    const subtotal = total + discount
    if (Math.abs(Math.round(subtotal * 0.15) - Math.round(discount)) <= 1) {
      return true
    }
  }

  return false
}
