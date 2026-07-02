require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const sql = fs.readFileSync('migration-walkin-payment.sql', 'utf8');
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('Error with RPC:', error.message);
    process.exit(1);
  }
  console.log('Success: added amount_received & change_amount to orders');
}
run();
