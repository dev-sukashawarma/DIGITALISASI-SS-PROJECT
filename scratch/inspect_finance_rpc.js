const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectRPCDef() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'finance_process_petty_cash';"
  }).catch(err => ({ data: null, error: err }));

  if (error) {
    // Try querying pg_proc
    const { data: procData, error: procErr } = await supabase
      .from('pg_proc')
      .select('*')
      .eq('proname', 'finance_process_petty_cash');
    console.log('Proc data:', procData, procErr);
  } else {
    console.log('Function def:', data);
  }
}

inspectRPCDef();
