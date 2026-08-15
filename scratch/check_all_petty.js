const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function checkAll() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  console.log("=== CHECKING OUTLET CICURUG ===");
  const { data: outlet } = await admin.from('outlets').select('*').eq('id', cicurugId).single();
  console.log("Outlet:", outlet);

  console.log("\n=== CHECKING cash_location FOR CICURUG ===");
  const { data: cashLocations } = await admin.from('cash_location').select('*');
  const cicurugLocations = cashLocations.filter(c => c.outlet_id === cicurugId || /cicurug/i.test(c.label || c.name || ''));
  console.log("Cicurug Cash Locations:", cicurugLocations);
  console.log("All Cash Locations:", cashLocations.map(l => ({ id: l.id, label: l.label, kind: l.kind, scope: l.scope, outlet_id: l.outlet_id })));

  console.log("\n=== CHECKING cash_balance ===");
  const { data: balances } = await admin.from('cash_balance').select('*');
  console.log("All cash_balance entries:", balances);

  console.log("\n=== CHECKING petty_cash_topups FOR CICURUG ===");
  const { data: topups } = await admin.from('petty_cash_topups').select('*').eq('outlet_id', cicurugId);
  console.log("Topups for Cicurug:", topups);

  console.log("\n=== CHECKING petty_cash_expenses / expenses / kas_kecil ===");
  const possibleTables = [
    'petty_cash',
    'petty_cash_balance',
    'petty_cash_expenses',
    'petty_cash_transactions',
    'expenses',
    'outlet_expenses',
    'cash_transactions',
    'cash_transaction',
    'daily_expenses'
  ];

  for (const table of possibleTables) {
    try {
      const { data, error } = await admin.from(table).select('*').limit(3);
      if (!error) {
        console.log(`Table '${table}' exists. Count sample: ${data.length}`);
        const { data: outletRows } = await admin.from(table).select('*').eq('outlet_id', cicurugId);
        if (outletRows && outletRows.length > 0) {
          console.log(`  -> Outlet rows in ${table}:`, outletRows);
        }
      }
    } catch(e) {}
  }
}

checkAll();
