const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // Check recipes with qty = 0.025
    const { data: recipes, error } = await supabase.from('menu_recipes').select(`
      *,
      bahan_baku(nama, satuan),
      menu(name)
    `).eq('qty', 0.025);
    
    if (error) {
        console.error('Recipe error:', error);
    } else {
        console.log('Recipes with 0.025 qty:', JSON.stringify(recipes, null, 2));
    }
}

main();
