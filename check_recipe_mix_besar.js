const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('--- SEARCH MENU ITEMS ---');
  const { data: menu } = await supabase.from('menu_items')
    .select('id, name, type, recipe_id')
    .ilike('name', '%ORIGINAL MIX BESAR%');
  
  console.log('Menus:', menu);

  if (menu && menu.length > 0) {
    for (const m of menu) {
      if (m.recipe_id) {
        console.log(`\n--- RECIPE FOR ${m.name} ---`);
        const { data: recipe } = await supabase.from('recipes')
          .select('*')
          .eq('id', m.recipe_id)
          .single();
        console.log('Recipe:', recipe);

        const { data: ingredients } = await supabase.from('recipe_ingredients')
          .select('*, raw_materials(name, unit)')
          .eq('recipe_id', m.recipe_id);
        
        console.log('Ingredients:');
        ingredients.forEach(i => {
          console.log(`- ${i.raw_materials.name}: ${i.quantity} ${i.raw_materials.unit} (ID: ${i.raw_material_id})`);
        });
      }
      
      console.log(`\n--- BOM FOR ${m.name} (from bill_of_materials) ---`);
      const { data: bom } = await supabase.from('bill_of_materials')
        .select('*, raw_materials(name, unit)')
        .eq('menu_item_id', m.id);
        
      if (bom && bom.length > 0) {
        console.log('BOM items:');
        bom.forEach(i => {
          console.log(`- ${i.raw_materials.name}: ${i.quantity} ${i.raw_materials.unit} (ID: ${i.raw_material_id})`);
        });
      } else {
        console.log('No BOM found in bill_of_materials');
      }
    }
  } else {
    // If no menu, maybe search recipes directly
    console.log('\n--- SEARCH RECIPES DIRECTLY ---');
    const { data: recipes } = await supabase.from('recipes')
      .select('id, name')
      .ilike('name', '%ORIGINAL MIX BESAR%');
    console.log('Recipes:', recipes);
  }
}

main().catch(console.error);
