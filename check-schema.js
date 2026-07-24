require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function check() {
  const { data: o, error: e1 } = await supabase.from('orders').select('*').limit(1)
  console.log('Order schema:', o ? Object.keys(o[0] || {}) : e1)
  
  const { data: oi, error: e2 } = await supabase.from('order_items').select('*').limit(1)
  console.log('Order Items schema:', oi ? Object.keys(oi[0] || {}) : e2)

  const { data: p, error: e3 } = await supabase.from('products').select('*').limit(1)
  console.log('Products schema:', p ? Object.keys(p[0] || {}) : e3)
}

check()
