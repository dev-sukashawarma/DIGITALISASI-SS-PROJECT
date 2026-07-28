const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRPCs() {
  const { data, error } = await supabase.rpc('get_routines', {}).catch(() => ({ data: null }));
  
  // Query pg_proc via sql
  const { data: procs } = await supabase.rpc('exec_sql', {
    sql: "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%petty%';"
  }).catch((err) => ({ data: null }));

  console.log('Petty cash RPC routines:', procs);
}

checkRPCs();
