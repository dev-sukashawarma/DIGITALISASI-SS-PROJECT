import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function inspectCiseengBS2() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const ciseengOutlet = outlets?.find(o => o.name.toLowerCase().includes('ciseeng'))

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', ciseengOutlet.id)
    .eq('channel', 'tiktokgo')
    .gte('created_at', '2026-08-14T00:00:00+07:00')
    .lt('created_at', '2026-08-15T00:00:00+07:00')
    .order('created_at', { ascending: true })

  const bs2Orders = orders?.filter(o => o.order_items.some(i => i.menu_item_name.toLowerCase().includes('best seller 2')))

  console.log("BEST SELLER 2 ORDERS IN DB:")
  bs2Orders?.forEach(o => {
    console.log(`Order #${o.order_number} (${o.id}) - Time: ${o.created_at} - Total: Rp ${o.total_amount}`)
    o.order_items.forEach(i => {
      console.log(`  Item: ${i.quantity}x ${i.menu_item_name} @ Rp ${i.unit_price} (Subtotal: Rp ${i.subtotal})`)
    })
  })
}

inspectCiseengBS2()
