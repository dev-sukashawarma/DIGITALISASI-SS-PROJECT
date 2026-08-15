const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function updateCicurugPettyCash() {
  const cicurugOutletId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';
  const cicurugCashLocationId = '473c0813-5a16-43c3-bdbd-22687cf3a733';
  const newNominal = 335800;
  const currentOpenShiftId = '5191a7ed-675e-4e25-89ab-65fc092daefa';

  console.log(`[1/3] Updating shift starting_petty_cash to ${newNominal} for Cicurug open shift (${currentOpenShiftId})...`);
  const { data: updatedShift, error: shiftErr } = await admin
    .from('shifts')
    .update({ 
      starting_petty_cash: newNominal,
      updated_at: new Date().toISOString()
    })
    .eq('id', currentOpenShiftId)
    .eq('outlet_id', cicurugOutletId)
    .select();

  if (shiftErr) {
    console.error("FAILED to update shift:", shiftErr);
    process.exit(1);
  }
  console.log("SUCCESS updating shift:", updatedShift);

  console.log(`\n[2/3] Upserting cash_balance for Kas Kecil MITRA CICURUG (${cicurugCashLocationId}) to ${newNominal}...`);
  const { data: updatedCashBal, error: cbErr } = await admin
    .from('cash_balance')
    .upsert({
      cash_location_id: cicurugCashLocationId,
      saldo: newNominal,
      updated_at: new Date().toISOString()
    }, { onConflict: 'cash_location_id' })
    .select();

  if (cbErr) {
    console.error("FAILED to upsert cash_balance:", cbErr);
    process.exit(1);
  }
  console.log("SUCCESS upserting cash_balance:", updatedCashBal);

  console.log(`\n[3/3] Verifying new balances...`);
  const { data: rpcBal, error: rpcErr } = await admin.rpc('get_petty_cash_balance', { p_outlet_id: cicurugOutletId });
  console.log("RPC get_petty_cash_balance returns:", rpcBal);

  const { data: verifiedShift } = await admin
    .from('shifts')
    .select('id, outlet_id, status, starting_petty_cash, start_time')
    .eq('id', currentOpenShiftId)
    .single();
  console.log("Verified Shift in DB:", verifiedShift);

  const { data: verifiedCashBal } = await admin
    .from('cash_balance')
    .select('*')
    .eq('cash_location_id', cicurugCashLocationId)
    .single();
  console.log("Verified cash_balance in DB:", verifiedCashBal);

  if (rpcBal === newNominal && verifiedShift.starting_petty_cash === newNominal && verifiedCashBal.saldo === newNominal) {
    console.log("\n>>> ALL CHECKS PASSED PERFECTLY! Saldo Petty Cash Cicurug is now Rp 335.800 <<<");
  } else {
    console.error("\n>>> VERIFICATION MISMATCH! Please investigate! <<<");
  }
}

updateCicurugPettyCash();
