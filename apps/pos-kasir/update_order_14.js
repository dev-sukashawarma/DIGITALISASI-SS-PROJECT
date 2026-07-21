require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .update({ total_amount: 170276 })
    .eq('id', '86055045-5fb8-4ac7-83f3-ce7a4719b82c');

  if (error) {
    console.error("Error updating order:", error);
  } else {
    console.log("Successfully updated order. Checking new value...");
    const { data: updated } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, total_amount, promo_subsidy')
      .eq('id', '86055045-5fb8-4ac7-83f3-ce7a4719b82c')
      .single();
    
    console.log(updated);
  }
}

run();
