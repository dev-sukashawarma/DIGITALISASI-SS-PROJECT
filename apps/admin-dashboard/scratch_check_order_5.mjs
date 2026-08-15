import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function checkOrder5() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const bejiOutlet = outlets?.find(o => o.name.toLowerCase().includes('beji'))

  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', bejiOutlet.id)
    .eq('channel', 'tiktokgo')
    .eq('order_number', 5)
    .gte('created_at', '2026-08-13T00:00:00+07:00')
    .lt('created_at', '2026-08-14T00:00:00+07:00')

  console.log("Order 5 details:", JSON.stringify(order, null, 2))
}

checkOrder5()
