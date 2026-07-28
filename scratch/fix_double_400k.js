const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // 1. Delete the 'inject by admin'
  const { error: delErr } = await supabase
    .from('petty_cash_topups')
    .delete()
    .eq('description', 'inject by admin');
    
  if (delErr) {
    console.error('Gagal hapus inject by admin:', delErr);
  } else {
    console.log('Berhasil menghapus "inject by admin"');
  }

  // 2. Mark the 'token listrik' as completed
  const { error: updateErr } = await supabase
    .from('petty_cash_topups')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .ilike('description', '%token listrik%')
    .eq('status', 'forwarded_by_leader');
    
  if (updateErr) {
    console.error('Gagal update token listrik:', updateErr);
  } else {
    console.log('Berhasil meng-update "token listrik" menjadi completed!');
  }
}
run();
