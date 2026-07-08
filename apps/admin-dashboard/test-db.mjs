import { createClient } from '@supabase/supabase-js'

const url = 'https://khpkoreaaucvyqfhynfq.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'

const supabase = createClient(url, key)

async function test() {
  // First get an outlet and a menu item
  const { data: outlets } = await supabase.from('outlets').select('id').limit(1)
  const { data: menus } = await supabase.from('menu_items').select('id').limit(1)

  const fs = require('fs')
  const path = require('path')
  
  const sqlPath = path.join(__dirname, '../../supabase/migrations/20260708120000_fix_promo_rls_for_owner.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  
  // To run raw SQL, we can't use standard postgres RPC without a specific setup in postgREST.
  // Wait, does Supabase JS client allow running arbitrary SQL? No.
  // But wait! We can just use node-postgres (pg) to connect directly!
  // Let me check if 'pg' is installed.
}

test()
