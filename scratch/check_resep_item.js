const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: recipes, error } = await supabase.from('resep_item').select(`
    *,
    bahan_baku(nama, satuan),
    resep(menu_item_ref)
  `).eq('qty_per_porsi', 0.025);
  
  if (error) console.error(error);
  else console.log('Recipes with 0.025:', JSON.stringify(recipes, null, 2));
}

main();
