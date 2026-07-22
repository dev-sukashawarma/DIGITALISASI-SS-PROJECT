import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(supabaseUrl, serviceKey);

async function checkStaffEnrollment() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';
  const { data: staff } = await admin.from('outlet_staff').select('id, name, username, role, face_descriptor').eq('outlet_id', cicurugId);

  console.log('CICURUG STAFF ENROLLMENT SUMMARY:');
  for (const s of staff || []) {
    const isEnrolled = s.face_descriptor && Array.isArray(s.face_descriptor) && s.face_descriptor.length > 0;
    console.log(`- ${s.name} (@${s.username}): ${isEnrolled ? '✅ SUDAH ENROLL WAJAH' : '❌ BELUM ENROLL WAJAH'}`);
  }
}

checkStaffEnrollment();
