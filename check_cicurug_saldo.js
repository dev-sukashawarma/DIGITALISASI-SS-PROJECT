const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  // 1. Find Cicurug Outlet
  const { data: outlets, error: outletError } = await admin
    .from('outlets')
    .select('id, name')
    .ilike('name', '%Cicurug%');

  if (outletError || !outlets || outlets.length === 0) {
    console.error("Error finding Cicurug outlet:", outletError);
    return;
  }
  
  const cicurug = outlets[0];
  console.log(`Outlet Found: ${cicurug.name} (ID: ${cicurug.id})`);

  // 2. Fetch current balance
  // Based on standard schema, balance might be in `petty_cash` or `kas_kecil` etc. Let's check `petty_cash` first.
  const { data: pc, error: pcError } = await admin
    .from('petty_cash')
    .select('*')
    .eq('outlet_id', cicurug.id)
    .maybeSingle();
    
  if (pcError) {
    console.error("Error querying petty_cash:", pcError);
  } else if (!pc) {
    console.log("No petty cash record found for this outlet. (Maybe table doesn't exist or is empty)");
  } else {
    console.log("Petty Cash Record:");
    console.log(`Balance: Rp ${pc.balance?.toLocaleString('id-ID')}`);
    console.log(`Last Updated: ${pc.updated_at}`);
  }

  // 3. Fetch transaction history
  const { data: history, error: historyError } = await admin
    .from('petty_cash_transactions')
    .select('*')
    .eq('outlet_id', cicurug.id)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (historyError) {
    console.error("Error querying petty_cash_transactions:", historyError.message);
  } else {
    console.log("\nRecent Transactions (Last 10):");
    if (history.length === 0) {
      console.log("No transactions found.");
    } else {
      history.forEach(tx => {
        const amount = tx.type === 'in' || tx.type === 'topup' ? `+Rp ${tx.amount?.toLocaleString('id-ID')}` : `-Rp ${tx.amount?.toLocaleString('id-ID')}`;
        console.log(`[${tx.created_at}] ${tx.type.toUpperCase()}: ${amount} | Ref: ${tx.reference_type || '-'} | Note: ${tx.description}`);
      });
    }
  }
}

run();
