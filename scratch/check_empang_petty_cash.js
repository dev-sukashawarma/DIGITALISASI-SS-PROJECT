const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPettyCash() {
  // 1. Find Empang outlet ID
  const { data: outlets, error: outletErr } = await supabase
    .from('outlets')
    .select('id, name')
    .ilike('name', '%empang%');

  if (outletErr) {
    console.error('Error fetching outlets:', outletErr);
    return;
  }

  if (!outlets || outlets.length === 0) {
    console.log('Outlet Empang not found.');
    return;
  }

  const empangId = outlets[0].id;
  console.log(`Found Empang Outlet: ${outlets[0].name} (${empangId})`);

  // 2. Query petty_cash for Empang for today (2026-07-27)
  const todayStart = '2026-07-27T00:00:00+07:00';
  const todayEnd = '2026-07-27T23:59:59+07:00';

  const { data: pettyCashRequests, error: pettyErr } = await supabase
    .from('petty_cash_topups')
    .select('*, requester:outlet_staff!petty_cash_topups_created_by_fkey(name, role)')
    .eq('outlet_id', empangId)
    .order('created_at', { ascending: false });

  if (pettyErr) {
    console.error('Error fetching petty cash:', pettyErr);
    return;
  }

  console.log(`\nFound ${pettyCashRequests.length} petty cash requests for today:\n`);
  
  pettyCashRequests.forEach((req, index) => {
    console.log(`[${index + 1}] ID: ${req.id}`);
    console.log(`    Waktu: ${new Date(req.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
    console.log(`    Peminta: ${req.requester?.name || 'Unknown'} (${req.requester?.role || 'Unknown'})`);
    console.log(`    Jumlah: Rp ${req.amount?.toLocaleString('id-ID')}`);
    console.log(`    Keterangan: ${req.description}`);
    console.log(`    Status: ${req.status}`);
    if (req.proof_url) {
      console.log(`    Bukti: Ada`);
    } else {
      console.log(`    Bukti: Tidak Ada`);
    }
    console.log('--------------------------------------------------');
  });
}

checkPettyCash();
