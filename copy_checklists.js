require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SOURCE_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'; // KITCHEN PUSAT
const TARGET_OUTLET_ID = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08'; // CICURUG

async function copyChecklists() {
  console.log(`Copying checklists from ${SOURCE_OUTLET_ID} to ${TARGET_OUTLET_ID}`);

  // Fetch source categories
  const { data: sourceCats, error: catError } = await supabase
    .from('checklist_categories')
    .select('*')
    .eq('outlet_id', SOURCE_OUTLET_ID);

  if (catError) {
    console.error('Error fetching source categories:', catError);
    return;
  }

  console.log(`Found ${sourceCats.length} categories to copy.`);

  for (const cat of sourceCats) {
    console.log(`Copying category: ${cat.name}`);
    
    // Insert new category
    const { data: newCat, error: insertCatError } = await supabase
      .from('checklist_categories')
      .insert({
        name: cat.name,
        outlet_id: TARGET_OUTLET_ID,
        phase: cat.phase
      })
      .select()
      .single();

    if (insertCatError) {
      console.error(`Error inserting category ${cat.name}:`, insertCatError);
      continue;
    }

    // Fetch items for the old category
    const { data: sourceItems, error: itemError } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('category_id', cat.id);

    if (itemError) {
      console.error(`Error fetching items for category ${cat.name}:`, itemError);
      continue;
    }

    if (sourceItems && sourceItems.length > 0) {
      const itemsToInsert = sourceItems.map(item => ({
        category_id: newCat.id,
        task_name: item.task_name,
        is_required: item.is_required
      }));

      const { error: insertItemsError } = await supabase
        .from('checklist_items')
        .insert(itemsToInsert);

      if (insertItemsError) {
        console.error(`Error inserting items for category ${cat.name}:`, insertItemsError);
      } else {
        console.log(`Copied ${sourceItems.length} items for category: ${cat.name}`);
      }
    }
  }
  
  console.log('Copy complete!');
}

copyChecklists();
