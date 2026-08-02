const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08'; // From previous output

  // Check cash_balance
  const { data: balance, error: balErr } = await admin
    .from('cash_balance')
    .select('*')
    .eq('outlet_id', cicurugId)
    .maybeSingle();

  if (balErr) console.error("Error cash_balance:", balErr);
  else console.log("Cash Balance:", balance);

  // Check cash_transaction
  const { data: txs, error: txErr } = await admin
    .from('cash_transaction')
    .select('*')
    .eq('outlet_id', cicurugId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (txErr) console.error("Error cash_transaction:", txErr);
  else {
    console.log("Recent Transactions:");
    txs.forEach(t => console.log(`[${t.created_at}] ${t.transaction_type}: ${t.amount} | Notes: ${t.notes}`));
  }
}
run();
