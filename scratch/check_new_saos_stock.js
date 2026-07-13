const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase.from('stok_balance').select(`
    *,
    outlets(name)
  `).in('bahan_baku_id', [
    '841dc31e-a5c0-4a8d-b599-eead717108cc', // SAOS TOMAT
    '4e94bec4-c473-49d7-8791-aa8a6a80337f'  // SAOS CABE
  ]);
  if (error) console.error(error);
  else console.log('Stok for new SAOS:', JSON.stringify(data, null, 2));
}

main();
