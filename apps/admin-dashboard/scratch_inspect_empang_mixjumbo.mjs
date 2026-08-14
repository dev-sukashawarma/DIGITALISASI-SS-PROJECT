import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function inspectEmpangMixJumbo() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const empangOutlet = outlets?.find(o => o.name.toLowerCase().includes('empang'))

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', empangOutlet.id)
    .eq('channel', 'tiktokgo')
    .in('order_number', [91, 93])
    .gte('created_at', '2026-08-13T00:00:00+07:00')
    .lt('created_at', '2026-08-14T00:00:00+07:00')

  console.log("Orders 91 & 93:", JSON.stringify(orders, null, 2))
}

inspectEmpangMixJumbo()
