require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://khpkoreaaucvyqfhynfq.supabase.co', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const PAGE_SIZE = 1000;
const MAX_PAGES = 200;

async function fetchAllRows(buildQuery, label) {
  const rows = [];
  let expected = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error, count } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);

    const batch = data ?? [];
    rows.push(...batch);

    if (expected === null && typeof count === 'number') expected = count;
    if (batch.length < PAGE_SIZE) break;

    if (page === MAX_PAGES - 1) {
      throw new Error(`${label}: melebihi limit.`);
    }
  }

  if (expected !== null && rows.length !== expected) {
    throw new Error(`${label}: data tidak lengkap.`);
  }

  return rows;
}

async function run() {
  await client.auth.signInWithPassword({
    email: 'test_finance_admin@example.com',
    password: 'password123'
  });

  const from = '2026-08-01';
  const to = '2026-08-06';
  
  const buildSalesQuery = () => {
    let q = client
      .from('sales_daily_spv')
      .select('sales_date, outlet_id, sales_source, omzet, jumlah_order_completed')
      .gte('sales_date', from)
      .lte('sales_date', to)
      .order('sales_date')
      .order('outlet_id')
      .order('sales_source');
    return q;
  };
  
  try {
    const salesRows = await fetchAllRows(buildSalesQuery, 'Omzet outlet');
    console.log("SalesRows length:", salesRows.length);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
