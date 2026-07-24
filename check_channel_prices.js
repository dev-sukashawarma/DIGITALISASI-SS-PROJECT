require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkChannelPrices() {
  const { data, error } = await supabase.from('menu_items').select('name, price, channel_prices');
  
  if (error) {
      console.error("Error fetching menu items:", error);
      return;
  }
  
  const configured = data.filter(m => m.channel_prices && Object.keys(m.channel_prices).length > 0);
  
  if (configured.length > 0) {
      console.log("Items with channel_prices configured:");
      console.table(configured.map(m => {
          let res = { name: m.name, base_price: m.price };
          for (const key in m.channel_prices) {
              res[`price_${key}`] = m.channel_prices[key];
          }
          return res;
      }));
  } else {
      console.log("NO items have channel_prices configured in the database currently.");
  }
}

checkChannelPrices();
