import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function checkSawanganAll() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const outlet = outlets?.find(o => o.name.toLowerCase().includes('sawangan'))

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, created_at, channel, sales_source, total_amount')
    .eq('outlet_id', outlet.id)
    .gte('created_at', '2026-08-13T00:00:00+07:00')
    .lt('created_at', '2026-08-15T00:00:00+07:00')
    .order('created_at', { ascending: true })

  console.log("All orders for Sawangan (13-14 Aug):", JSON.stringify(orders, null, 2))
}

checkSawanganAll()
