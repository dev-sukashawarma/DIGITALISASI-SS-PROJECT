import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'
import { groupPromoRows } from '@/lib/promoOutlets'
import PromoView from './PromoView'

export const dynamic = 'force-dynamic'

export default async function AdminPromoPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  let orderOnline: any = null
  try {
    orderOnline = createOrderOnlineAdminClient()
  } catch (err) {
    console.warn('Order Online client not configured, skipping sync checks.')
  }

  // Fetch data in parallel
  const [menuRes, outletsRes, ooPromosRes] = await Promise.all([
    supabase.from('menu_items').select('id, name, price, image_url, outlet_id, is_package').eq('is_available', true).order('sort_order'),
    supabase.from('outlets').select('id, name').eq('is_active', true).order('name'),
    orderOnline
      ? (async () => {
          try {
            const res = await orderOnline.from('promos').select('applies_to, item_ids, outlet_ids')
            return res
          } catch (e) {
            return { data: [] }
          }
        })()
      : Promise.resolve({ data: [] })
  ])

  const initialMenuItems = menuRes.data || []
  const initialOutlets = outletsRes.data || []
  const ooPromos = ooPromosRes.data || []

  let initialPromos: any[] = []
  if (initialOutlets.length > 0) {
    const outletIds = initialOutlets.map(outlet => outlet.id)
    const promoRes = await supabase
      .from('outlet_promos')
      .select('*')
      .in('outlet_id', outletIds)

    // Satu promo yang dilihat admin = kumpulan baris per outlet yang
    // konfigurasinya identik. Baris dengan konfigurasi berbeda pada scope +
    // menu yang sama tampil sebagai promo terpisah dengan outletnya sendiri.
    initialPromos = groupPromoRows(promoRes.data || [], outletIds).map((group, index) => {
      const p: any = group.representative

      // Sudah tersinkron ke Order Online? Promo Order Online menyimpan daftar
      // outletnya; kalau kolom itu kosong (data lama) dianggap mencakup semua.
      let isSynced = false
      if (ooPromos && ooPromos.length > 0) {
        isSynced = ooPromos.some((oop: any) => {
          const sameKey =
            (p.scope === 'global' && oop.applies_to === 'all') ||
            (p.scope === 'item' && oop.applies_to === 'item' && oop.item_ids?.includes(p.menu_item_id))
          if (!sameKey) return false
          if (!Array.isArray(oop.outlet_ids) || oop.outlet_ids.length === 0) return true
          return group.outletIds.some(id => oop.outlet_ids.includes(id))
        })
      }

      return {
        ...p,
        group_id: `${group.key}#${index}`,
        outlet_ids: group.outletIds,
        current_usage: group.currentUsage,
        discount_value: p.discount_value === 0.01 ? 0 : p.discount_value,
        sync_to_order_online: isSynced
      }
    })
  }

  return (
    <PromoView
      initialMenuItems={initialMenuItems}
      initialOutlets={initialOutlets}
      initialPromos={initialPromos}
    />
  )
}
