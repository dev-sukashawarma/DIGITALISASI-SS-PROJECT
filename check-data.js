require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function check() {
  const { data: outlets, error } = await supabase.from('outlets').select('id, name')
  if (error) {
    console.error('Error fetching outlets:', error)
    return
  }
  
  console.log('Outlets:', outlets)
  
  // Try to find typical sales tables
  const tablesToCheck = ['orders', 'pos_orders', 'order_items', 'payments', 'cash_drawer_sessions', 'void_records', 'order_activity_logs']
  
  for (const table of tablesToCheck) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) {
      console.log(`Table ${table} might not exist or error:`, error.message)
    } else {
      console.log(`Table ${table} has ${count} records.`)
    }
  }
}

check()
