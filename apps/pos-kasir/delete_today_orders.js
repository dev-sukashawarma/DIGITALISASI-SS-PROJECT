require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, created_at, status')
    .gte('created_at', '2026-07-21T00:00:00Z')
    .lte('created_at', '2026-07-21T23:59:59Z')
    .in('order_number', [1, 2]);

  if (error) {
    console.error("Error fetching orders:", error);
    return;
  }

  console.log("Orders found to delete:");
  console.dir(data, { depth: null });

  if (data.length > 0) {
    const ids = data.map(o => o.id);
    const { data: delData, error: delError } = await supabase
      .from('orders')
      .delete()
      .in('id', ids)
      .select();

    if (delError) {
      console.error("Error deleting orders:", delError);
    } else {
      console.log("Successfully deleted orders:");
      console.dir(delData, { depth: null });
    }
  } else {
    console.log("No orders found matching the criteria.");
  }
}

run();
