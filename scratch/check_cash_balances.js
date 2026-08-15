const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function checkCashBalances() {
  const cicurugCashLocationId = '473c0813-5a16-43c3-bdbd-22687cf3a733';

  const { data: cbAll } = await admin.from('cash_balance').select('*');
  console.log("All cash_balance entries:", cbAll);

  const { data: cicurugCB } = await admin
    .from('cash_balance')
    .select('*')
    .eq('cash_location_id', cicurugCashLocationId);
  console.log("Cicurug cash_balance entry:", cicurugCB);

  // Check if there are transactions for this cash location
  const { data: cicurugTx } = await admin
    .from('cash_transaction')
    .select('*')
    .eq('cash_location_id', cicurugCashLocationId);
  console.log("Cicurug cash_transactions:", cicurugTx);
}

checkCashBalances();
