const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  const { data: ledger } = await admin.from('ledger_transaksi_ringkas').select('*').eq('outlet_id', cicurugId).order('tanggal', { ascending: false }).limit(5);
  console.log("Ledger Transaksi Ringkas (Last 5):", ledger);

  const { data: expenses } = await admin.from('petty_cash_expenses').select('*').eq('outlet_id', cicurugId).order('created_at', { ascending: false }).limit(5);
  console.log("Petty Cash Expenses (Last 5):", expenses);

  const { data: topups } = await admin.from('petty_cash_topups').select('*').eq('outlet_id', cicurugId).order('created_at', { ascending: false }).limit(5);
  console.log("Petty Cash Topups (Last 5):", topups);
}
run();
