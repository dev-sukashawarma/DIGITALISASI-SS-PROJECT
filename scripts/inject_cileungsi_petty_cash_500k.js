const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function injectCileungsiPettyCash() {
  const cileungsiOutletId = '62a56103-2085-4dd5-9d25-a3c0cffc88ff';
  const cileungsiCashLocationId = '5a138461-1ee7-4893-92aa-8022cb41cdc2';
  const currentOpenShiftId = '350e05c5-2c98-4a48-9212-8fd0245a60e0';
  const addAmount = 500000;

  console.log('=== Step 1: Fetch Current Open Shift ===');
  const { data: currentShift, error: fetchErr } = await supabase
    .from('shifts')
    .select('*')
    .eq('id', currentOpenShiftId)
    .single();

  if (fetchErr || !currentShift) {
    console.error('Failed to fetch current shift:', fetchErr);
    process.exit(1);
  }

  const prevStarting = Number(currentShift.starting_petty_cash) || 0;
  const newStarting = prevStarting + addAmount;
  console.log(`Current starting_petty_cash: Rp ${prevStarting.toLocaleString('id-ID')}`);
  console.log(`Adding: Rp ${addAmount.toLocaleString('id-ID')}`);
  console.log(`New starting_petty_cash: Rp ${newStarting.toLocaleString('id-ID')}`);

  console.log('\n=== Step 2: Update starting_petty_cash in shifts table ===');
  const { data: updatedShift, error: shiftErr } = await supabase
    .from('shifts')
    .update({
      starting_petty_cash: newStarting,
      updated_at: new Date().toISOString()
    })
    .eq('id', currentOpenShiftId)
    .eq('outlet_id', cileungsiOutletId)
    .select();

  if (shiftErr) {
    console.error('Failed to update shift:', shiftErr);
    process.exit(1);
  }
  console.log('SUCCESS updating shift:', updatedShift);

  console.log('\n=== Step 3: Fetch expenses to calculate current balance ===');
  const { data: expenses } = await supabase
    .from('petty_cash_expenses')
    .select('amount, deleted_at')
    .eq('outlet_id', cileungsiOutletId)
    .gte('created_at', currentShift.start_time);

  const totalExpenses = (expenses || [])
    .filter(e => !e.deleted_at)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const currentSaldo = newStarting - totalExpenses;
  console.log(`Total shift expenses today: Rp ${totalExpenses.toLocaleString('id-ID')}`);
  console.log(`Calculated Current Saldo: Rp ${currentSaldo.toLocaleString('id-ID')}`);

  console.log('\n=== Step 4: Upsert cash_balance for Kas Kecil MITRA CILEUNGSI ===');
  const { data: updatedCashBal, error: cbErr } = await supabase
    .from('cash_balance')
    .upsert({
      cash_location_id: cileungsiCashLocationId,
      saldo: currentSaldo,
      updated_at: new Date().toISOString()
    }, { onConflict: 'cash_location_id' })
    .select();

  if (cbErr) {
    console.error('Failed to upsert cash_balance:', cbErr);
    process.exit(1);
  }
  console.log('SUCCESS upserting cash_balance:', updatedCashBal);

  console.log('\n=== Step 5: Verification via RPC and DB Queries ===');
  const { data: allRpc } = await supabase.rpc('get_all_latest_petty_cash_balances');
  const cileungsiRpc = allRpc ? allRpc.find(r => r.outlet_id === cileungsiOutletId) : null;
  console.log('RPC get_all_latest_petty_cash_balances for Cileungsi:', cileungsiRpc);

  const { data: verifiedShift } = await supabase
    .from('shifts')
    .select('id, outlet_id, status, starting_petty_cash, start_time')
    .eq('id', currentOpenShiftId)
    .single();
  console.log('Verified Shift in DB:', verifiedShift);

  const { data: verifiedCashBal } = await supabase
    .from('cash_balance')
    .select('*')
    .eq('cash_location_id', cileungsiCashLocationId)
    .single();
  console.log('Verified cash_balance in DB:', verifiedCashBal);

  if (
    cileungsiRpc &&
    Number(cileungsiRpc.balance) === currentSaldo &&
    Number(verifiedShift.starting_petty_cash) === newStarting &&
    Number(verifiedCashBal.saldo) === currentSaldo
  ) {
    console.log(`\n======================================================`);
    console.log(`>>> INJECTION & VERIFICATION COMPLETE & VERIFIED! <<<`);
    console.log(`Outlet: MITRA CILEUNGSI (${cileungsiOutletId})`);
    console.log(`Starting Petty Cash (Modal Awal): Rp ${newStarting.toLocaleString('id-ID')}`);
    console.log(`Current Balance (Saldo Berjalan): Rp ${currentSaldo.toLocaleString('id-ID')}`);
    console.log(`======================================================`);
  } else {
    console.error('\n>>> VERIFICATION WARNING! Check the printed values above! <<<');
  }
}

injectCileungsiPettyCash().catch(console.error);
