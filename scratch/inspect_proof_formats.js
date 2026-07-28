const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/absensi/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAttendanceTable() {
  const { data: count, error } = await supabase.from('attendance').select('*', { count: 'exact' });
  console.log('Attendance count error:', error);
  console.log('Total attendance records:', count?.length);

  const { data: sahrul } = await supabase.from('outlet_staff').select('id, name').ilike('name', '%sahrul%').single();
  console.log('Sahrul staff ID:', sahrul);

  if (sahrul) {
    const { data: sahrulAtt } = await supabase.from('attendance').select('*').eq('outlet_staff_id', sahrul.id);
    console.log('Sahrul attendance records:', sahrulAtt);
  }
}

checkAttendanceTable();
