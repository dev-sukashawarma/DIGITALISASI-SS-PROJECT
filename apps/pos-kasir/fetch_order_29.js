require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', 29)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching order:", error);
  } else {
    console.log("Order 29:", JSON.stringify(data, null, 2));
  }
}

run();
