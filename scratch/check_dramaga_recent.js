const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: outlets } = await supabase.from('outlets').select('id, name').ilike('name', '%dramaga%');
  if (!outlets || outlets.length === 0) {
    console.log('Outlet Dramaga tidak ditemukan.');
    return;
  }
  
  const dramagaIds = outlets.map(o => o.id);
  
  console.log('=== 10 RECENT TOPUPS FOR DRAMAGA (ANY DATE) ===');
  const { data: topups, error: topErr } = await supabase
    .from('petty_cash_topups')
    .select('*, outlets(name)')
    .in('outlet_id', dramagaIds)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (topErr) console.error(topErr);
  else if (topups.length === 0) console.log('No topups at all for Dramaga.');
  else {
    topups.forEach(t => {
       console.log(`[${new Date(t.created_at).toLocaleString()}] ${t.outlets?.name} - Rp ${t.amount.toLocaleString()} - ${t.description} (Status: ${t.status})`);
    });
  }
}
run();
