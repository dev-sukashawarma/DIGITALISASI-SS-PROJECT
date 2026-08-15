import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function fixMerge() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const empangOutlet = outlets?.find(o => o.name.toLowerCase().includes('empang'))

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, total_amount')
    .eq('outlet_id', empangOutlet.id)
    .eq('channel', 'tiktokgo')
    .in('order_number', [49, 50])
    .gte('created_at', '2026-08-13T00:00:00+07:00')
    .lt('created_at', '2026-08-14T00:00:00+07:00')

  console.log("Found 49/50:", orders)

  const o49 = orders?.find(o => o.order_number === 49)
  const o50 = orders?.find(o => o.order_number === 50)

  if (o50) {
    await supabase.from('order_items').delete().eq('order_id', o50.id)
    await supabase.from('orders').delete().eq('id', o50.id)
    console.log(" Deleted Order #50")
  }

  if (o49) {
    await supabase.from('orders').update({ total_amount: 68000 }).eq('id', o49.id)
    await supabase.from('order_items').update({ quantity: 2, subtotal: 68000 }).eq('order_id', o49.id)
    console.log(" Updated Order #49 to 2x Best Seller 2 (Rp 68.000)")
  }
}

fixMerge()
