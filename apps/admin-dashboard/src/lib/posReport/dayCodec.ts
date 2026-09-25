// @ts-nocheck
/* ── Format ringkas order per hari untuk cache server ─────────────────────
 *
 * Cache data Next.js menolak entri > 2 MB. Satu hari tersibuk (1.269 order,
 * 20 Sep 2026) ±1,2 MB sebagai JSON biasa — terlalu mepet. Nama kolom yang
 * berulang di setiap baris adalah sebagian besar ukurannya, jadi order & item
 * disimpan sebagai tuple (array posisi tetap). Hasil decode identik dengan
 * baris aslinya untuk semua kolom yang dipakai laporan.
 */

const ORDER_FIELDS = [
  'id', 'order_number', 'status', 'payment_method', 'total_amount', 'discount_amount',
  'promo_subsidy', 'created_at', 'outlet_id', 'channel', 'sales_source', 'customer_name',
  'cashier_name', 'external_order_id', 'is_endorse', 'raw_data',
] as const

const ITEM_FIELDS = [
  'id', 'menu_item_id', 'menu_item_name', 'quantity', 'unit_price', 'subtotal',
  'is_promo_reward', 'promo_id', 'promo_name', 'promo_buy_quantity', 'promo_get_quantity',
  'original_unit_price', 'package_choices', 'menu_items',
] as const

export const DAY_CODEC_VERSION = 1

export type EncodedDay = { v: number; o: any[][] }

function pack(obj: any, fields: readonly string[]) {
  const row = fields.map((f) => (obj[f] === undefined ? null : obj[f]))
  // Buang null di ujung — banyak kolom opsional kosong.
  let end = row.length
  while (end > 0 && row[end - 1] === null) end--
  return row.slice(0, end)
}

function unpack(row: any[], fields: readonly string[], keepUndefined: Set<string>) {
  const obj: any = {}
  fields.forEach((f, i) => {
    const v = i < row.length ? row[i] : null
    // Kolom yang aslinya tidak diambil (mis. raw_data pada order POS) tetap
    // tidak ada, bukan null — perilaku laporan membedakan keduanya di beberapa tempat.
    if (v === null && keepUndefined.has(f)) return
    obj[f] = v
  })
  return obj
}

const ORDER_OPTIONAL = new Set(['raw_data'])
const ITEM_OPTIONAL = new Set(['menu_items'])

export function encodeDay(orders: any[]): EncodedDay {
  return {
    v: DAY_CODEC_VERSION,
    o: orders.map((o) => {
      const row = pack(o, ORDER_FIELDS)
      const items = (o.order_items || []).map((it: any) => pack(it, ITEM_FIELDS))
      return [row, items]
    }),
  }
}

export function decodeDay(enc: EncodedDay | null | undefined): any[] {
  if (!enc || enc.v !== DAY_CODEC_VERSION || !Array.isArray(enc.o)) return []
  return enc.o.map(([row, items]) => {
    const o = unpack(row, ORDER_FIELDS, ORDER_OPTIONAL)
    o.order_items = (items || []).map((it: any[]) => unpack(it, ITEM_FIELDS, ITEM_OPTIONAL))
    return o
  })
}
