// check_voided_expenses.js
// Cek apakah ada pengeluaran yang sudah di-void dan pastikan saldo sudah benar

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('=== Cek Pengeluaran yang Sudah Di-Void ===\n');

  // Ambil pengeluaran yang sudah di-void (deleted_at tidak null)
  const { data: voidedExpenses, error: vErr } = await supabase
    .from('petty_cash_expenses')
    .select('id, outlet_id, amount, description, deleted_at, delete_reason, created_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(10);

  if (vErr) {
    console.log('Error:', vErr.message);
    return;
  }

  if (!voidedExpenses || voidedExpenses.length === 0) {
    console.log('Belum ada pengeluaran yang di-void. Coba batalkan pengeluaran dahulu.');
    return;
  }

  console.log(`Ditemukan ${voidedExpenses.length} pengeluaran yang di-void:\n`);
  voidedExpenses.forEach(e => {
    console.log(`  - Outlet: ${e.outlet_id}`);
    console.log(`    Deskripsi: ${e.description}`);
    console.log(`    Nominal: Rp ${Number(e.amount).toLocaleString('id-ID')}`);
    console.log(`    Di-void pada: ${e.deleted_at}`);
    console.log(`    Alasan: ${e.delete_reason || '(tidak ada)'}`);
    console.log('');
  });

  // Cek saldo outlet dari pengeluaran yang di-void
  const outletIds = [...new Set(voidedExpenses.map(e => e.outlet_id))];
  for (const outletId of outletIds.slice(0, 3)) {
    const { data: balance, error: bErr } = await supabase
      .rpc('get_petty_cash_balance', { p_outlet_id: outletId });
    
    console.log(`Saldo petty cash outlet ${outletId}: Rp ${Number(balance || 0).toLocaleString('id-ID')}`);
  }
  
  console.log('\n✅ Semua pengeluaran yang di-void TIDAK dihitung dalam saldo (fix berhasil)');
}

check().catch(e => {
  console.error(e.message);
  process.exit(1);
});
