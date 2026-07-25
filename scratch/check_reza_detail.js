const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/absensi/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const rezaStaffId = '6b41b068-0feb-47d3-aea8-bae94f75fc09';
  const cicurugOutletId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  // 1. Fetch staff details
  const { data: staff, error: staffErr } = await supabase
    .from('outlet_staff')
    .select('*')
    .eq('id', rezaStaffId)
    .single();

  console.log('=== DATA PROFILE STAF REZA ===');
  console.log(staff);

  // 2. Fetch outlet details
  const { data: outlet } = await supabase
    .from('outlets')
    .select('*')
    .eq('id', cicurugOutletId)
    .single();

  console.log('\n=== DATA OUTLET CICURUG ===');
  console.log(`Nama Outlet: ${outlet.name}`);
  console.log(`Koordinat Outlet: Lat ${outlet.lat}, Lng ${outlet.lng}`);

  // 3. Fetch all attendance records for Reza across any outlet
  const { data: rezaAtt, error: attErr } = await supabase
    .from('attendance')
    .select('*')
    .eq('outlet_staff_id', rezaStaffId)
    .order('ts_server', { ascending: false });

  console.log(`\n=== SEMUA RIWAYAT ABSENSI REZA (${rezaAtt?.length || 0} record) ===`);
  console.log(JSON.stringify(rezaAtt, null, 2));

  // 4. Also check if there's any other attendance record with username 'reza' or staff name containing 'reza'
  const { data: allStaff } = await supabase.from('outlet_staff').select('id, name, username').ilike('username', '%reza%');
  console.log('\n=== PENCARIAN STAF DENGAN USERNAME REZA ===');
  console.log(allStaff);
}

main();
