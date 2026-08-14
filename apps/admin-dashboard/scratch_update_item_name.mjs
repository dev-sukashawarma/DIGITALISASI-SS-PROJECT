import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function fixName() {
  const { error } = await supabase
    .from('order_items')
    .update({ menu_item_name: 'Best Seller (Mix Jumbo)|ID|manual_admin' })
    .eq('id', '917ebe7d-c71b-4b95-a15b-57bd8de80d21')

  if (error) console.error(error)
  else console.log(" Item name updated to Best Seller (Mix Jumbo)")
}

fixName()
