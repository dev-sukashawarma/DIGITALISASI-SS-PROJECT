require('dotenv').config({ path: 'apps/admin-dashboard/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*, categories(id,name,sort_order), package_items:menu_packages(id, menu_item_id, quantity)')
    .order('sort_order')
    .limit(1);

  console.log("Error:", error);
  console.log("Data length:", data ? data.length : 0);
}

run();
