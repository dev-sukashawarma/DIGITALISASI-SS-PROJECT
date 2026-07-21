require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .gte('created_at', '2026-07-20T00:00:00Z')
    .lte('created_at', '2026-07-20T23:59:59Z');

  if (error) {
    console.error("Error fetching orders:", error);
  } else {
    // find S, 374
    const s374 = data.filter(o => o.customer_name && o.customer_name.includes('374'));
    console.log("Found matches for 374:");
    s374.forEach(o => console.dir(o, { depth: null }));
    
    // Also find order where total is 63724
    const byPrice = data.filter(o => o.total_amount === 63724 || o.total_amount === 63724.0);
    console.log("Found matches for 63724:");
    byPrice.forEach(o => console.dir(o, { depth: null }));
  }
}

run();
