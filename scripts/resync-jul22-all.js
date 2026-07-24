const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function resyncJul22All() {
  const { data: configData } = await supabase.from('global_settings').select('*').in('key', ['google_sheets_webhook_url']);
  const webhookUrl = configData?.[0]?.value;
  if (!webhookUrl) return console.error('No webhook URL found');

  const { data: outlets } = await supabase.from('outlets').select('id, name');
  const outletMap = {};
  outlets.forEach(o => {
    // We send the exact DB name so the Apps Script matches it. 
    // Example: "SUKA SHAWARMA DRAMAGA" -> Apps script looks for "DRAMAGA"
    outletMap[o.id] = o.name;
  });

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('status', 'completed')
    .gte('created_at', '2026-07-21T17:00:00Z') // Local WIB 00:00:00 for Jul 22
    .lt('created_at', '2026-07-22T17:00:00Z'); // Local WIB 23:59:59 for Jul 22

  if (!orders || orders.length === 0) return console.log('No orders to sync.');

  console.log(`Resyncing ${orders.length} orders for July 22 to Google Sheets for all outlets...`);

  let successCount = 0;
  for (const order of orders) {
    const outletName = outletMap[order.outlet_id] || 'Unknown';
    const payload = {
      event: 'ORDER_COMPLETED',
      timestamp: order.created_at,
      day_of_month: 22,
      order_number: String(order.order_number),
      outlet_name: outletName,
      channel: order.channel || order.sales_source || 'POS',
      payment_method: order.payment_method || 'CASH',
      items: order.order_items.map(item => {
        let name = item.menu_item_name || '';
        name = name.split('|')[0].trim().toUpperCase();
        return { menu_item_name: name, quantity: item.quantity, unit_price: item.unit_price, subtotal: item.subtotal };
      })
    };

    try {
      const response = await fetch(webhookUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify(payload), 
        redirect: 'follow' 
      });
      if (response.ok || response.type === 'opaque') {
        successCount++;
        process.stdout.write('.');
      } else {
        console.error('\nFailed order ' + order.order_number + ' - Status: ' + response.status);
      }
    } catch (e) {
      console.error('\nError order ' + order.order_number, e.message);
    }
  }
  console.log(`\nSuccessfully synced ${successCount} out of ${orders.length} orders for ALL OUTLETS (July 22).`);
}
resyncJul22All();
