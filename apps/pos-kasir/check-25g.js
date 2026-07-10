require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('resep_item')
    .select('qty_per_porsi, bahan_baku(nama), resep(nama)')
    .eq('qty_per_porsi', 25);
    
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
run();
