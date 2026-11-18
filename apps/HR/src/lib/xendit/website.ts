const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i

/**
 * Pesanan website (sistem Order Online, dibayar lewat Xendit): sales_source 'online'
 * dengan external_order_id berupa UUID pesanan Order Online. Pesanan online lain
 * (GrabFood "F-…", TikTok berangka panjang, ShopeeFood "…-C8J…") bukan website.
 */
export function isPesananWebsite(o: { sales_source?: string | null; external_order_id?: string | null }): boolean {
  return (o.sales_source ?? '') === 'online' && UUID.test(o.external_order_id ?? '')
}
