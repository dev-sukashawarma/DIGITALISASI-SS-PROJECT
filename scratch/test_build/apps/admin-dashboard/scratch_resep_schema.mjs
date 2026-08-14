import { createClient } from '@supabase/supabase-js'

const url = 'https://khpkoreaaucvyqfhynfq.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
const supabase = createClient(url, key)

async function test() {
  const { data, error } = await supabase.rpc('get_constraints', { table_name: 'resep_item' })
  console.log('constraints:', data || error)
}
test()
