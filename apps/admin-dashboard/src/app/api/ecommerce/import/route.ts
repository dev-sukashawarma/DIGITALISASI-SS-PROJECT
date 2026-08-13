// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body = await request.json()
    const { entity_id, channel_id, orders } = body

    if (!entity_id || !channel_id || !orders || !Array.isArray(orders)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // GUDANG PUSAT (HQ)
    const { data: gudang } = await supabase
      .from('outlets')
      .select('id')
      .ilike('name', '%gudang%')
      .single()
    const gudangId = gudang?.id

    // get menus to map SKUs or names
    const { data: menus } = await supabase.from('menu_items').select('id, name')
    const menuMap = new Map(menus?.map(m => [m.name.toLowerCase(), m.id]))

    // Helper: normalize date to ISO - frontend sends ISO strings, but handle edge cases
    const sanitizeDate = (dateVal: any): string => {
      if (!dateVal) return new Date().toISOString()
      if (typeof dateVal === 'string') {
        const parsed = new Date(dateVal)
        return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
      }
      if (typeof dateVal === 'number') {
        // Excel serial fallback
        return new Date((dateVal - 25569) * 86400 * 1000).toISOString()
      }
      return new Date().toISOString()
    }

    // Find existing orders to prevent duplicates
    const refNos = orders.map((o: any) => o.id)
    const { data: existingSales } = await supabase
      .from('ecommerce_sales')
      .select('order_id')
      .in('order_id', refNos)
    
    const existingSet = new Set(existingSales?.map(e => e.order_id) || [])
    const newOrders = orders.filter((o: any) => !existingSet.has(o.id))

    if (newOrders.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'All orders already exist.' })
    }

    const salesToInsert = newOrders.map((o: any) => ({
      entity_id,
      channel_id,
      order_id: o.id,
      order_date: sanitizeDate(o.date),
      total_amount: o.total,
      raw_data: o
    }))

    const { data: insertedSales, error: salesError } = await supabase
      .from('ecommerce_sales')
      .insert(salesToInsert)
      .select('id, order_id')

    if (salesError) {
      throw new Error(`Failed to insert sales: ${salesError.message}`)
    }

    const insertedMap = new Map(insertedSales?.map(s => [s.order_id, s.id]))
    const itemsToInsert: any[] = []
    const itemTotals = new Map<string, number>()

    for (const order of newOrders) {
      const saleId = insertedMap.get(order.id)
      if (!saleId) continue

      for (const item of order.items) {
        // match by product name first, since SKU might be mismatched or named differently
        const searchName = item.product_name?.toLowerCase() || ''
        const searchSku = item.sku_name?.toLowerCase() || ''
        
        let menuId = null
        // Find best match in menus
        for (const [name, id] of menuMap.entries()) {
          if (searchName.includes(name) || searchSku.includes(name)) {
            menuId = id
            break
          }
        }

        if (menuId) {
          itemsToInsert.push({
            sale_id: saleId,
            menu_id: menuId,
            quantity: item.qty,
            price: item.unit_price,
            subtotal: item.subtotal
          })

          itemTotals.set(menuId, (itemTotals.get(menuId) || 0) + item.qty)
        }
      }
    }

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase.from('ecommerce_sale_items').insert(itemsToInsert)
      if (itemsError) console.error('Error inserting items:', itemsError)
    }

    // Process stock deduction based on itemTotals
    if (body.deduct_stock === true && gudangId && itemTotals.size > 0) {
      const menuIds = Array.from(itemTotals.keys())
      const { data: recipes } = await supabase
        .from('resep')
        .select('id, menu_item_ref')
        .in('menu_item_ref', menuIds)
        .eq('is_active', true)
        .eq('scope', 'global')

      if (recipes && recipes.length > 0) {
        const recipeIds = recipes.map(r => r.id)
        const { data: resepItems } = await supabase
          .from('resep_item')
          .select('resep_id, bahan_baku_id, qty_per_porsi, bahan_baku(faktor_konversi)')
          .in('resep_id', recipeIds)

        const ledgerInserts: any[] = []
        
        for (const recipe of recipes) {
          const qtySold = itemTotals.get(recipe.menu_item_ref) || 0
          const items = resepItems?.filter(ri => ri.resep_id === recipe.id) || []

          for (const ri of items) {
            const faktor = ri.bahan_baku?.faktor_konversi || 1
            const deduction = -(ri.qty_per_porsi * qtySold / faktor)
            
            ledgerInserts.push({
              outlet_id: gudangId,
              bahan_baku_id: ri.bahan_baku_id,
              tipe: 'pemakaian',
              qty: deduction,
              catatan: `Import Penjualan E-Commerce (Total: ${qtySold} porsi)`,
              created_at: new Date().toISOString()
            })
          }
        }

        if (ledgerInserts.length > 0) {
          const { error: ledgerError } = await supabase.from('ledger_stok').insert(ledgerInserts)
          if (ledgerError) console.error('Error deducting stock:', ledgerError)
        }
      }
    }

    return NextResponse.json({ success: true, processed: newOrders.length })
  } catch (error: any) {
    console.error('Import Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
