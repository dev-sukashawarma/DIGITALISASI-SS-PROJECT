require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await sb.from('menu_items').select('id, name, price, channel_prices');
  if (error) {
    console.error(error);
    return;
  }
  
  for (const item of data) {
    if (item.channel_prices) {
      let changed = false;
      let newPrices = { ...item.channel_prices };
      for (const [key, value] of Object.entries(item.channel_prices)) {
        if (value < 100) {
          console.log(`Found weird price for ${item.name} in channel ${key}: ${value}`);
          delete newPrices[key];
          changed = true;
        }
      }
      if (changed) {
        console.log(`Fixing ${item.name}...`);
        await sb.from('menu_items').update({ channel_prices: newPrices }).eq('id', item.id);
      }
    }
  }
  console.log("Done");
}

run();
