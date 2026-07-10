const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('--- BATCHES ---');
  const { data: batches } = await supabase.from('inventory_batches').select('*').order('received_at', { ascending: false }).limit(5);
  console.log(batches);
  
  console.log('\n--- LEDGER STOK ---');
  const { data: ledger } = await supabase.from('ledger_stok').select('*').order('created_at', { ascending: false }).limit(5);
  console.log(ledger);
}
main();
