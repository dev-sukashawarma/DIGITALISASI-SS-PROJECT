const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const { data: txs, error } = await admin
    .from('cash_transaction')
    .select('*, cash_location:cash_location_id(label), outlet:outlet_id(name)')
    .gte('occurred_at', '2026-08-01T00:00:00.000Z')
    .order('occurred_at', { ascending: false });

  if (error) {
    console.error('Error fetching august txs:', error);
    return;
  }

  console.log(`August transactions count: ${txs ? txs.length : 0}\n`);

  for (const t of (txs || [])) {
    console.log(`[${t.occurred_at}] Amount: ${t.amount} | Status: ${t.status} | SourceID: ${t.source_id}`);
    if (t.source_id) {
      const { data: topup } = await admin
        .from('petty_cash_topups')
        .select('id, amount, description, status, outlet_id, outlets(name)')
        .eq('id', t.source_id)
        .maybeSingle();
      console.log(`   -> Linked Topup:`, topup);
    }
  }
}

run();
