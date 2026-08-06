const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjMyOTIsImV4cCI6MjA5NjUzOTI5Mn0.RdsvP6OKs6aiRnqqd02BYiv5gzbh4uGqO88dapo0Gso';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const from = '2026-08-01';
  const to = '2026-08-06';
  
  let q = supabase
    .from('sales_daily_spv')
    .select('sales_date, outlet_id, sales_source, omzet, jumlah_order_completed')
    .gte('sales_date', from)
    .lte('sales_date', to)
    .order('sales_date')
    .order('outlet_id')
    .order('sales_source');

  console.log("Querying sales_daily_spv with supabase-js...");
  const { data, error, count } = await q.range(0, 999);
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log(`Found ${data.length} rows.`);
    console.log(data.slice(0, 2));
  }
}

run();
