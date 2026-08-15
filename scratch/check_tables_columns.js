const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function checkAllTablesAndColumns() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  // Check if there are any petty cash expenses or topups in current shift
  const currentShiftStart = '2026-08-14T13:01:51.837581+07:00';
  
  const { data: currentExps } = await admin
    .from('petty_cash_expenses')
    .select('*')
    .eq('outlet_id', cicurugId)
    .gte('created_at', currentShiftStart);
  console.log("Current Shift Petty Cash Expenses:", currentExps);

  const { data: currentTopups } = await admin
    .from('petty_cash_topups')
    .select('*')
    .eq('outlet_id', cicurugId)
    .gte('created_at', currentShiftStart);
  console.log("Current Shift Petty Cash Topups:", currentTopups);

  // Check all cash_location and cash_balance in case there is a location for Cicurug
  const { data: cashLocs } = await admin.from('cash_location').select('*');
  console.log("All Cash Locations:", cashLocs);

  // Check if any other table has cicurug outlet_id
  // Let's test tables from information_schema via a query or probe
  const knownTables = [
    'shifts',
    'petty_cash_topups',
    'petty_cash_expenses',
    'expenses',
    'cash_location',
    'cash_balance',
    'cash_transaction',
    'outlets',
    'outlet_staff',
    'orders',
    'inventory_items'
  ];

  for (const t of knownTables) {
    const { data: rows } = await admin.from(t).select('*').limit(1);
    if (rows && rows[0]) {
      const cols = Object.keys(rows[0]);
      const pettyOrCashCols = cols.filter(c => /petty|cash|saldo|balance/i.test(c));
      if (pettyOrCashCols.length > 0) {
        console.log(`Table '${t}' has cash/petty columns:`, pettyOrCashCols);
      }
    }
  }
}

checkAllTablesAndColumns();
