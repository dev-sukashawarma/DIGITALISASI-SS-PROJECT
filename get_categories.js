require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCategories() {
  const { data: categories, error } = await supabase.from('categories').select('id, name');
  if (error) {
      console.error("Error fetching categories:", error);
      return;
  }
  
  console.log("Categories in system:");
  console.table(categories);

  const { data: menuItems, error: mErr } = await supabase.from('menu_items').select('id, name, price, category_id');
  if (mErr) {
      console.error("Error fetching menu items:", mErr);
      return;
  }

  // Show a few items per category to see if there are Food Apps specific items
  const catMap = {};
  categories.forEach(c => catMap[c.id] = c.name);
  
  const grouped = {};
  menuItems.forEach(m => {
      const catName = catMap[m.category_id] || 'Unknown';
      if (!grouped[catName]) grouped[catName] = [];
      grouped[catName].push({ name: m.name, price: m.price });
  });

  for (const cat of Object.keys(grouped)) {
      if (cat.toLowerCase().includes('grab') || cat.toLowerCase().includes('go') || cat.toLowerCase().includes('shopee') || cat.toLowerCase().includes('food') || cat.toLowerCase().includes('app')) {
          console.log(`\nItems in Category: ${cat}`);
          console.table(grouped[cat]);
      }
  }
  
  // Just in case, let's look for any menu item that has grab/go/shopee/app in the name
  const appItems = menuItems.filter(m => 
      m.name.toLowerCase().includes('grab') || 
      m.name.toLowerCase().includes('go') || 
      m.name.toLowerCase().includes('shopee') || 
      m.name.toLowerCase().includes('app')
  );
  if (appItems.length > 0) {
      console.log("\nMenu items with app names:");
      console.table(appItems.map(m => ({ name: m.name, price: m.price, category: catMap[m.category_id] })));
  } else {
      console.log("\nNo specific menu items with Grab/Go/Shopee/App in their names.");
  }
}

checkCategories();
