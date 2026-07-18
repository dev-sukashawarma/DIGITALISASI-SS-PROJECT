const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const res = await supabase.from('bahan_baku').select('*').limit(1);
  console.log('Select 1 row from bahan_baku:', res.data, res.error);
}

main().catch(console.error);
