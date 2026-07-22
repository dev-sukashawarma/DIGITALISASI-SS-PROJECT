import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(supabaseUrl, serviceKey);

async function checkConfigAndShifts() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  // 1. Config
  const { data: cfg, error: errCfg } = await admin
    .from('outlet_attendance_config')
    .select('*')
    .eq('outlet_id', cicurugId);
  console.log('--- OUTLET ATTENDANCE CONFIG ---', errCfg || cfg);

  // 2. Global settings backup
  const { data: globalRow } = await admin
    .from('global_settings')
    .select('value')
    .eq('key', 'global_attendance_config')
    .maybeSingle();
  console.log('--- GLOBAL CONFIG ---', globalRow);

  // 3. Open shifts for Cicurug
  const { data: openShift } = await admin
    .from('shifts')
    .select('*')
    .eq('outlet_id', cicurugId)
    .eq('status', 'open');
  console.log('--- OPEN SHIFTS ---', openShift);

  // 4. Staff in Cicurug with enrolled face descriptor
  const { data: staff } = await admin
    .from('outlet_staff')
    .select('id, name, role, face_descriptor, status')
    .eq('outlet_id', cicurugId);
  console.log('--- STAFF LIST ---', staff ? staff.map(s => ({
    id: s.id,
    name: s.name,
    role: s.role,
    has_face: !!s.face_descriptor
  })) : []);
}

checkConfigAndShifts();
