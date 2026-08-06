require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://khpkoreaaucvyqfhynfq.supabase.co', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function run() {
  await client.auth.signInWithPassword({
    email: 'test_finance_admin@example.com',
    password: 'password123'
  });

  const { data: outlets } = await client.from('outlets').select('id, name');

  const { data: salesRows } = await client
    .from('sales_daily_spv')
    .select('sales_date, outlet_id, sales_source, omzet, jumlah_order_completed')
    .gte('sales_date', '2026-08-01')
    .lte('sales_date', '2026-08-06')
    .limit(1000);

  const nameMap = new Map();
  outlets.forEach(o => nameMap.set(o.id, o.name));

  const aggMap = new Map();

  salesRows.forEach(s => {
    const date = s.sales_date || 'Unknown Date';
    const outletId = s.outlet_id;
    const channel = s.sales_source || 'Offline';
    const outletName = nameMap.get(outletId) || 'Outlet Tidak Dikenal';
    const key = `${date}-${outletId}-${channel}`;
    
    const existing = aggMap.get(key);
    if (existing) {
      existing.totalRevenue += Number(s.omzet || 0);
      existing.totalOrders += Number(s.jumlah_order_completed || 0);
    } else {
      aggMap.set(key, {
        date,
        outletId,
        outletName,
        channel,
        totalRevenue: Number(s.omzet || 0),
        totalOrders: Number(s.jumlah_order_completed || 0)
      });
    }
  });

  const finalData = Array.from(aggMap.values());
  console.log('Final data length:', finalData.length);
}

run();
