import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(supabaseUrl, serviceKey);

async function diagnose() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  console.log('=== 1. CICURUG OUTLET CONFIG & STATUS ===');
  const { data: outlet } = await admin.from('outlets').select('*').eq('id', cicurugId).single();
  console.log('Outlet:', outlet);

  console.log('\n=== 2. OUTLET ATTENDANCE CONFIG ===');
  const { data: config } = await admin.from('outlet_attendance_config').select('*').eq('outlet_id', cicurugId);
  console.log('Config:', config);

  console.log('\n=== 3. ALL STAFF IN CICURUG ===');
  const { data: staff } = await admin.from('outlet_staff').select('id, name, role, face_descriptor, status, username, is_active').eq('outlet_id', cicurugId);
  if (staff) {
    for (const s of staff) {
      console.log(`- Staff: ${s.name} (${s.username}), Role: ${s.role}, Active: ${s.is_active}, Enrolled: ${!!s.face_descriptor}`);
    }
  }

  console.log('\n=== 4. TODAY ATTENDANCE RECORDS FOR CICURUG ===');
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: attendance } = await admin
    .from('attendance')
    .select('*, outlet_staff(name)')
    .eq('outlet_id', cicurugId)
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false });

  console.log('Today Attendance Count:', attendance ? attendance.length : 0);
  if (attendance && attendance.length > 0) {
    console.log(JSON.stringify(attendance, null, 2));
  }

  console.log('\n=== 5. OPEN SHIFTS IN CICURUG ===');
  const { data: shifts } = await admin.from('shifts').select('*').eq('outlet_id', cicurugId).eq('status', 'open');
  console.log('Open Shifts:', shifts);
}

diagnose();
