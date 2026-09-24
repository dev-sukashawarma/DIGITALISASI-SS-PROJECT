import { getPosSupabase } from '@/lib/supabase-pos'
import { groupPromoRows } from '@/lib/promoOutlets'
import PromoView from './PromoView'

export const dynamic = 'force-dynamic'

export default async function MarcomPromoPage() {
  const supabase = getPosSupabase()

  // Ambil data menu aktif dan outlet aktif
  const [menuRes, outletsRes] = await Promise.all([
    supabase
      .from('menu_items')
      .select('id, name, price')
      .eq('is_available', true)
      .order('sort_order'),
    supabase.from('outlets').select('id, name').eq('is_active', true).order('name'),
  ])

  const initialMenuItems = menuRes.data || []
  const initialOutlets = outletsRes.data || []

  let initialPromos: any[] = []
  if (initialOutlets.length > 0) {
    const outletIds = initialOutlets.map((outlet) => outlet.id)
    const promoRes = await supabase.from('outlet_promos').select('*').in('outlet_id', outletIds)

    initialPromos = groupPromoRows(promoRes.data || [], outletIds).map((group) => {
      const p: any = group.representative

      return {
        ...p,
        outlet_ids: group.outletIds,
        current_usage: group.currentUsage,
        discount_value: p.discount_value === 0.01 ? 0 : p.discount_value,
      }
    })
  }

  return (
    <div className="py-2">
      <PromoView
        initialMenuItems={initialMenuItems}
        initialOutlets={initialOutlets}
        initialPromos={initialPromos}
      />
    </div>
  )
}
