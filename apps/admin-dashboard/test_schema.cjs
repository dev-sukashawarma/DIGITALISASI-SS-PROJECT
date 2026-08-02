require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.rpc('get_schema', { table_name: 'outlet_staff' });
  console.log('outlet_staff schema:', data || error);

  const { data: d2, error: e2 } = await supabase.from('leader_outlets').select('*').limit(1);
  if (!e2) console.log('leader_outlets exists');
  
  const { data: d3, error: e3 } = await supabase.from('staff_outlets').select('*').limit(1);
  if (!e3) console.log('staff_outlets exists');
}
run();
