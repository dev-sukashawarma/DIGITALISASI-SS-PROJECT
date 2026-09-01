import type { ItemPesanan } from './pricing'

/**
 * Menyusun argumen untuk RPC atomic_insert_order.
 *
 * Aturan yang tidak boleh dilanggar:
 * - order_number TIDAK disertakan; trigger database yang menetapkannya.
 * - Catatan item ditulis `nama|NOTE|catatan`, konvensi yang sudah dipakai
 *   struk dapur. Format baru akan mengacaukan cetakan dapur.
 */
export function susunPayloadPos(input: {
  clientOrderId: string
  outletId: string
  customerName: string
  customerPhone: string | null
  items: ItemPesanan[]
  subtotal: number
  discountAmount: number
  total: number
  pickupCode: string
}): { p_order: Record<string, unknown>; p_items: Record<string, unknown>[] } {
  const sekarang = new Date().toISOString()

  const p_order: Record<string, unknown> = {
    outlet_id: input.outletId,
    client_order_id: input.clientOrderId,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    cashier_name: null,
    notes: `Pesanan aplikasi. Kode ambil: ${input.pickupCode}`,
    payment_method: 'qris',
    total_amount: input.total,
    discount_amount: input.discountAmount,
    promo_subsidy: 0,
    status: 'preparing',
    kitchen_receipt_printed: false,
    source: 'app',
    channel: 'app',
    sales_source: 'app',
    // `external_order_id` SENGAJA TIDAK DIISI. Trigger BOM punya penjaga
    // `IF NEW.external_order_id IS NOT NULL THEN RETURN NEW` (tiga migration:
    // 20260725000000, 20300103000008, 20300103000010) untuk melewati impor
    // historis Pawoon. Mengisinya di sini membuat SETIAP pesanan aplikasi
    // dilewati trigger, sehingga stok bahan baku tidak pernah terpotong —
    // uang masuk, makanan keluar, sistem tidak tahu. Idempotensi tidak
    // membutuhkannya: `orders.client_order_id` sudah berkendala UNIQUE dan
    // itulah yang dipakai jalur 23505 di webhook.
    created_at: sekarang,
    updated_at: sekarang,
  }

  const p_items = input.items.map((it) => ({
    menu_item_id: it.menu_item_id,
    menu_item_name: it.note ? `${it.name}|NOTE|${it.note}` : it.name,
    quantity: it.quantity,
    unit_price: it.unit_price,
    subtotal: it.unit_price * it.quantity,
    package_choices: null,
  }))

  return { p_order, p_items }
}
