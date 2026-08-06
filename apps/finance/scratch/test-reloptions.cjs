require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://khpkoreaaucvyqfhynfq.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await client.rpc('exec_sql', {
    query: "SELECT pg_class.relname, pg_class.reloptions FROM pg_class WHERE relname = 'sales_daily_spv';"
  });
  console.log(data, error);
}
run();
