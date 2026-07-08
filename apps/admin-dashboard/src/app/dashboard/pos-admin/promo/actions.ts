'use server'

import { createClient } from '@/lib/supabase/server'

export async function savePromosAction(
  outlets: { id: string }[],
  promos: any[]
) {
  const supabase = await createClient()

  if (!outlets || outlets.length === 0) {
    throw new Error('Tidak ada outlet aktif untuk diterapkan promo.')
  }

  for (const outlet of outlets) {
    // Ambil data promo existing untuk outlet ini
    const { data: existingPromos, error: fetchError } = await supabase
      .from('outlet_promos')
      .select('id, scope, menu_item_id')
      .eq('outlet_id', outlet.id)

    if (fetchError) throw fetchError

    // Siapkan data upsert (array of objects)
    const toUpsert = promos.map(p => {
      const existing = existingPromos?.find(ep => ep.scope === p.scope && ep.menu_item_id === p.menu_item_id)
      return {
        ...(existing ? { id: existing.id } : {}),
        outlet_id: outlet.id,
        scope: p.scope,
        menu_item_id: p.menu_item_id,
        discount_type: p.discount_type,
        discount_value: p.discount_value,
        is_active: p.is_active,
        min_purchase: p.min_purchase,
        end_date: p.end_date
      }
    })

    // Upsert sekaligus dalam 1 query per outlet
    const { error: upsertError } = await supabase
      .from('outlet_promos')
      .upsert(toUpsert)

    if (upsertError) {
      console.error('Upsert Error:', upsertError)
      throw upsertError
    }
  }

  return { success: true }
}
