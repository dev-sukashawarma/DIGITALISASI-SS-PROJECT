const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function inspectCicurug() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  console.log("=== SHIFTS FOR CICURUG ===");
  const { data: shifts, error: sErr } = await admin
    .from('shifts')
    .select('*')
    .eq('outlet_id', cicurugId)
    .order('start_time', { ascending: false });
  console.log(`Found ${shifts?.length} shifts:`, shifts);

  console.log("\n=== PETTY CASH TOPUPS FOR CICURUG ===");
  const { data: topups, error: tErr } = await admin
    .from('petty_cash_topups')
    .select('*')
    .eq('outlet_id', cicurugId)
    .order('created_at', { ascending: false });
  console.log(`Found ${topups?.length} topups:`, topups);

  console.log("\n=== PETTY CASH EXPENSES FOR CICURUG ===");
  const { data: pExpenses, error: peErr } = await admin
    .from('petty_cash_expenses')
    .select('*')
    .eq('outlet_id', cicurugId)
    .order('created_at', { ascending: false });
  console.log(`Found ${pExpenses?.length} petty_cash_expenses:`, pExpenses);

  console.log("\n=== EXPENSES FOR CICURUG ===");
  const { data: expenses, error: eErr } = await admin
    .from('expenses')
    .select('*')
    .eq('outlet_id', cicurugId)
    .order('created_at', { ascending: false });
  console.log(`Found ${expenses?.length} expenses:`, expenses);

  console.log("\n=== CHECK RPC get_petty_cash_balance ===");
  try {
    const { data: rpcBal, error: rpcErr } = await admin.rpc('get_petty_cash_balance', { p_outlet_id: cicurugId });
    console.log("RPC get_petty_cash_balance:", rpcBal, rpcErr);
  } catch(e) {
    console.log("RPC get_petty_cash_balance threw:", e);
  }
}

inspectCicurug();
