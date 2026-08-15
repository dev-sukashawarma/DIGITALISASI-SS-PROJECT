const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function inspect() {
  console.log("=== Finding Cicurug Outlet ===");
  const { data: outlets, error: outErr } = await admin
    .from('outlets')
    .select('*')
    .ilike('name', '%Cicurug%');
  console.log("Outlets:", outlets, outErr);

  console.log("\n=== Finding all outlets with Cicurug in any field ===");
  const { data: allOutlets } = await admin.from('outlets').select('id, name, code, is_active');
  const matching = (allOutlets || []).filter(o => /cicurug/i.test(o.name) || /cicurug/i.test(o.code));
  console.log("Matching outlets:", matching);

  if (matching.length > 0) {
    const cicurug = matching[0];
    console.log(`\nUsing outlet ID: ${cicurug.id} (${cicurug.name})`);

    // Let's check various tables
    const tablesToCheck = [
      'petty_cash',
      'petty_cash_balance',
      'petty_cash_transactions',
      'petty_cash_entries',
      'cash_locations',
      'cash_location',
      'cash_balance',
      'cash_balances',
      'cash_transactions',
      'cash_transaction',
      'pos_sessions',
      'shifts'
    ];

    for (const t of tablesToCheck) {
      const { data, error } = await admin.from(t).select('*').limit(5);
      if (error) {
        // console.log(`Table ${t}: Error (${error.message})`);
      } else {
        console.log(`Table '${t}' exists! Sample count: ${data.length}`);
        // Let's check records for Cicurug in table t
        const { data: outletData } = await admin.from(t).select('*').eq('outlet_id', cicurug.id);
        if (outletData && outletData.length > 0) {
          console.log(`  -> Found ${outletData.length} records in '${t}' for outlet_id=${cicurug.id}:`, JSON.stringify(outletData, null, 2));
        }
      }
    }
  }
}

inspect();
