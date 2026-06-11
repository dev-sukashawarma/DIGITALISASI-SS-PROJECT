import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || (!supabaseKey && !supabaseServiceRoleKey)) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

// using service role if available or anon key
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseKey);

async function testCRUD() {
  console.log("Creating checklist category...");
  const { data: catData, error: catError } = await supabase
    .from('checklist_categories')
    .insert({ name: 'Test Category', outlet_id: '00000000-0000-0000-0000-000000000000' }) // use dummy or fetch one
    .select()
    .single();

  if (catError) {
    // maybe try to get a real outlet_id
    const { data: outlets } = await supabase.from('outlets').select('id').limit(1);
    if (!outlets || outlets.length === 0) {
      console.log("No outlets found, cannot test.", catError);
      return;
    }
    const outlet_id = outlets[0].id;
    console.log("Retrying with outlet_id", outlet_id);
    
    const { data: catData2, error: catError2 } = await supabase
      .from('checklist_categories')
      .insert({ name: 'Test Category', outlet_id })
      .select()
      .single();
      
    if (catError2) {
      console.error("Failed to create category", catError2);
      return;
    }
    await runItemTest(catData2.id);
  } else {
    await runItemTest(catData.id);
  }
}

async function runItemTest(categoryId) {
  console.log("Created category ID:", categoryId);
  
  console.log("Creating item...");
  const { data: itemData, error: itemError } = await supabase
    .from('checklist_items')
    .insert({ category_id: categoryId, task_name: 'Test Task', is_required: true })
    .select()
    .single();
    
  if (itemError) {
    console.error("Failed to create item", itemError);
    return;
  }
  
  console.log("Created item ID:", itemData.id);
  
  console.log("Attempting to delete category (with item still in it)...");
  const { error: delError } = await supabase
    .from('checklist_categories')
    .delete()
    .eq('id', categoryId);
    
  if (delError) {
    console.error("Failed to delete category (Cascade issue?)", delError);
  } else {
    console.log("Category deleted successfully (Cascade works or no constraint)");
  }
}

testCRUD();
