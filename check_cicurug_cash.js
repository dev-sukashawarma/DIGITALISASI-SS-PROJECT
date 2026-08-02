const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08'; // Cicurug Outlet ID

  // 1. Get cash_location for Cicurug
  const { data: locs, error: locErr } = await admin
    .from('cash_location')
    .select('*')
    .eq('outlet_id', cicurugId);

  if (locErr) {
    console.error("Error cash_location:", locErr);
    return;
  }
  
  if (!locs || locs.length === 0) {
    console.log("No cash_location found for Cicurug");
    return;
  }

  for (const loc of locs) {
    console.log(`\nCash Location: ${loc.name} (Type: ${loc.type})`);
    
    // 2. Get balance
    const { data: bal } = await admin
      .from('cash_balance')
      .select('*')
      .eq('cash_location_id', loc.id)
      .maybeSingle();
      
    if (bal) {
      console.log(`Saldo: Rp ${bal.saldo?.toLocaleString('id-ID')}`);
      console.log(`Updated at: ${bal.updated_at}`);
    } else {
      console.log("No balance record found.");
    }
    
    // 3. Get transactions
    const { data: txs } = await admin
      .from('cash_transaction')
      .select('*')
      .eq('cash_location_id', loc.id)
      .order('created_at', { ascending: false })
      .limit(10);
      
    console.log("Recent Transactions:");
    if (!txs || txs.length === 0) {
      console.log("- None");
    } else {
      txs.forEach(t => {
        const sign = t.direction === 'in' ? '+' : '-';
        console.log(`[${t.created_at}] ${t.category} (${t.direction}): ${sign}Rp ${t.amount?.toLocaleString('id-ID')} | Note: ${t.note || '-'} | Status: ${t.status}`);
      });
    }
  }
}
run();
