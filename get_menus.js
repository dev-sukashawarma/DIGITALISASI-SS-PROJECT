require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function getMenus() {
  const { data: menuItems, error } = await supabase.from('menu_items').select('id, name, price, category_id').order('name');
  if (error) {
      console.error("Error fetching menu_items:", error.message || error);
      return;
  }
  console.log(`Total Menu Items: ${menuItems.length}`);
  console.table(menuItems.map(m => ({
      ID: m.id.substring(0,8) + '...',
      Name: m.name,
      Price: m.price,
      CatID: m.category_id ? m.category_id.substring(0,8) + '...' : ''
  })));
}

getMenus()
