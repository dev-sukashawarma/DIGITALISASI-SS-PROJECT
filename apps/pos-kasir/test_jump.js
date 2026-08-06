require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, outlet_id, order_number, created_at, source')
    .order('order_number', { ascending: false })
    .limit(20);
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Recent Orders:");
    data.forEach(o => {
      console.log(`Order #: ${o.order_number}, Outlet: ${o.outlet_id.slice(0,5)}, Time: ${new Date(o.created_at).toISOString()}, Source: ${o.source}`);
    });
  }
}

run();
