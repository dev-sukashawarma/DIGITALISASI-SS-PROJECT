require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('stok_balance')
    .select('*, bahan_baku(nama, satuan)')
    .eq('outlet_id', '550e8400-e29b-41d4-a716-446655440002')
    .lt('saldo', 0); // Find all negative balances
    
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

run();
