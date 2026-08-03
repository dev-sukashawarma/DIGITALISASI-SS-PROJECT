import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .update({
      source: 'online',
      sales_source: 'online',
      external_order_id: '41ad0cad-a87d-472a-ad38-f4e1c1541630',
      updated_at: new Date().toISOString(),
    })
    .eq('id', '41ad0cad-a87d-472a-ad38-f4e1c1541630')
    .select()
  console.log(data, error)
}
run()
