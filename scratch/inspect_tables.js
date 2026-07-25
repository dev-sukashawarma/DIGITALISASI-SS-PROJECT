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
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';
  
  // Let's check tables like 'attendances', 'attendance_logs', 'attendance_records', 'user_attendance', etc.
  console.log('--- 1. Querying attendances table ---');
  let { data: attendances, error: attErr } = await supabase
    .from('attendances')
    .select('*')
    .eq('outlet_id', cicurugId);

  if (attErr) console.log('attendances error:', attErr.message);
  else console.log(`attendances count: ${attendances?.length}`);

  if (!attendances || attendances.length === 0) {
    // Try query without outlet_id filter or check table structure
    const { data: allAtt, error: err2 } = await supabase.from('attendances').select('*').limit(10);
    console.log('sample attendances:', err2 ? err2.message : allAtt);
  } else {
    console.log('Sample Cicurug attendances:', attendances.slice(0, 5));
  }

  // Also query outlet_staff for Cicurug
  console.log('\n--- 2. Staff for Cicurug ---');
  const { data: staff, error: staffErr } = await supabase
    .from('outlet_staff')
    .select('*')
    .eq('outlet_id', cicurugId);
  console.log('Cicurug staff:', staffErr ? staffErr.message : staff);

  // Also query profiles / users if relevant
  console.log('\n--- 3. Profiles / Users assigned to Cicurug ---');
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, full_name, name, role, outlet_id')
    .eq('outlet_id', cicurugId);
  console.log('Cicurug profiles:', profErr ? profErr.message : profiles);
}

main();
