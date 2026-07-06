const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPolicies() {
  const { data, error } = await supabase.rpc('get_policies_for_table', { table_name: 'system_guides' }).catch(() => ({}));
  
  // Actually, we can just query pg_policies
  const { data: policies, error: err } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'system_guides');

  console.log('Policies for system_guides:', policies);
}

checkPolicies();
