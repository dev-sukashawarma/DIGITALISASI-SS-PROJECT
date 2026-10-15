const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const fromIso = '2026-10-01T00:00:00+07:00';
  const toIso = '2026-10-14T23:59:59.999+07:00';

  console.log('Querying orders between', fromIso, 'and', toIso);

  // We need to fetch with pagination or fetchAllPages because Supabase default limit is 1000 rows!
  let allOrders = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, outlet_id, channel, sales_source, status, total_amount, discount_amount, promo_subsidy, created_at')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching orders:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allOrders = allOrders.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log('Total orders in DB for 1-14 Oct 2026:', allOrders.length);

  const channelMap = {};
  allOrders.forEach(o => {
    const key = `${o.channel || 'NULL'} | ${o.sales_source || 'NULL'} | ${o.status}`;
    if (!channelMap[key]) channelMap[key] = { count: 0, totalAmount: 0, promoSubsidy: 0, discountAmount: 0 };
    channelMap[key].count++;
    channelMap[key].totalAmount += Number(o.total_amount) || 0;
    channelMap[key].promoSubsidy += Number(o.promo_subsidy) || 0;
    channelMap[key].discountAmount += Number(o.discount_amount) || 0;
  });

  console.log('\nBreakdown by channel | sales_source | status:');
  console.table(Object.entries(channelMap).map(([k, v]) => ({
    channel_sales_status: k,
    count: v.count,
    totalAmount: 'Rp ' + Math.round(v.totalAmount).toLocaleString('id-ID'),
    promoSubsidy: 'Rp ' + Math.round(v.promoSubsidy).toLocaleString('id-ID')
  })));

  // Let's also check distinct channels
  const distinctChannels = new Set(allOrders.map(o => o.channel));
  const distinctSources = new Set(allOrders.map(o => o.sales_source));
  console.log('\nDistinct channels:', Array.from(distinctChannels));
  console.log('Distinct sales_source:', Array.from(distinctSources));

  // Let's check how many total completed orders across ALL channels
  const completedOrders = allOrders.filter(o => o.status === 'completed' || o.status === 'settled');
  console.log('\nTotal completed orders (all channels):', completedOrders.length);
  const totalGrossAll = completedOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
  console.log('Total amount completed (all channels): Rp', Math.round(totalGrossAll).toLocaleString('id-ID'));
}

inspect().catch(console.error);
