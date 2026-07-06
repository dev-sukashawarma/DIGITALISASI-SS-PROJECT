require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAnon() {
  const { data, error } = await supabase
    .from('system_guides')
    .select('id, system_code, title')
    .eq('system_code', 'pos');

  console.log('Error:', error);
  console.log('Anon data for POS:', data);
}

checkAnon();
