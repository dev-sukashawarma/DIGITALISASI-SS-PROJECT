const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const outletId = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a';

const tablesToCheck = [
  'orders',
  'order_items', // might need to delete based on order_id
  'cash_transaction',
  'ledger_transaksi_ringkas',
  'ledger_stok',
  'shifts',
  'outlet_order_counters',
  'cancellation_requests',
  'petty_cash_expenses',
  'petty_cash_topups',
  'ecommerce_sales',
  'daily_sales_targets',
  'opname'
];

async function checkTableCount(table) {
  let query = `${url}/rest/v1/${table}?select=id&limit=1000`;
  
  if (table === 'order_items') {
    // We can't directly filter by outlet_id for order_items if it doesn't have it, but usually order_items has order_id. We'll check if order_items has outlet_id
    query = `${url}/rest/v1/${table}?outlet_id=eq.${outletId}&select=id`;
  } else {
    query = `${url}/rest/v1/${table}?outlet_id=eq.${outletId}&select=id`;
  }

  const res = await fetch(query, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log(`${table}: ${data.length} records found`);
  } else {
    const errorText = await res.text();
    if (!errorText.includes("Could not find the 'outlet_id' column")) {
      console.log(`Error checking ${table}:`, errorText);
    } else {
      console.log(`${table}: no outlet_id column`);
    }
  }
}

async function run() {
  for (const table of tablesToCheck) {
    await checkTableCount(table);
  }
}

run();
