const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: recipes, error } = await supabase.from('resep_item').select(`
    *,
    bahan_baku(*),
    resep(menu_item_ref)
  `);
  
  if (error) console.error(error);
  else {
    const matching = recipes.filter(r => {
        const factor = r.bahan_baku?.faktor_konversi || 1;
        const reduction = (r.qty_per_porsi * 1) / factor;
        return reduction === 0.025;
    });
    console.log('Recipes leading to 0.025 reduction:', JSON.stringify(matching, null, 2));
  }
}

main();
