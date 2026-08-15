const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function checkPekayon() {
  const pekayonId = '550e8400-e29b-41d4-a716-446655440018';
  const { data: shifts } = await admin
    .from('shifts')
    .select('id, status, start_time, end_time, starting_petty_cash, expected_ending_petty_cash, actual_ending_petty_cash')
    .eq('outlet_id', pekayonId)
    .order('start_time', { ascending: false })
    .limit(3);
  console.log("Pekayon shifts:", shifts);

  const { data: rpcBal } = await admin.rpc('get_petty_cash_balance', { p_outlet_id: pekayonId });
  console.log("Pekayon RPC get_petty_cash_balance:", rpcBal);
}
checkPekayon();
