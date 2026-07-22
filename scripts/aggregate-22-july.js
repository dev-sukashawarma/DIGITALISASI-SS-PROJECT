const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const startOfDay = '2026-07-21T17:00:00Z'; // 00:00 WIB on 22 July
  const endOfDay = '2026-07-22T17:00:00Z';   // 23:59 WIB on 22 July

  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('id, outlet_id, order_items(menu_item_name, quantity)')
    .eq('status', 'completed')
    .gte('created_at', startOfDay)
    .lt('created_at', endOfDay);

  if (ordersErr) throw ordersErr;

  const { data: outlets } = await supabase.from('outlets').select('id, name');
  const outletMap = {};
  outlets.forEach(o => outletMap[o.id] = o.name);

  const aggregated = {};
  
  orders.forEach(o => {
    const outletName = outletMap[o.outlet_id] || 'Unknown';
    if (!aggregated[outletName]) aggregated[outletName] = {};
    
    o.order_items.forEach(item => {
      // Clean up name by taking everything before the first '|'
      let name = item.menu_item_name.split('|')[0].trim().toUpperCase();
      aggregated[outletName][name] = (aggregated[outletName][name] || 0) + item.quantity;
    });
  });

  // Write to a text file for easy reading
  let output = '=== TOTAL ITEM TERJUAL TANGGAL 22 JULI 2026 ===\n\n';
  for (const outlet in aggregated) {
    output += `[ CABANG: ${outlet} ]\n`;
    const items = aggregated[outlet];
    for (const item in items) {
      output += `${item}: ${items[item]}\n`;
    }
    output += '\n';
  }

  fs.writeFileSync('apps/admin-dashboard/public/rekap-item-22-juli.txt', output);
  console.log('Exported aggregated quantities to rekap-item-22-juli.txt');
}

run();
