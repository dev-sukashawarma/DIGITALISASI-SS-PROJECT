const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const today = '2026-07-27';
  
  console.log('=== PETTY CASH EXPENSES TODAY ===');
  const { data: expenses, error: expErr } = await supabase
    .from('petty_cash_expenses')
    .select('*, outlets(name)')
    .gte('created_at', today + 'T00:00:00+07:00')
    .lte('created_at', today + 'T23:59:59+07:00')
    .order('created_at', { ascending: false });
    
  if (expErr) console.error(expErr);
  else if (expenses.length === 0) console.log('No expenses today.');
  else {
    expenses.forEach(e => {
       console.log(`[${new Date(e.created_at).toLocaleTimeString()}] ${e.outlets?.name} - Rp ${e.amount.toLocaleString()} - ${e.description} ${e.deleted_at ? '(VOIDED: ' + e.delete_reason + ')' : ''}`);
    });
  }

  console.log('\n=== PETTY CASH TOPUPS TODAY ===');
  const { data: topups, error: topErr } = await supabase
    .from('petty_cash_topups')
    .select('*, outlets(name)')
    .gte('created_at', today + 'T00:00:00+07:00')
    .lte('created_at', today + 'T23:59:59+07:00')
    .order('created_at', { ascending: false });
    
  if (topErr) console.error(topErr);
  else if (topups.length === 0) console.log('No topups today.');
  else {
    topups.forEach(t => {
       console.log(`[${new Date(t.created_at).toLocaleTimeString()}] ${t.outlets?.name} - Rp ${t.amount.toLocaleString()} - ${t.description} (Status: ${t.status})`);
    });
  }
}
run();
