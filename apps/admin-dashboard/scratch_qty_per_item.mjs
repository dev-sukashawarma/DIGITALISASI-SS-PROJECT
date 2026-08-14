import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function getQtyPerItem() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const bejiOutlet = outlets?.find(o => o.name.toLowerCase().includes('beji'))

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, order_items(menu_item_name, quantity, unit_price)')
    .eq('outlet_id', bejiOutlet.id)
    .eq('channel', 'tiktokgo')
    .gte('created_at', '2026-08-13T00:00:00+07:00')
    .lt('created_at', '2026-08-14T00:00:00+07:00')

  if (error) {
    console.error(error)
    return
  }

  const summary = {}

  orders.forEach(order => {
    order.order_items.forEach(item => {
      // Clean item name (remove |ID|...)
      const cleanName = item.menu_item_name.split('|')[0].trim()
      if (!summary[cleanName]) {
        summary[cleanName] = {
          qty: 0,
          unit_price: item.unit_price,
          total_val: 0
        }
      }
      summary[cleanName].qty += item.quantity
      summary[cleanName].total_val += (item.quantity * item.unit_price)
    })
  })

  console.log("REKAP QTY PER ITEM:", JSON.stringify(summary, null, 2))
}

getQtyPerItem()
