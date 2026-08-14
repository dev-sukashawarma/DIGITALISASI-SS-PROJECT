import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function inspectCibubur() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const cibuburOutlet = outlets?.find(o => o.name.toLowerCase().includes('cibubur'))

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', cibuburOutlet.id)
    .gte('created_at', '2026-08-12T00:00:00+07:00')
    .lt('created_at', '2026-08-15T00:00:00+07:00')

  console.log("All orders for Cibubur (12-14 Aug):", JSON.stringify(orders, null, 2))
}

inspectCibubur()
