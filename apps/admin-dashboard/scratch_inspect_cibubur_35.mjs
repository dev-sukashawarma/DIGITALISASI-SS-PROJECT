import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function inspectOrder35() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const cibuburOutlet = outlets?.find(o => o.name.toLowerCase().includes('cibubur'))

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', cibuburOutlet.id)
    .eq('order_number', 35)

  console.log("Order 35 Cibubur:", JSON.stringify(orders, null, 2))
}

inspectOrder35()
