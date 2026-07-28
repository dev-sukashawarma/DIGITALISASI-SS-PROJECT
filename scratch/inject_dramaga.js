const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Find Dramaga outlet ID
  const { data: outlets } = await supabase.from('outlets').select('id, name').ilike('name', '%dramaga%');
  if (!outlets || outlets.length === 0) {
    console.log('Outlet Dramaga tidak ditemukan.');
    return;
  }
  
  const dramagaId = outlets[0].id;
  console.log(`Menyuntikkan dana ke outlet: ${outlets[0].name} (${dramagaId})`);

  // We need to inject the petty cash directly into the topups table
  const { data: inserted, error } = await supabase.from('petty_cash_topups').insert({
    outlet_id: dramagaId,
    amount: 400000,
    description: 'inject by admin',
    status: 'completed',
    approval_token: require('crypto').randomUUID()
  }).select();

  if (error) {
    console.error('Gagal inject:', error);
  } else {
    console.log('Berhasil inject dana!');
    console.log(inserted);
  }
}
run();
