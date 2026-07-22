const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or Key not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportData() {
  console.log('Fetching outlets...');
  const { data: outlets, error: outletErr } = await supabase.from('outlets').select('id, name');
  if (outletErr) throw outletErr;
  
  const outletMap = {};
  outlets.forEach(o => {
    outletMap[o.id] = o.name;
  });

  console.log('Fetching completed orders for 22 July 2026...');
  // We'll fetch all orders on 22 July 2026 (local time bounds or UTC bounds)
  // 22 July 2026 in UTC:
  const startOfDay = '2026-07-21T17:00:00Z'; // 00:00 WIB
  const endOfDay = '2026-07-22T17:00:00Z'; // 23:59 WIB

  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('status', 'completed')
    .gte('created_at', startOfDay)
    .lt('created_at', endOfDay);

  if (ordersErr) throw ordersErr;

  console.log(`Found ${orders.length} orders.`);

  // Prepare CSV data: Waktu, Cabang, Nama Item, Qty, Subtotal, Channel
  const rows = [];
  rows.push(['Waktu', 'Cabang', 'Nama Item', 'Qty', 'Subtotal', 'Channel'].join(','));

  orders.forEach(order => {
    const time = new Date(order.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const cabang = outletMap[order.outlet_id] || 'Unknown';
    const channel = order.sales_source || order.source || 'pos';
    
    order.order_items.forEach(item => {
      // Escape for CSV
      const escape = (str) => {
        if (str === null || str === undefined) return '';
        const s = String(str);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };

      const itemName = escape(item.menu_item_name);
      
      rows.push([
        escape(time),
        escape(cabang),
        itemName,
        item.quantity,
        item.subtotal,
        escape(channel)
      ].join(','));
    });
  });

  const csvContent = rows.join('\n');
  const fileName = 'apps/admin-dashboard/public/transaksi-22-juli-2026.csv';
  fs.writeFileSync(fileName, csvContent);
  console.log(`Exported successfully to ${fileName}`);
}

exportData().catch(console.error);
