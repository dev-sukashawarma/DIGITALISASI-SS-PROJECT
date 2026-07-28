const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const today = '2026-07-27';
  
  // Find Dramaga outlet ID
  const { data: outlets } = await supabase.from('outlets').select('id, name').ilike('name', '%dramaga%');
  if (!outlets || outlets.length === 0) {
    console.log('Outlet Dramaga tidak ditemukan.');
    return;
  }
  
  const dramagaIds = outlets.map(o => o.id);
  
  console.log('=== PETTY CASH EXPENSES TODAY (DRAMAGA) ===');
  const { data: expenses, error: expErr } = await supabase
    .from('petty_cash_expenses')
    .select('*, outlets(name)')
    .in('outlet_id', dramagaIds)
    .gte('created_at', today + 'T00:00:00+07:00')
    .lte('created_at', today + 'T23:59:59+07:00')
    .order('created_at', { ascending: false });
    
  if (expErr) console.error(expErr);
  else if (expenses.length === 0) console.log('No expenses today for Dramaga.');
  else {
    expenses.forEach(e => {
       console.log(`[${new Date(e.created_at).toLocaleTimeString()}] ${e.outlets?.name} - Rp ${e.amount.toLocaleString()} - ${e.description} ${e.deleted_at ? '(VOIDED: ' + e.delete_reason + ')' : ''}`);
    });
  }

  console.log('\n=== PETTY CASH TOPUPS TODAY (DRAMAGA) ===');
  const { data: topups, error: topErr } = await supabase
    .from('petty_cash_topups')
    .select('*, outlets(name)')
    .in('outlet_id', dramagaIds)
    .gte('created_at', today + 'T00:00:00+07:00')
    .lte('created_at', today + 'T23:59:59+07:00')
    .order('created_at', { ascending: false });
    
  if (topErr) console.error(topErr);
  else if (topups.length === 0) console.log('No topups today for Dramaga.');
  else {
    topups.forEach(t => {
       console.log(`[${new Date(t.created_at).toLocaleTimeString()}] ${t.outlets?.name} - Rp ${t.amount.toLocaleString()} - ${t.description} (Status: ${t.status})`);
    });
  }
}
run();
