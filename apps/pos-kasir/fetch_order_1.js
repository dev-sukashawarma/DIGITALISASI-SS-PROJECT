require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .gte('created_at', '2026-07-20T00:00:00Z')
    .lte('created_at', '2026-07-20T23:59:59Z')
    .eq('order_number', 1);

  if (error) {
    console.error("Error fetching orders:", error);
  } else {
    console.log("Found matches for order 1:");
    data.forEach(o => console.dir(o, { depth: null }));
  }
}

run();
