const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  const { data: expenses } = await admin.from('petty_cash_expenses').select('amount').eq('outlet_id', cicurugId);
  const totalExpense = (expenses || []).reduce((sum, e) => sum + e.amount, 0);

  const { data: topups } = await admin.from('petty_cash_topups').select('amount').eq('outlet_id', cicurugId);
  const totalTopup = (topups || []).reduce((sum, t) => sum + t.amount, 0);

  const saldo = totalTopup - totalExpense;
  console.log(`=== SALDO KAS KECIL CICURUG ===`);
  console.log(`Total Topup : Rp ${totalTopup.toLocaleString('id-ID')}`);
  console.log(`Total Keluar: Rp ${totalExpense.toLocaleString('id-ID')}`);
  console.log(`Sisa Saldo  : Rp ${saldo.toLocaleString('id-ID')}`);
}
run();
