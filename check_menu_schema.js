require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  const { data, error } = await supabase.from('menu_items').select('*').limit(1);
  if (error) {
      console.error("Error fetching menu items:", error);
      return;
  }
  
  if (data && data.length > 0) {
      console.log("Columns in menu_items table:");
      console.log(Object.keys(data[0]));
      console.log("\nSample row:");
      console.log(data[0]);
  } else {
      console.log("Table is empty.");
  }
}

checkSchema();
