const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/absensi/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDramagaRekapApi() {
  const dramagaId = '550e8400-e29b-41d4-a716-446655440013';
  const date = '2026-07-27';

  // 1. Fetch all staff (primary + assigned via staff_outlets)
  const [primaryRes, assignedRes] = await Promise.all([
    supabase.from('outlet_staff').select('id, name, role').eq('outlet_id', dramagaId).eq('status', 'active'),
    supabase.from('staff_outlets').select('staff_id, outlet_staff!inner(id, name, role, status)').eq('outlet_id', dramagaId)
  ]);

  const staffList = [...(primaryRes.data || [])];
  (assignedRes.data || []).forEach(row => {
    const st = Array.isArray(row.outlet_staff) ? row.outlet_staff[0] : row.outlet_staff;
    if (st && st.status === 'active' && !staffList.some(s => s.id === st.id)) {
      staffList.push({ id: st.id, name: st.name, role: st.role });
    }
  });

  console.log('1. Combined Staff List for Dramaga:', staffList.map(s => `${s.name} (${s.role})`));

  // 2. Fetch attendance for Dramaga using Service Role Key (bypassing RLS)
  const { data: recs } = await supabase
    .from('attendance')
    .select('id, type, status, ts_server, ts_client, selfie_url, outlet_staff_id, telat_menit')
    .eq('outlet_id', dramagaId)
    .gte('ts_server', `${date}T00:00:00`)
    .lte('ts_server', `${date}T23:59:59`)
    .order('ts_server', { ascending: false });

  console.log('\n2. Attendance Records fetched via Service Role Key:', recs?.length);
  recs?.forEach(r => {
    const staffName = staffList.find(s => s.id === r.outlet_staff_id)?.name || r.outlet_staff_id;
    console.log(`  - [${r.type.toUpperCase()}] ${staffName} | Status: ${r.status} | Time: ${r.ts_server}`);
  });
}

testDramagaRekapApi();
