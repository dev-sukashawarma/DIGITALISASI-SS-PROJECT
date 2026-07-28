const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: "SELECT proname, prosrc, prosecdef FROM pg_proc WHERE proname = 'finance_forward_funds'"
  });
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
check();
