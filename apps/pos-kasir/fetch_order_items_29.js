require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', '619f5dc0-8224-44e4-90db-96cb56cc7e9b');

  if (error) {
    console.error("Error fetching order items:", error);
  } else {
    console.log("Order Items:", JSON.stringify(data, null, 2));
  }
}

run();
