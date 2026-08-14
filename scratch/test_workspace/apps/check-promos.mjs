import { createClient } from '@supabase/supabase-js'

const url = 'https://khpkoreaaucvyqfhynfq.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'

const supabase = createClient(url, key)

async function run() {
  const { data, error } = await supabase.from('outlet_promos').select('*')
  if (error) {
    console.error(error)
    return
  }

  console.log(`Total promos: ${data.length}`)
  
  const map = new Map()
  let duplicates = 0
  for (const row of data) {
    const k = `${row.outlet_id}_${row.scope}_${row.menu_item_id}`
    if (map.has(k)) {
      duplicates++
      console.log('Deleting duplicate:', row.id)
      await supabase.from('outlet_promos').delete().eq('id', row.id)
    } else {
      map.set(k, row)
    }
  }
  
  console.log(`Duplicates deleted: ${duplicates}`)
}
run()
