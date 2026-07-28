const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLeadersAndAttendance() {
  const { data: leaders } = await supabase
    .from('outlet_staff')
    .select('id, name, role, outlet_id, is_active')
    .eq('role', 'leader')
    .eq('is_active', true);

  console.log('Active leaders:', leaders);

  const { data: staffOutlets } = await supabase
    .from('staff_outlets')
    .select('staff_id, outlet_id, outlets(id, name)');

  console.log('\nLeader mappings in staff_outlets:');
  leaders.forEach(l => {
    const mappings = staffOutlets.filter(so => so.staff_id === l.id);
    console.log(`Leader: ${l.name} (${l.id}) | Primary Outlet: ${l.outlet_id} | Mapped Outlets:`, mappings.map(m => m.outlets?.name));
  });

  const { data: atts } = await supabase
    .from('attendance')
    .select('id, outlet_id, outlet_staff_id, type, ts_server, outlets(id, name), outlet_staff(id, name, role)')
    .gte('ts_server', '2026-07-27T00:00:00+07:00')
    .order('ts_server', { ascending: false });

  console.log('\nAttendance records for 2026-07-27:');
  atts.forEach(a => {
    console.log(`Staff: ${a.outlet_staff?.name} (${a.outlet_staff?.role}) | Outlet: ${a.outlets?.name} | Type: ${a.type} | Time: ${a.ts_server}`);
  });
}

checkLeadersAndAttendance();
