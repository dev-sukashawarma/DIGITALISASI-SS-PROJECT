const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  const { data: ledger } = await admin.from('ledger_transaksi_ringkas').select('*').eq('outlet_id', cicurugId).order('tanggal', { ascending: false }).limit(3);
  if (ledger && ledger.length > 0) {
    console.log("=== LEDGER RINGKAS ===");
    ledger.forEach(l => {
      console.log(`${l.tanggal} | Saldo: ${l.saldo_akhir} | Pemasukan: ${l.pemasukan} | Pengeluaran: ${l.pengeluaran} (Diskon: ${l.total_diskon})`);
    });
  } else {
    console.log("No ledger records.");
  }

  const { data: expenses } = await admin.from('petty_cash_expenses').select('*').eq('outlet_id', cicurugId).order('created_at', { ascending: false }).limit(3);
  if (expenses && expenses.length > 0) {
    console.log("\n=== PETTY CASH EXPENSES ===");
    expenses.forEach(e => {
      console.log(`${e.created_at} | -Rp${e.amount} | Cat: ${e.category} | Desc: ${e.description}`);
    });
  } else {
    console.log("No expenses.");
  }

  const { data: topups } = await admin.from('petty_cash_topups').select('*').eq('outlet_id', cicurugId).order('created_at', { ascending: false }).limit(3);
  if (topups && topups.length > 0) {
    console.log("\n=== PETTY CASH TOPUPS ===");
    topups.forEach(t => {
      console.log(`${t.created_at} | +Rp${t.amount} | Ref: ${t.reference_id || '-'}`);
    });
  } else {
    console.log("No topups.");
  }
}
run();
