const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function checkEverything() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';
  const cicurugLocId = '473c0813-5a16-43c3-bdbd-22687cf3a733';

  console.log("1. Current open shift for Cicurug:");
  const { data: openShift } = await admin
    .from('shifts')
    .select('*')
    .eq('outlet_id', cicurugId)
    .eq('status', 'open')
    .single();
  console.log(openShift);

  console.log("\n2. Cash location for Cicurug:");
  const { data: loc } = await admin
    .from('cash_location')
    .select('*')
    .eq('outlet_id', cicurugId);
  console.log(loc);

  console.log("\n3. Cash balance for Cicurug:");
  const { data: bal } = await admin
    .from('cash_balance')
    .select('*')
    .eq('cash_location_id', cicurugLocId);
  console.log(bal);

  console.log("\n4. RPC get_petty_cash_balance before update:");
  const { data: rpcBal } = await admin.rpc('get_petty_cash_balance', { p_outlet_id: cicurugId });
  console.log("Current RPC Petty Cash Balance:", rpcBal);
}

checkEverything();
