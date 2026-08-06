const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const { data: txs, error } = await admin
    .from('cash_transaction')
    .select('*, cash_location:cash_location_id(label), outlet:outlet_id(name)')
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching txs:', error);
    return;
  }

  console.log(`Total pending transactions: ${txs ? txs.length : 0}\n`);

  if (!txs || txs.length === 0) return;

  for (const t of txs) {
    console.log(`ID: ${t.id}`);
    console.log(`Time: ${t.occurred_at || t.created_at}`);
    console.log(`Location: ${t.cash_location ? t.cash_location.label : t.cash_location_id}`);
    console.log(`Category/Source: ${t.category || t.source_type}`);
    console.log(`Amount: ${t.amount}`);
    console.log(`Note: ${t.note}`);
    console.log(`Source ID: ${t.source_id}`);
    console.log(`Created By: ${t.created_by}`);
    
    if (t.source_id && t.source_type === 'petty_cash') {
      const { data: topup } = await admin
        .from('petty_cash_topups')
        .select('*, outlets(name)')
        .eq('id', t.source_id)
        .single();
      console.log(`Linked Topup:`, topup);
    }
    console.log('--------------------------------------------------');
  }
}

run();
