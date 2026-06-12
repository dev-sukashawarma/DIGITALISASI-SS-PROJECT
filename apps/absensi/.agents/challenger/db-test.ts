import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const envStr = fs.readFileSync(".env.local", "utf-8");
const env: Record<string, string> = {};
envStr.split("\n").forEach(line => {
  if (line && line.includes("=") && !line.startsWith("#")) {
    const [key, ...vals] = line.split("=");
    env[key.trim()] = vals.join("=").trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("Starting DB stress test for checklist CRUD...");
  
  const dummyOutletId = "00000000-0000-0000-0000-000000000001"; // arbitrary UUID for testing
  
  // 1. Create a checklist category
  console.log("1. Creating category...");
  const { data: catData, error: catError } = await supabase
    .from("checklist_categories")
    .insert({ name: "Test Category " + Date.now(), outlet_id: dummyOutletId })
    .select()
    .single();
    
  if (catError) {
    console.error("Error creating category:", catError);
    return;
  }
  const catId = catData.id;
  console.log("Category created with ID:", catId);
  
  // 2. Create an item for that category
  console.log("2. Creating item...");
  const { data: itemData, error: itemError } = await supabase
    .from("checklist_items")
    .insert({ category_id: catId, task_name: "Test Task", is_required: true })
    .select()
    .single();
    
  if (itemError) {
    console.error("Error creating item:", itemError);
    return;
  }
  const itemId = itemData.id;
  console.log("Item created with ID:", itemId);
  
  // 3. Try to delete the category
  console.log("3. Deleting category...");
  const { error: delError } = await supabase
    .from("checklist_categories")
    .delete()
    .eq("id", catId);
    
  if (delError) {
    console.error("Error deleting category (Likely missing cascade delete!):", delError.message);
  } else {
    console.log("Category deleted successfully.");
    
    // 4. Verify item is also deleted
    const { data: checkItem, error: checkItemError } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("id", itemId);
      
    if (checkItem && checkItem.length === 0) {
      console.log("Cascade delete works! Item is gone.");
    } else {
      console.log("Item still exists!", checkItem);
    }
  }
  
  // Cleanup if delete failed
  if (delError) {
    await supabase.from("checklist_items").delete().eq("id", itemId);
    await supabase.from("checklist_categories").delete().eq("id", catId);
    console.log("Cleanup done.");
  }
}

runTest().catch(console.error);
