require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkComboOutlets() {
  const { data: outlets } = await supabase.from('outlets').select('id, name');
  const outletMap = {};
  if (outlets) {
      outlets.forEach(o => outletMap[o.id] = o.name);
  }

  const { data: menuItems, error } = await supabase.from('menu_items').select('name, available_outlets');
  
  if (error) {
      console.error("Error fetching menu items:", error);
      return;
  }
  
  const restricted = menuItems.filter(m => m.available_outlets && m.available_outlets.length > 0);
  
  if (restricted.length > 0) {
      const output = restricted.map(m => {
          const names = m.available_outlets.map(id => outletMap[id] || id);
          return {
              'Nama Menu / Paket': m.name,
              'Hanya Tersedia Di': names.join(', ')
          };
      });
      console.table(output);
  } else {
      console.log("NO menu items are restricted to specific outlets. All menus are available everywhere.");
  }
}

checkComboOutlets();
