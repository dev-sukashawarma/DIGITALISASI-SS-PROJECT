require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkComboOutlets() {
  const { data: menuItems, error } = await supabase.from('menu_items').select('name, available_outlets');
  
  if (error) {
      console.error("Error fetching menu items:", error);
      return;
  }
  
  const restricted = menuItems.filter(m => m.available_outlets && m.available_outlets.length > 0);
  
  if (restricted.length > 0) {
      console.log("Menu items restricted to specific outlets:");
      console.table(restricted.map(m => ({
          'Menu Name': m.name,
          'Allowed Outlets': JSON.stringify(m.available_outlets)
      })));
  } else {
      console.log("NO menu items are restricted to specific outlets. All menus are available everywhere.");
  }
}

checkComboOutlets();
