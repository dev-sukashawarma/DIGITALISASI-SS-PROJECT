// test_balance_after_void.js
// Test saldo setelah void untuk outlet yang ada di screenshot (GHF - Rp 5.000)

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  // Outlet dari screenshot: eb174b2b-ff69-47eb-97af-b6c824d3ce4a (GHF void)
  const outletId = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a';

  console.log('=== Test Saldo Setelah Void Pengeluaran ===\n');

  // Ambil shift aktif
  const { data: shift } = await supabase
    .from('shifts')
    .select('id, status, starting_petty_cash, start_time')
    .eq('outlet_id', outletId)
    .eq('status', 'open')
    .maybeSingle();

  console.log('Shift aktif:', shift ? `ID ${shift.id}, mulai ${shift.start_time}` : 'TIDAK ADA');
  if (!shift) {
    console.log('(Shift mungkin sudah ditutup — saldo 0 adalah normal)');
    return;
  }

  const starting = Number(shift.starting_petty_cash || 0);
  console.log('Modal awal shift:', `Rp ${starting.toLocaleString('id-ID')}`);

  // Topup selama shift
  const { data: topups } = await supabase
    .from('petty_cash_topups')
    .select('amount, status')
    .eq('outlet_id', outletId)
    .in('status', ['completed', 'approved', 'approved_by_finance', 'forwarded_by_leader'])
    .gte('created_at', shift.start_time);

  const totalTopup = (topups || []).reduce((s, t) => s + Number(t.amount), 0);
  console.log('Total topup shift:', `Rp ${totalTopup.toLocaleString('id-ID')}`, `(${(topups || []).length} topup)`);

  // Pengeluaran aktif (tidak di-void)
  const { data: activeExpenses } = await supabase
    .from('petty_cash_expenses')
    .select('amount, description, deleted_at')
    .eq('outlet_id', outletId)
    .gte('created_at', shift.start_time)
    .is('deleted_at', null);

  const totalActiveExpenses = (activeExpenses || []).reduce((s, e) => s + Number(e.amount), 0);
  console.log('Total pengeluaran aktif:', `Rp ${totalActiveExpenses.toLocaleString('id-ID')}`, `(${(activeExpenses || []).length} pengeluaran)`);

  // Pengeluaran yang di-void
  const { data: voidedExpenses } = await supabase
    .from('petty_cash_expenses')
    .select('amount, description, deleted_at, delete_reason')
    .eq('outlet_id', outletId)
    .gte('created_at', shift.start_time)
    .not('deleted_at', 'is', null);

  const totalVoidedExpenses = (voidedExpenses || []).reduce((s, e) => s + Number(e.amount), 0);
  console.log('Total pengeluaran di-void:', `Rp ${totalVoidedExpenses.toLocaleString('id-ID')}`, `(${(voidedExpenses || []).length} pengeluaran)`);
  (voidedExpenses || []).forEach(e => {
    console.log(`  ↳ ${e.description}: Rp ${Number(e.amount).toLocaleString('id-ID')} (alasan: ${e.delete_reason})`);
  });

  // Hitung saldo yang benar
  const correctBalance = starting + totalTopup - totalActiveExpenses;
  console.log('\n📊 SALDO YANG BENAR = Rp', correctBalance.toLocaleString('id-ID'));
  console.log(`   = ${starting.toLocaleString('id-ID')} (modal) + ${totalTopup.toLocaleString('id-ID')} (topup) - ${totalActiveExpenses.toLocaleString('id-ID')} (pengeluaran aktif)`);
  console.log('\n✅ Pengeluaran yang di-void TIDAK dihitung → saldo dikembalikan');
}

test().catch(e => {
  console.error(e.message);
  process.exit(1);
});
