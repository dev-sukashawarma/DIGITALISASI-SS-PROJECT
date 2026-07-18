require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function check() {
  const { data, error } = await supabase.from('orders').select('*').limit(1)
  console.log('Order sample:', data ? Object.keys(data[0] || {}) : error)
  
  const { data: q2, error: err2 } = await supabase.rpc('get_tables_dummy_test').catch(() => ({}))
  console.log(q2, err2)
}

check()
