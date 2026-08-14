import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const url = 'https://khpkoreaaucvyqfhynfq.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'

const supabase = createClient(url, key)

async function test() {
  // First get an outlet and a menu item
  const { data: outlets } = await supabase.from('outlets').select('id').limit(1)
  const { data: menus } = await supabase.from('menu_items').select('id').limit(1)

  const toUpsert = [
    {
      id: 'bb45c642-7899-4cd8-b7c1-75160db7edfb', // an existing id (replace if needed, or we just rely on matching constraints if it exists, wait better to use an existing ID from DB)
      outlet_id: outlets[0].id,
      scope: 'global',
      menu_item_id: null,
      discount_type: 'percentage',
      discount_value: 10,
      is_active: true,
      min_purchase: 0,
      end_date: null
    },
    {
      id: crypto.randomUUID(),
      outlet_id: outlets[0].id,
      scope: 'item',
      menu_item_id: menus[0].id,
      discount_type: 'percentage',
      discount_value: 15,
      is_active: true,
      min_purchase: 0,
      end_date: null
    }
  ]

  console.log('Sending payload:', toUpsert)
  
  const { data, error } = await supabase.from('outlet_promos').upsert(toUpsert)

  if (error) {
    console.error('Upsert failed:', error)
  } else {
    console.log('Upsert success!')
  }
}

test()
