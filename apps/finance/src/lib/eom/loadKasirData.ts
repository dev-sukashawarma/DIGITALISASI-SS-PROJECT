/* ── Pengambilan data EOM Kasir (server) ─────────────────────────────────────
 *
 * Select order & pemetaan SS Online DISALIN dari Rangkuman Penjualan
 * (apps/finance/src/app/laporan/penjualan/ReportsView.tsx, identik dengan
 * apps/admin-dashboard/src/lib/posReport/load.ts). Ubah bersamaan kalau salah
 * satunya berubah — bentuk order menentukan hasil rumus.
 */

import { TEST_OUTLET_ID, isTestOutlet } from '@/lib/outletFilters'
import { ambilRiwayatHpp } from '@/lib/hpp/riwayatHpp'

const ORDER_SELECT = 'id, order_number, status, payment_method, total_amount, discount_amount, promo_subsidy, created_at, outlet_id, channel, sales_source, customer_name, cashier_name, external_order_id, is_endorse, order_items(id, menu_item_id, menu_item_name, quantity, unit_price, subtotal, is_promo_reward, promo_id, promo_name, promo_buy_quantity, promo_get_quantity, original_unit_price, package_choices)'
const ECOMMERCE_SELECT = 'id, order_id, channel_id, total_amount, order_date, raw_data, ecommerce_sale_items(id, menu_id, quantity, price, subtotal, menu_items:menu_id(id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))))'
const MENU_SELECT = 'id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))'

const PAGE_SIZE = 1000
const DAY_CONCURRENCY = 6

async function fetchAllPages(buildQuery: () => any, label: string) {
  const all: any[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`${label}: ${error.message}`)
    const page = data ?? []
    all.push(...page)
    if (page.length < PAGE_SIZE) return all
  }
}

/** Satu baris ecommerce_sales → bentuk order (sama dengan Rangkuman Penjualan). */
function mapEcommerceSale(saleRecord: any) {
  const raw = saleRecord.raw_data || {}
  const totalPotongan = Math.abs(Number(raw.total_potongan || raw.admin_fee || raw.discount_amount) || 0)
  const omzetNet = Math.max(0, (Number(saleRecord.total_amount) || 0) - totalPotongan)
  return {
    id: saleRecord.id,
    order_number: 0,
    status: 'completed',
    payment_method: saleRecord.channel_id,
    total_amount: omzetNet,
    discount_amount: totalPotongan,
    promo_subsidy: 0,
    created_at: saleRecord.order_date,
    outlet_id: 'ss-online',
    channel: saleRecord.channel_id,
    sales_source: 'Online',
    customer_name: 'SS Online Customer',
    cashier_name: null,
    external_order_id: saleRecord.order_id,
    raw_data: raw,
    order_items: (saleRecord.ecommerce_sale_items || []).map((item: any) => ({
      id: item.id,
      menu_item_id: item.menu_id,
      menu_item_name: item.menu_items?.name || 'Unknown Item',
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.subtotal,
      package_choices: null,
      menu_items: item.menu_items,
    })),
  }
}

function dayRangeIso(date: string) {
  return {
    fromIso: new Date(`${date}T00:00:00.000+07:00`).toISOString(),
    toIso: new Date(`${date}T23:59:59.999+07:00`).toISOString(),
  }
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = []
  const d = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return results
}

export async function loadKasirData(supabase: any, from: string, to: string) {
  const { fromIso, toIso } = { fromIso: dayRangeIso(from).fromIso, toIso: dayRangeIso(to).toIso }

  const perDay = await mapWithConcurrency(eachDate(from, to), DAY_CONCURRENCY, async (date) => {
    const r = dayRangeIso(date)
    const [pos, ecommerce] = await Promise.all([
      fetchAllPages(
        () => supabase.from('orders').select(ORDER_SELECT)
          .neq('outlet_id', TEST_OUTLET_ID)
          .gte('created_at', r.fromIso).lte('created_at', r.toIso)
          .order('id', { ascending: false }),
        `orders ${date}`,
      ),
      fetchAllPages(
        () => supabase.from('ecommerce_sales').select(ECOMMERCE_SELECT)
          .gte('order_date', r.fromIso).lte('order_date', r.toIso)
          .order('id', { ascending: false }),
        `ecommerce_sales ${date}`,
      ),
    ])
    return [...pos, ...ecommerce.map(mapEcommerceSale)]
  })
  const orders = perDay.flat().filter((o: any) => !isTestOutlet(o.outlet_id))

  const [menuRes, outletsRes, riwayat, shifts, deposits] = await Promise.all([
    supabase.from('menu_items').select(MENU_SELECT),
    supabase.from('outlets').select('id, name, type, is_active').order('name'),
    ambilRiwayatHpp(supabase),
    fetchAllPages(
      () => supabase.from('shifts')
        .select('id, outlet_id, start_time, end_time, status, starting_cash, expected_ending_cash, actual_ending_cash, variance, expected_ending_petty_cash, actual_ending_petty_cash, petty_cash_variance, notes, staff:outlet_staff!shifts_staff_id_fkey(name)')
        .gte('start_time', fromIso).lte('start_time', toIso)
        .order('id', { ascending: true }),
      'shifts',
    ),
    fetchAllPages(
      () => supabase.from('cash_transaction')
        .select('id, outlet_id, amount, sales_date, occurred_at, status')
        .eq('source_type', 'cash_deposit')
        .in('status', ['reconciled', 'paid', 'approved'])
        .or(`and(sales_date.gte.${from},sales_date.lte.${to}),and(sales_date.is.null,occurred_at.gte.${fromIso},occurred_at.lte.${toIso})`)
        .order('id', { ascending: true }),
      'setoran',
    ),
  ])
  if (menuRes.error) throw new Error(`menu_items: ${menuRes.error.message}`)
  if (outletsRes.error) throw new Error(`outlets: ${outletsRes.error.message}`)

  const outlets = (outletsRes.data ?? []).filter((o: any) => !isTestOutlet(o))
  return {
    orders,
    menuItems: menuRes.data ?? [],
    outlets,
    riwayat,
    shifts: shifts.filter((s: any) => !isTestOutlet(s.outlet_id)),
    deposits,
  }
}
