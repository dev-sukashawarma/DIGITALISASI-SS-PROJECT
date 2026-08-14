const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  // Get an order with its items
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id, total_amount, channel, discount_amount, promo_subsidy,
      order_items (
        id, menu_item_name, quantity, unit_price, subtotal, menu_item_id
      )
    `)
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (error) {
    console.error(error)
    return
  }

  // Find a good order with multiple items if possible
  const bestOrder = order.find(o => o.order_items.length > 0) || order[0]
  console.log('--- ORDER ---')
  console.log(bestOrder)

  // Get HPP for those items from resep table
  if (bestOrder && bestOrder.order_items.length > 0) {
    const itemIds = bestOrder.order_items.map(i => i.menu_item_id).filter(id => id != null)
    
    if (itemIds.length > 0) {
      const { data: resepData } = await supabase
        .from('resep')
        .select('menu_item_ref, total_hpp')
        .in('menu_item_ref', itemIds)
      
      console.log('--- RESEP HPP ---')
      console.log(resepData)
    }
  }
}

run()
